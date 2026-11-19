import { PrismaClient } from '@prisma/client'
import { BaseService } from './BaseService'

/**
 * Interface untuk data Kategori
 */
export interface Kategori {
    id: string
    nama: string
    createdAt: Date
    _count?: { barang: number }
    barang?: any[]
}

/**
 * Interface untuk input Kategori
 */
export interface KategoriInput {
    nama: string
}

/**
 * KategoriService - Class CRUD untuk Kategori
 * 
 * Konsep OOP yang diterapkan:
 * 1. Inheritance (extends)   - Mewarisi dari BaseService<Kategori>
 * 2. Polymorphism (override) - create() punya logika tambahan (cek duplikat)
 * 3. Polymorphism (override) - delete() punya logika tambahan (set null kategoriId)
 * 4. Constructor chaining    - super() ke parent
 */
export class KategoriService extends BaseService<Kategori> {
    // Override abstract property
    protected modelName = 'kategori'

    constructor(prismaClient: PrismaClient) {
        super(prismaClient)
    }

    // =============================================
    // Override Methods - Polymorphism
    // Setiap method punya logika berbeda dari BaseService
    // =============================================

    /** Override: Ambil semua kategori dengan jumlah barang */
    async getAll(): Promise<Kategori[]> {
        const kategori = await this.prisma.kategori.findMany({
            orderBy: { nama: 'asc' },
            include: {
                _count: {
                    select: { barang: true }
                }
            }
        })
        return kategori as unknown as Kategori[]
    }

    /** Override: Ambil detail kategori beserta daftar barang */
    async getById(id: string): Promise<Kategori | null> {
        const kategori = await this.prisma.kategori.findUnique({
            where: { id },
            include: { barang: true }
        })
        return kategori as unknown as Kategori | null
    }

    /**
     * Override: Buat kategori baru
     * Polymorphism: menambahkan pengecekan duplikat sebelum create
     */
    async create(data: KategoriInput): Promise<Kategori> {
        // Logika tambahan: cek apakah nama sudah ada
        const existing = await this.prisma.kategori.findUnique({
            where: { nama: data.nama }
        })

        if (existing) {
            throw new Error('Kategori sudah ada')
        }

        const kategori = await this.prisma.kategori.create({
            data: { nama: data.nama }
        })
        return kategori as unknown as Kategori
    }

    /** Override: Update nama kategori */
    async update(id: string, data: KategoriInput): Promise<Kategori> {
        const kategori = await this.prisma.kategori.update({
            where: { id },
            data: { nama: data.nama }
        })
        return kategori as unknown as Kategori
    }

    /**
     * Override: Hapus kategori
     * Polymorphism: set kategoriId = null pada barang terkait sebelum menghapus
     */
    async delete(id: string): Promise<{ success: boolean }> {
        // Logika khusus: lepaskan barang dari kategori ini dulu
        await this.prisma.barang.updateMany({
            where: { kategoriId: id },
            data: { kategoriId: null }
        })

        await this.prisma.kategori.delete({ where: { id } })
        return { success: true }
    }
}
