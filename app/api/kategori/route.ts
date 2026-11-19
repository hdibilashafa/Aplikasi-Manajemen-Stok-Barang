import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { KategoriService } from '@/lib/services/KategoriService'
import { cookies } from 'next/headers'

// GET - List semua kategori
export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const kategoriService = new KategoriService(prisma)
        const kategori = await kategoriService.getAll()
        return NextResponse.json(kategori)
    } catch (error: any) {
        console.error('Fetch kategori error:', error)
        return NextResponse.json({
            error: 'Terjadi kesalahan sistem',
            detail: error?.message
        }, { status: 500 })
    }
}

// POST - Tambah kategori baru
export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { nama } = await request.json()

        if (!nama) {
            return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 })
        }

        const kategoriService = new KategoriService(prisma)
        const kategori = await kategoriService.create({ nama })

        return NextResponse.json(kategori, { status: 201 })
    } catch (error: any) {
        // Error dari KategoriService (duplikat)
        if (error.message === 'Kategori sudah ada') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Create kategori error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
