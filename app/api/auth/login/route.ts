import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'

export async function POST(request: NextRequest) {
    // Instansiasi service class
    const authService = new AuthService(prisma)

    try {
        const { username, password } = await request.json()

        if (!username || !password) {
            return NextResponse.json({ error: 'Username dan password wajib diisi' }, { status: 400 })
        }

        // Gunakan method dari AuthService instance
        const result = await authService.login(username, password)

        const response = NextResponse.json({
            success: true,
            user: result.user
        })

        response.cookies.set('token', result.token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7
        })

        return response
    } catch (error: any) {
        // Error dari AuthService (username tidak ditemukan / password salah)
        if (error.message === 'Username tidak ditemukan' || error.message === 'Password salah') {
            return NextResponse.json({ error: error.message }, { status: 401 })
        }
        console.error('Login error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
