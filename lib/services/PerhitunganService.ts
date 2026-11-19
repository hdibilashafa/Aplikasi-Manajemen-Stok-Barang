import { PrismaClient } from '@prisma/client'

/**
 * Interface untuk data transaksi yang diproses
 */
interface TransaksiData {
    tanggal: Date
    jumlah: number
}

/**
 * Interface untuk penjualan per minggu
 */
interface PenjualanMingguan {
    minggu: string
    totalJual: number
}

/**
 * Interface untuk input parameter perhitungan
 */
export interface PerhitunganInput {
    tanggalMulai: string
    tanggalAkhir: string
    window?: number
    leadTime?: number
}

/**
 * Interface untuk hasil perhitungan per barang
 */
export interface HasilPerhitungan {
    no: number
    kode: string
    nama: string
    kategoriNama: string
    satuan: string
    peramalan: number
    safetyStock: number
    stokSaatIni: number
    rekomendasiPembelian: number
    mape: number
    keterangan: string
}

/**
 * Interface untuk response perhitungan lengkap
 */
export interface PerhitunganResponse {
    periode: { mulai: string; akhir: string }
    parameter: { window: number; leadTime: number }
    data: HasilPerhitungan[]
}

/**
 * PerhitunganService - Class untuk Kalkulasi SMA & Safety Stock
 * 
 * Konsep OOP yang diterapkan:
 * 1. Encapsulation (private)    - prisma dan helper methods tersembunyi
 * 2. Static Methods             - Utility functions milik class (bukan instance)
 * 3. Private Static Methods     - Utility yang tidak bisa diakses dari luar
 * 4. Interface                  - Kontrak data yang jelas (type safety)
 * 5. Single Responsibility      - Class ini hanya mengurus perhitungan
 */
export class PerhitunganService {
    // Private: hanya bisa diakses di dalam class ini
    private prisma: PrismaClient

    constructor(prismaClient: PrismaClient) {
        this.prisma = prismaClient
    }

    // =============================================
    // Public Method - API utama class ini
    // =============================================

    /**
     * Hitung SMA, Safety Stock, dan Rekomendasi Pembelian untuk semua barang
     */
    async hitungSMA(input: PerhitunganInput): Promise<PerhitunganResponse> {
        const startDate = new Date(input.tanggalMulai)
        const endDate = new Date(input.tanggalAkhir)

        // Validasi tanggal
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new Error('Format tanggal tidak valid')
        }

        if (startDate > endDate) {
            throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal akhir')
        }

        endDate.setHours(23, 59, 59, 999)

        const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        const windowSize = Math.max(2, Math.ceil(diffDays / 7))
        const fixedLeadTime = input.leadTime || 7

        // Ambil semua barang
        const barangList = await this.prisma.barang.findMany({
            include: { kategori: true },
            orderBy: { kode: 'asc' }
        })

        // Proses setiap barang menggunakan private method
        const hasil = await Promise.all(
            barangList.map(async (barang, index) => {
                return this.hitungPerBarang(barang, index, startDate, endDate, windowSize, fixedLeadTime)
            })
        )

