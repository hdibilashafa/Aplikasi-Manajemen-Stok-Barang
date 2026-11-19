import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { TransaksiService } from '@/lib/services/TransaksiService'
import { cookies } from 'next/headers'

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

        const transaksiService = new TransaksiService(prisma)
        const result = await transaksiService.delete(id)

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Delete transaksi error:', error)
        if (error.message === 'Transaksi tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error.message?.includes('negatif')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

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
        const { tipe, jumlah, tanggal } = await request.json()

        const transaksiService = new TransaksiService(prisma)
        const updatedTrans = await transaksiService.update(id, { tipe, jumlah, tanggal })

        return NextResponse.json(updatedTrans)
    } catch (error: any) {
        console.error('Update transaksi error:', error)
        if (error.message === 'Transaksi tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error.message?.includes('Stok')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
