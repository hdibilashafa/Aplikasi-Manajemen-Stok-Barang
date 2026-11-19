import { PrismaClient } from '@prisma/client'
import { BaseService } from './BaseService'

/**
 * Interface untuk data Transaksi
 */
export interface Transaksi {
    id: string
    barangId: string
    tipe: 'JUAL' | 'BELI'
    jumlah: number
    tanggal: Date
    barang?: any
}

/**
 * Interface untuk input Transaksi
 */
export interface TransaksiInput {
    barangId: string
    tipe: 'JUAL' | 'BELI'
    jumlah: number
    tanggal?: string | Date
}

/**
 * TransaksiService - Class CRUD untuk Transaksi
 * 
 * Konsep OOP yang diterapkan:
 * 1. Inheritance (extends)   - Mewarisi dari BaseService<Transaksi>
 * 2. Polymorphism (override) - create/update/delete punya logika stok
 * 3. Private Method          - hitungStokBaru() tersembunyi dari luar
 * 4. Encapsulation           - Logika perhitungan stok terisolasi dalam class
 */
export class TransaksiService extends BaseService<Transaksi> {
    // Override abstract property
    protected modelName = 'transaksi'

    constructor(prismaClient: PrismaClient) {
        super(prismaClient)
    }

    // =============================================
    // Override Methods - masing-masing punya logika stok
    // =============================================

    /** Override: Ambil semua transaksi dengan relasi barang & kategori */
    async getAll(): Promise<Transaksi[]> {
        const transaksi = await this.prisma.transaksi.findMany({
            include: {
                barang: {
                    include: { kategori: true }
                }
            },
            orderBy: { tanggal: 'desc' }
        })
        return transaksi as unknown as Transaksi[]
    }

    /** Override: Ambil detail transaksi */
    async getById(id: string): Promise<Transaksi | null> {
        const transaksi = await this.prisma.transaksi.findUnique({
            where: { id },
            include: {
                barang: {
                    include: { kategori: true }
                }
            }
        })
        return transaksi as unknown as Transaksi | null
    }

    /**
     * Override: Buat transaksi baru
     * Polymorphism: otomatis update stok barang dalam satu $transaction
     */
    async create(data: TransaksiInput): Promise<Transaksi> {
        // Cari barang terkait
        const barang = await this.prisma.barang.findUnique({
            where: { id: data.barangId }
        })

        if (!barang) {
            throw new Error('Barang tidak ditemukan')
        }

        // Gunakan private method untuk hitung stok
        const stokBaru = this.hitungStokBaru(data.tipe, barang.stok, data.jumlah)

        if (stokBaru < 0) {
            throw new Error('Stok tidak mencukupi')
        }

        // Prisma transaction: buat transaksi + update stok secara atomik
        const [transaksi] = await this.prisma.$transaction([
            this.prisma.transaksi.create({
                data: {
                    barangId: data.barangId,
                    tipe: data.tipe,
                    jumlah: data.jumlah,
                    tanggal: data.tanggal ? new Date(data.tanggal) : new Date()
                },
                include: {
                    barang: {
                        include: { kategori: true }
                    }
                }
            }),
            this.prisma.barang.update({
                where: { id: data.barangId },
                data: { stok: stokBaru }
            })
        ])

        return transaksi as unknown as Transaksi
    }

    /**
     * Override: Update transaksi
     * Polymorphism: revert stok lama, lalu apply stok baru
     */
    async update(id: string, data: { tipe: 'JUAL' | 'BELI'; jumlah: number; tanggal: string }): Promise<Transaksi> {
        // 1. Ambil transaksi lama
        const oldTrans = await this.prisma.transaksi.findUnique({
            where: { id },
            include: { barang: true }
        })

        if (!oldTrans) {
            throw new Error('Transaksi tidak ditemukan')
        }

        // 2. Revert stok lama (kebalikan dari operasi awal)
        let currentStok = oldTrans.tipe === 'JUAL'
            ? oldTrans.barang.stok + oldTrans.jumlah   // Kembalikan stok yang terjual
            : oldTrans.barang.stok - oldTrans.jumlah   // Kurangi stok yang dibeli

        // 3. Apply stok baru
        let finalStok = this.hitungStokBaru(data.tipe, currentStok, data.jumlah)

        if (finalStok < 0) {
            throw new Error('Stok tidak mencukupi untuk update ini')
        }

        // 4. Execute dalam transaction
        const [, updatedTrans] = await this.prisma.$transaction([
            this.prisma.barang.update({
                where: { id: oldTrans.barangId },
                data: { stok: finalStok }
            }),
            this.prisma.transaksi.update({
                where: { id },
                data: {
                    tipe: data.tipe,
                    jumlah: data.jumlah,
                    tanggal: new Date(data.tanggal)
                },
                include: { barang: true }
            })
        ])

        return updatedTrans as unknown as Transaksi
    }

    /**
     * Override: Hapus transaksi
     * Polymorphism: rollback stok ke keadaan sebelum transaksi
     */
    async delete(id: string): Promise<{ success: boolean }> {
        // Ambil data transaksi yang akan dihapus
        const transaksi = await this.prisma.transaksi.findUnique({
            where: { id },
            include: { barang: true }
        })

        if (!transaksi) {
            throw new Error('Transaksi tidak ditemukan')
        }

        // Rollback stok: kebalikan dari operasi awal
        const stokBaru = transaksi.tipe === 'JUAL'
            ? transaksi.barang.stok + transaksi.jumlah  // Kembalikan stok
            : transaksi.barang.stok - transaksi.jumlah  // Kurangi stok

        if (stokBaru < 0) {
            throw new Error('Stok barang menjadi negatif jika transaksi dihapus')
        }

        // Execute dalam transaction
        await this.prisma.$transaction([
            this.prisma.barang.update({
                where: { id: transaksi.barangId },
                data: { stok: stokBaru }
            }),
            this.prisma.transaksi.delete({ where: { id } })
        ])

        return { success: true }
    }

    // =============================================
    // Private Method - Encapsulation
    // Logika internal yang tersembunyi dari luar class
    // =============================================

    /**
     * Hitung stok baru berdasarkan tipe transaksi
     * Private: tidak bisa dipanggil dari luar class
     */
    private hitungStokBaru(tipe: string, stokLama: number, jumlah: number): number {
        if (tipe === 'BELI') {
            return stokLama + jumlah   // Beli = stok bertambah
        } else {
            return stokLama - jumlah   // Jual = stok berkurang
        }
    }
}
