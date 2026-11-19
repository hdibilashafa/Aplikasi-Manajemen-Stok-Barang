import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

/**
 * Interface untuk payload user dalam token JWT
 */
export interface UserPayload {
    id: string
    username: string
    role: 'KARYAWAN' | 'OWNER'
}

/**
 * Interface untuk hasil login
 */
export interface LoginResult {
    success: boolean
    user: UserPayload
    token: string
}

/**
 * AuthService - Class untuk Autentikasi
 * 
 * Konsep OOP yang diterapkan:
 * 1. Encapsulation (private)  - prisma, JWT_SECRET, SALT_ROUNDS tersembunyi
 * 2. Static Methods           - Method yang bisa dipanggil tanpa instansiasi
 * 3. Static Readonly          - Konstanta class yang tidak bisa diubah
 * 4. Constructor              - Dependency injection PrismaClient
 * 5. Instance Methods         - Method yang butuh state objek (prisma)
 */
export class AuthService {
    // Private: hanya bisa diakses di dalam class ini saja
    private prisma: PrismaClient

    // Static Readonly: konstanta milik class, bukan milik instance
    private static readonly JWT_SECRET: string = process.env.JWT_SECRET || 'rahasia-sip-2024'
    private static readonly TOKEN_EXPIRY: string = '7d'
    private static readonly SALT_ROUNDS: number = 10

    // Constructor: dependency injection
    constructor(prismaClient: PrismaClient) {
        this.prisma = prismaClient
    }

    // =============================================
    // Instance Methods - butuh akses ke this.prisma
    // =============================================

    /**
     * Login user dengan username dan password
     * Mengembalikan token JWT jika berhasil
     */
    async login(username: string, password: string): Promise<LoginResult> {
        // Cari user berdasarkan username
        const user = await this.prisma.user.findUnique({
            where: { username }
        })

        if (!user) {
            throw new Error('Username tidak ditemukan')
        }

        // Verifikasi password menggunakan static method
        const valid = await AuthService.verifyPassword(password, user.password)
        if (!valid) {
            throw new Error('Password salah')
        }

        // Buat payload dan token
        const payload: UserPayload = {
            id: user.id,
            username: user.username,
            role: user.role
        }

        const token = AuthService.createToken(payload)

        return {
            success: true,
            user: payload,
            token
        }
    }

    /**
     * Mendapatkan data user dari token
     */
    async getCurrentUser(token: string): Promise<UserPayload | null> {
        return AuthService.verifyToken(token)
    }

    // =============================================
    // Static Methods - bisa dipanggil tanpa `new`
    // Contoh: AuthService.verifyToken(token)
    // =============================================

    /** Hash password menggunakan bcrypt */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, AuthService.SALT_ROUNDS)
    }

    /** Verifikasi password dengan hash */
    static async verifyPassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash)
    }

    /** Membuat JWT token dari payload user */
    static createToken(user: UserPayload): string {
        return jwt.sign({ ...user }, AuthService.JWT_SECRET, {
            expiresIn: AuthService.TOKEN_EXPIRY as any
        })
    }

    /** Verifikasi dan decode JWT token */
    static verifyToken(token: string): UserPayload | null {
        try {
            return jwt.verify(token, AuthService.JWT_SECRET) as UserPayload
        } catch (error) {
            console.error('Verify token failed:', error)
            return null
        }
    }

    /** Mengambil token dari cookie header */
    static getTokenFromCookie(cookieHeader: string | null): string | null {
        if (!cookieHeader) return null
        const match = cookieHeader.match(/token=([^;]+)/)
        return match ? match[1] : null
    }
}
