import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { KategoriService } from '@/lib/services/KategoriService'
import { cookies } from 'next/headers'

// GET - Detail kategori
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const kategoriService = new KategoriService(prisma)
    const kategori = await kategoriService.getById(id)

    if (!kategori) {
        return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(kategori)
}

// PUT - Update kategori
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        const { nama } = await request.json()

        if (!nama) {
            return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 })
        }

        const kategoriService = new KategoriService(prisma)
        const kategori = await kategoriService.update(id, { nama })

        return NextResponse.json(kategori)
    } catch (error) {
        console.error('Update kategori error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

// DELETE - Hapus kategori
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params

        const kategoriService = new KategoriService(prisma)
        const result = await kategoriService.delete(id)
        return NextResponse.json(result)
    } catch (error) {
        console.error('Delete kategori error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
