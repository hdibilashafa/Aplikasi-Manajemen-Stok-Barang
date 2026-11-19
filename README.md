# Aplikasi Manajemen Stok dan Perencanaan Pembelian Barang

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8)

Aplikasi web untuk **mencatat stok dan transaksi barang**, lalu **menghitung kebutuhan stok** dengan metode **Simple Moving Average (SMA)** dilengkapi **Safety Stock**, **rekomendasi jumlah pembelian**, dan **MAPE** sebagai ukuran akurasi peramalan.

Aplikasi punya dua peran: **Karyawan** yang mengelola data harian, dan **Owner** yang memakai hasil perhitungan untuk merencanakan pembelian.

---

## Fitur Utama

### Karyawan
- **Dashboard** ringkasan jumlah barang dan transaksi
- **Kelola barang**: tambah, ubah, hapus, lengkap dengan kategori, satuan, stok, dan foto barang
- **Kelola kategori** barang
- **Catat transaksi** penjualan (`JUAL`) dan pembelian (`BELI`). Stok barang ikut diperbarui otomatis dalam satu transaksi database, dan stok tidak boleh menjadi negatif
- Ubah dan hapus transaksi, dengan stok yang dikembalikan atau disesuaikan secara otomatis

### Owner
- **Perencanaan Stok**: pilih periode, lalu hitung peramalan, safety stock, rekomendasi pembelian, dan MAPE untuk semua barang. Hasil bisa dicari berdasarkan nama, kode, atau kategori
- Melihat **Data Barang** dan **Data Transaksi**

### Umum
- Login dengan **JWT** yang disimpan di cookie `httpOnly', password di-hash dengan **bcrypt**
- Pembatasan akses berdasarkan peran. Perhitungan stok hanya bisa diakses Owner

---

## Metode Perhitungan

Perhitungan dilakukan per barang, berdasarkan data **penjualan (`JUAL`) mingguan** pada periode yang dipilih.

| Komponen | Rumus |
|---|---|
| **Window** | `max(2, ceil(jumlah hari periode / 7))` minggu, dihitung otomatis |
| **Peramalan (SMA)** | Rata-rata total penjualan mingguan pada `N` minggu terakhir (dibulatkan) |
| **Penjualan harian tertinggi** | Total penjualan mingguan tertinggi / 7 |
| **Rata-rata penjualan harian** | Total penjualan periode / jumlah hari periode |
| **Safety Stock** | `max(0, (penjualan harian tertinggi − rata-rata penjualan harian) × lead time)` |
| **Rekomendasi pembelian (Q)** | `max(0, (SMA + Safety Stock) − stok saat ini)` |
| **MAPE** | Rata-rata persentase kesalahan peramalan bergulir (*rolling forecast*) pada data mingguan. Jika data tepat sebanyak window, dipakai *leave-one-out* |

Barang tanpa transaksi penjualan pada periode tersebut ditandai **"Tidak ada data transaksi"**. Barang dengan `Q > 0` ditandai **"Perlu restock"**, selebihnya **"Stok mencukupi"**. Lead time memakai nilai pada masing-masing barang (default 7 hari).

---

## Tech Stack

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database dan ORM | PostgreSQL, Prisma 5 |
| Autentikasi | JSON Web Token (`jsonwebtoken`), `bcryptjs` |
| Tampilan | Tailwind CSS 4, Sonner (notifikasi) |

### Arsitektur kode (OOP)

Logika bisnis dipisahkan ke kelas-kelas *service* di `lib/services/`:

| Kelas | Peran |
|---|---|
| `BaseService<T>` | Kelas abstrak generik dengan kontrak CRUD (`getAll`, `getById`, `create`, `update`, `delete`) |
| `BarangService`, `KategoriService`, `TransaksiService` | Mewarisi `BaseService`. `TransaksiService` menjaga konsistensi stok saat transaksi dibuat, diubah, atau dihapus |
| `AuthService` | Login, pembuatan dan verifikasi token, hashing password |
| `PerhitunganService` | Perhitungan SMA, safety stock, rekomendasi pembelian, dan MAPE |

---

## Struktur Folder

```
.
├── app/
│   ├── api/
│   │   ├── auth/            # login, logout, me
│   │   ├── barang/          # CRUD barang (+ upload gambar)
│   │   ├── kategori/        # CRUD kategori
│   │   ├── transaksi/       # CRUD transaksi
│   │   └── perhitungan/     # perhitungan SMA (khusus Owner)
│   ├── login/               # halaman login
│   ├── karyawan/            # dashboard, barang, transaksi
│   └── owner/               # perencanaan stok, data barang, data transaksi
├── components/              # ConfirmModal
├── lib/
│   ├── services/            # kelas service (OOP)
│   ├── auth.ts
│   └── prisma.ts
├── prisma/
│   ├── schema.prisma        # model: User, Kategori, Barang, Transaksi
│   └── seed.ts              # data demo
├── proxy.ts                 # proteksi route /karyawan dan /owner
└── package.json
```

---

## Instalasi

### Prasyarat

- Node.js 20 atau lebih baru
- Database PostgreSQL (lokal atau layanan seperti Supabase)

### 1. Clone dan install dependensi

```bash
git clone https://github.com/hdibilashafa/SIPrevisi.git
cd SIPrevisi
npm install
```

### 2. Buat file `.env`

Buat file `.env` di folder utama (file ini tidak ikut di-commit):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/NAMA_DATABASE"
JWT_SECRET="isi-dengan-string-acak-yang-panjang"
```

> `JWT_SECRET` wajib diisi dengan string acak yang panjang dan dirahasiakan.

### 3. Siapkan database

```bash
npx prisma db push
npx prisma db seed
```

Perintah seed membuat 2 akun, 5 kategori, 20 barang, dan sekitar 4.500 transaksi acak (± 50 transaksi per hari selama 3 bulan terakhir, 80% penjualan dan 20% pembelian) sebagai data demo.

### 4. Jalankan aplikasi

```bash
npm run dev
```

Buka `http://localhost:3000`. Halaman utama langsung mengarah ke halaman login.

### Akun demo (hasil seed)

| Peran | Username | Password |
|---|---|---|
| Owner | `owner` | `123456` |
| Karyawan | `karyawan` | `123456` |

> Akun ini hanya untuk pengembangan lokal. Ganti password sebelum aplikasi dipakai di server yang bisa diakses orang lain.

---

## Cara Menggunakan

1. Login sebagai **Karyawan**, lalu isi data **Barang** dan **Kategori**
2. Catat **Transaksi** penjualan dan pembelian. Stok berubah otomatis
3. Login sebagai **Owner**, buka **Perencanaan Stok**
4. Pilih **tanggal mulai** dan **tanggal akhir**, lalu klik hitung
5. Baca tabel hasil: peramalan, safety stock, sisa stok, rekomendasi pembelian, dan MAPE per barang

---

## Catatan Pengembangan

- Gambar barang disimpan di folder `public/uploads` pada disk lokal, sehingga tidak tersimpan permanen di hosting serverless seperti Vercel. Untuk deployment, gunakan penyimpanan eksternal (misalnya Supabase Storage)
- Gunakan HTTPS saat deployment dan aktifkan opsi `secure` pada cookie login
- Skema database diterapkan dengan `prisma db push` (belum ada folder migrasi)
- Data demo dibangkitkan secara acak, sehingga hasil peramalan dan MAPE pada data demo tidak mencerminkan pola penjualan nyata
- Belum ada pengujian otomatis
