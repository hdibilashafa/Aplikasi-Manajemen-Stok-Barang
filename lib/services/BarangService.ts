import { PrismaClient } from '@prisma/client'
import { BaseService } from './BaseService'

/**
 * Interface untuk data Barang
 */
export interface Barang {
    id: string
    kode: string
    nama: string
    gambar: string | null
    stok: number
    satuan: string
    leadTime: number
    kategoriId: string | null
    kategori?: { id: string; nama: string } | null
    createdAt: Date
}

/**
 * Interface untuk data input create/update Barang
 */
export interface BarangInput {
    nama: string
    gambar?: string | null
    stok?: number
    satuan?: string
    leadTime?: number
    kategoriId?: string | null
}

/**
 * BarangService - Class CRUD untuk Barang
 * 
 * Konsep OOP yang diterapkan:
 * 1. Inheritance (extends)  - Mewarisi BaseService<Barang>
 * 2. Method Override         - Mengimplementasi semua abstract methods
 * 3. Private Method          - generateKode() hanya bisa diakses di class ini
 * 4. Protected Property      - modelName diwarisi dari BaseService
 * 5. Constructor chaining    - super() memanggil constructor parent
 */
export class BarangService extends BaseService<Barang> {
    // Override abstract property dari BaseService
    protected modelName = 'barang'

    // Constructor: memanggil super() untuk inisialisasi parent class
    constructor(prismaClient: PrismaClient) {
        super(prismaClient) // Constructor chaining ke BaseService
    }

    // =============================================
    // Override Abstract Methods dari BaseService
    // (Polymorphism - implementasi berbeda per subclass)
    // =============================================

    /** Override: Ambil semua barang dengan relasi kategori */
    async getAll(): Promise<Barang[]> {
        const barang = await this.prisma.barang.findMany({
            orderBy: { createdAt: 'desc' },
            include: { kategori: true }
        })
        return barang as unknown as Barang[]
    }

    /** Override: Ambil detail barang berdasarkan ID */
    async getById(id: string): Promise<Barang | null> {
        const barang = await this.prisma.barang.findUnique({
            where: { id },
            include: { kategori: true }
        })
        return barang as unknown as Barang | null
    }

    /** Override: Buat barang baru dengan auto-generate kode */
    async create(data: BarangInput): Promise<Barang> {
        // Gunakan private method untuk generate kode
        const kode = await this.generateKode()

        const barang = await this.prisma.barang.create({
            data: {
                kode,
                nama: data.nama,
                gambar: data.gambar || null,
                stok: data.stok || 0,
                satuan: data.satuan || 'Pcs',
                leadTime: data.leadTime || 7,
                kategoriId: data.kategoriId || null
            },
            include: { kategori: true }
        })
        return barang as unknown as Barang
    }

    /** Override: Update barang berdasarkan ID */
    async update(id: string, data: Partial<BarangInput> & { kode?: string }): Promise<Barang> {
        const barang = await this.prisma.barang.update({
            where: { id },
            data: {
                kode: data.kode,
                nama: data.nama,
                gambar: data.gambar,
                stok: data.stok,
                satuan: data.satuan || undefined,
                leadTime: data.leadTime !== undefined ? data.leadTime : undefined,
                kategoriId: data.kategoriId || null
            },
            include: { kategori: true }
        })
        return barang as unknown as Barang
    }

    /** Override: Hapus barang (cek transaksi dulu) */
    async delete(id: string): Promise<{ success: boolean }> {
        // Cek apakah barang memiliki transaksi
        const transactionCount = await this.prisma.transaksi.count({
            where: { barangId: id }
        })

        if (transactionCount > 0) {
            throw new Error(
                'Barang tidak dapat dihapus karena sudah memiliki data transaksi. Silakan hapus transaksi terkait terlebih dahulu.'
            )
        }

        await this.prisma.barang.delete({ where: { id } })
        return { success: true }
    }

    // =============================================
    // Private Method - hanya bisa diakses di class ini
    // (Encapsulation - menyembunyikan logika internal)
    // =============================================

    /** Generate kode barang otomatis (BRG001, BRG002, ...) */
    private async generateKode(): Promise<string> {
        const lastBarang = await this.prisma.barang.findFirst({
            orderBy: { kode: 'desc' }
        })

        let newKode = 'BRG001'
        if (lastBarang && lastBarang.kode.startsWith('BRG')) {
            const lastNumber = parseInt(lastBarang.kode.replace('BRG', ''))
            if (!isNaN(lastNumber)) {
                newKode = `BRG${(lastNumber + 1).toString().padStart(3, '0')}`
            }
        }

        return newKode
    }
}