        return {
            periode: {
                mulai: input.tanggalMulai,
                akhir: input.tanggalAkhir
            },
            parameter: {
                window: windowSize,
                leadTime: fixedLeadTime
            },
            data: hasil
        }
    }

    // =============================================
    // Private Instance Method - logika per barang
    // =============================================

    /**
     * Hitung SMA untuk satu barang
     * Private: logika internal yang tersembunyi dari luar
     */
    private async hitungPerBarang(
        barang: any,
        index: number,
        startDate: Date,
        endDate: Date,
        windowSize: number,
        fixedLeadTime: number
    ): Promise<HasilPerhitungan> {
        // Ambil transaksi JUAL dalam periode
        const transaksiJual = await this.prisma.transaksi.findMany({
            where: {
                barangId: barang.id,
                tipe: 'JUAL',
                tanggal: { gte: startDate, lte: endDate }
            },
            orderBy: { tanggal: 'asc' }
        })

        // Jika tidak ada transaksi
        if (transaksiJual.length === 0) {
            return this.buatHasilKosong(barang, index, 'Tidak ada data transaksi')
        }

        // Kelompokkan per minggu (gunakan static method)
        const penjualanPerMinggu = PerhitunganService.groupByWeek(transaksiJual)
        const actualWindow = Math.min(windowSize, penjualanPerMinggu.length)

        if (actualWindow === 0) {
            return this.buatHasilKosong(barang, index, 'Data tidak cukup untuk peramalan')
        }

        // Hitung SMA
        const lastNPeriods = penjualanPerMinggu.slice(-actualWindow)
        const totalPenjualan = lastNPeriods.reduce((sum, period) => sum + period.totalJual, 0)
        const sma = Math.round(totalPenjualan / actualWindow)

        // Hitung penjualan harian
        const hariDalamPeriode = PerhitunganService.hitungHariDalamPeriode(startDate, endDate)
        const totalJualSeluruhPeriode = transaksiJual.reduce((sum, t) => sum + t.jumlah, 0)
        const rataRataPenjualanHarian = totalJualSeluruhPeriode / hariDalamPeriode

        // Penjualan harian tertinggi
        const maxPenjualanMingguan = Math.max(...penjualanPerMinggu.map(p => p.totalJual))
        const penjualanHarianTertinggi = maxPenjualanMingguan / 7

        // Lead time
        const leadTimeDays = barang.leadTime || fixedLeadTime
        const avgLeadTime = leadTimeDays

        // Safety Stock
        const safetyStock = Math.max(
            0,
            Math.round((penjualanHarianTertinggi * leadTimeDays) - (rataRataPenjualanHarian * avgLeadTime))
        )

        // Rekomendasi Pembelian: Q = (SMA + SS) - S
        const rekomendasiPembelian = Math.max(0, (sma + safetyStock) - barang.stok)

        // Hitung MAPE
        const mape = this.hitungMAPE(penjualanPerMinggu, actualWindow)

        return {
            no: index + 1,
            kode: barang.kode,
            nama: barang.nama,
            kategoriNama: barang.kategori?.nama || '-',
            satuan: barang.satuan || 'Pcs',
            peramalan: sma,
            safetyStock,
            stokSaatIni: barang.stok,
            rekomendasiPembelian,
            mape,
            keterangan: rekomendasiPembelian > 0 ? 'Perlu restock' : 'Stok mencukupi'
        }
    }

    /**
     * Buat hasil kosong untuk barang tanpa transaksi
     * Private helper
     */
    private buatHasilKosong(barang: any, index: number, keterangan: string): HasilPerhitungan {
        return {
            no: index + 1,
            kode: barang.kode,
            nama: barang.nama,
            kategoriNama: barang.kategori?.nama || '-',
            satuan: barang.satuan || 'Pcs',
            peramalan: 0,
            safetyStock: 0,
            stokSaatIni: barang.stok,
            rekomendasiPembelian: 0,
            mape: 0,
            keterangan
        }
    }

    /**
     * Hitung MAPE (Mean Absolute Percentage Error)
     * Private: logika internal perhitungan error
     */
    private hitungMAPE(penjualanPerMinggu: PenjualanMingguan[], actualWindow: number): number {
        let mape = 0

        if (penjualanPerMinggu.length >= actualWindow + 1) {
            // Rolling forecast method
            let totalPercentageError = 0
            let validCount = 0

            for (let i = actualWindow; i < penjualanPerMinggu.length; i++) {
                const actual = penjualanPerMinggu[i].totalJual
                if (actual > 0) {
                    const forecastData = penjualanPerMinggu.slice(i - actualWindow, i)
                    const forecast = forecastData.reduce((sum, p) => sum + p.totalJual, 0) / actualWindow
                    const percentageError = Math.abs((actual - forecast) / actual)
                    totalPercentageError += percentageError
                    validCount++
                }
            }

            if (validCount > 0) {
                mape = Math.round((totalPercentageError / validCount) * 100)
            }
        } else if (penjualanPerMinggu.length === actualWindow && actualWindow >= 3) {
            // Leave-One-Out method
            let totalPercentageError = 0
            let validCount = 0

            for (let i = 0; i < penjualanPerMinggu.length; i++) {
                const actual = penjualanPerMinggu[i].totalJual
                if (actual > 0) {
                    const forecastData = penjualanPerMinggu.filter((_, idx) => idx !== i)
                    const forecast = forecastData.reduce((sum, p) => sum + p.totalJual, 0) / forecastData.length
                    const percentageError = Math.abs((actual - forecast) / actual)
                    totalPercentageError += percentageError
                    validCount++
                }
            }

            if (validCount > 0) {
                mape = Math.round((totalPercentageError / validCount) * 100)
            }
        }

        return mape
    }

    // =============================================
    // Private Static Methods - Utility functions
    // Static: milik class, bukan instance
    // Private: tidak bisa diakses dari luar
    // =============================================

    /** Hitung ISO 8601 week number */
    private static getISOWeek(date: Date): number {
        const target = new Date(date.valueOf())
        const dayNr = (date.getDay() + 6) % 7
        target.setDate(target.getDate() - dayNr + 3)
        const firstThursday = target.valueOf()
        target.setMonth(0, 1)
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
        }
        return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
    }

    /** Hitung ISO 8601 week year */
    private static getISOWeekYear(date: Date): number {
        const target = new Date(date.valueOf())
        target.setDate(target.getDate() - ((date.getDay() + 6) % 7) + 3)
        return target.getFullYear()
    }

    /** Kelompokkan transaksi per minggu */
    private static groupByWeek(transaksi: TransaksiData[]): PenjualanMingguan[] {
        const grouped: { [key: string]: number } = {}

        transaksi.forEach(t => {
            const date = new Date(t.tanggal)
            const year = PerhitunganService.getISOWeekYear(date)
            const week = PerhitunganService.getISOWeek(date)
            const weekKey = `${year}-W${String(week).padStart(2, '0')}`

            if (!grouped[weekKey]) {
                grouped[weekKey] = 0
            }
            grouped[weekKey] += t.jumlah
        })

        return Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([minggu, totalJual]) => ({ minggu, totalJual }))
    }

    /** Hitung jumlah hari dalam periode */
    private static hitungHariDalamPeriode(startDate: Date, endDate: Date): number {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return Math.max(1, diffDays)
    }
}
