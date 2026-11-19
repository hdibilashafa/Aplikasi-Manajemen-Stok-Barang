import { PrismaClient } from '@prisma/client'

/**
 * BaseService - Abstract Class (Kelas Abstrak)
 * 
 * Konsep OOP yang diterapkan:
 * 1. Abstract Class    - Tidak bisa di-instansiasi langsung, harus di-extend
 * 2. Generics <T>      - Type parameter agar reusable untuk berbagai model
 * 3. Protected         - Properti hanya bisa diakses oleh subclass
 * 4. Abstract Methods  - Method yang WAJIB diimplementasi oleh setiap subclass
 * 5. Constructor       - Inisialisasi objek saat instansiasi
 */
export abstract class BaseService<T> {
    // Protected: hanya bisa diakses oleh class ini dan subclass-nya
    protected prisma: PrismaClient

    // Abstract property: setiap subclass WAJIB mendefinisikan nama model
    protected abstract modelName: string

    // Constructor: menerima dependency injection PrismaClient
    constructor(prismaClient: PrismaClient) {
        this.prisma = prismaClient
    }

    // =============================================
    // Abstract Methods - WAJIB di-override subclass
    // =============================================

    /** Ambil semua data */
    abstract getAll(): Promise<T[]>

    /** Ambil data berdasarkan ID */
    abstract getById(id: string): Promise<T | null>

    /** Buat data baru */
    abstract create(data: any): Promise<T>

    /** Update data berdasarkan ID */
    abstract update(id: string, data: any): Promise<T>

    /** Hapus data berdasarkan ID */
    abstract delete(id: string): Promise<{ success: boolean }>
}
