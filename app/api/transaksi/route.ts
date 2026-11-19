import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { TransaksiService } from '@/lib/services/TransaksiService'
import { cookies } from 'next/headers'

// GET - List transaksi
export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const transaksiService = new TransaksiService(prisma)
    const transaksi = await transaksiService.getAll()
    return NextResponse.json(transaksi)
}

// POST - Tambah transaksi
export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value

    if (!token || !AuthService.verifyToken(token)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { barangId, tipe, jumlah, tanggal } = await request.json()

        if (!barangId || !tipe || !jumlah) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
        }

        const transaksiService = new TransaksiService(prisma)
        const transaksi = await transaksiService.create({ barangId, tipe, jumlah, tanggal })

        return NextResponse.json(transaksi, { status: 201 })
    } catch (error: any) {
        // Error dari TransaksiService
        if (error.message === 'Barang tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error.message === 'Stok tidak mencukupi') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Create transaksi error:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
