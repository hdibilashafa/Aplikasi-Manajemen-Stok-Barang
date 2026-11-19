import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/services/AuthService'
import { PerhitunganService } from '@/lib/services/PerhitunganService'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? AuthService.verifyToken(token) : null

    if (!user || user.role !== 'OWNER') {
        return NextResponse.json({ error: 'Hanya owner yang dapat mengakses' }, { status: 403 })
    }

    try {
        let body;
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const { tanggalMulai, tanggalAkhir, leadTime } = body

        if (!tanggalMulai || !tanggalAkhir) {
            return NextResponse.json({ error: 'Periode (tanggalMulai, tanggalAkhir) wajib diisi' }, { status: 400 })
        }

        // Instansiasi PerhitunganService dan panggil hitungSMA()
        const perhitunganService = new PerhitunganService(prisma)
        const hasil = await perhitunganService.hitungSMA({
            tanggalMulai,
            tanggalAkhir,
            leadTime
        })

        return NextResponse.json(hasil)
    } catch (error: any) {
        // Error dari PerhitunganService (validasi tanggal, dll)
        if (error.message?.includes('tanggal') || error.message?.includes('Format')) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        console.error('Perhitungan error:', error)
        return NextResponse.json({
            error: 'Terjadi kesalahan server',
            detail: error?.message || 'Unknown error'
        }, { status: 500 })
    }
}