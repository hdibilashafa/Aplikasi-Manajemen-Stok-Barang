import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { BarangService } from '@/lib/services/BarangService'
import { cookies } from 'next/headers'

// GET - List semua barang
export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Instansiasi BarangService dan panggil method getAll()
    const barangService = new BarangService(prisma)
    const barang = await barangService.getAll()
    return NextResponse.json(barang)
}

import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST - Tambah barang baru
export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const nama = formData.get('nama') as string
        const stok = parseInt(formData.get('stok') as string) || 0
        const satuan = formData.get('satuan') as string || 'Pcs'
        const leadTime = parseInt(formData.get('leadTime') as string) || 7
        const kategoriId = formData.get('kategoriId') as string | null

        if (!nama) {
            return NextResponse.json({ error: 'Nama barang wajib diisi' }, { status: 400 })
        }

        let gambarPath = null
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

        const barangService = new BarangService(prisma)
        const barang = await barangService.create({
            nama,
            stok,
            satuan,
            leadTime,
            kategoriId,
            gambar: gambarPath
        })

        return NextResponse.json(barang, { status: 201 })
    } catch (error) {
        console.error('Create barang error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
