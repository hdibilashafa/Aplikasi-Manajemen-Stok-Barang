import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { BarangService } from '@/lib/services/BarangService'
import { cookies } from 'next/headers'

// GET - Detail barang
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
    const barangService = new BarangService(prisma)
    const barang = await barangService.getById(id)

    if (!barang) {
        return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(barang)
}

import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// PUT - Update barang
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
        const formData = await request.formData()

        const kode = formData.get('kode') as string | null
        const nama = formData.get('nama') as string

        const stokStr = formData.get('stok') as string
        const stok = stokStr !== null ? parseInt(stokStr) : undefined

        const satuan = formData.get('satuan') as string || undefined

        const leadTimeStr = formData.get('leadTime') as string
        const leadTime = leadTimeStr !== null ? parseInt(leadTimeStr) : undefined

        const kategoriId = formData.get('kategoriId') as string | null

        let gambarPath = undefined
        const file = formData.get('gambar') as File | null
        if (file && file.size > 0) {
            const bytes = await file.arrayBuffer()
            const buffer = Buffer.from(bytes)

            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
            const filename = `${uniqueSuffix}-${file.name.replace(/\s+/g, '-')}`
            const uploadDir = path.join(process.cwd(), 'public', 'uploads')

            await mkdir(uploadDir, { recursive: true }).catch(() => { })
            await writeFile(path.join(uploadDir, filename), buffer)

            gambarPath = `/uploads/${filename}`
        }

        const updateData: any = { nama, stok, satuan, leadTime, kategoriId }
        if (kode) {
            updateData.kode = kode
        }
        if (gambarPath !== undefined) {
            updateData.gambar = gambarPath
        }

        const barangService = new BarangService(prisma)
        const barang = await barangService.update(id, updateData)

        return NextResponse.json(barang)
    } catch (error) {
        console.error('Update barang error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

// DELETE - Hapus barang
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

        const barangService = new BarangService(prisma)
        const result = await barangService.delete(id)
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Delete barang error:', error)
        // Error dari BarangService (barang memiliki transaksi)
        if (error.message?.includes('transaksi')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
