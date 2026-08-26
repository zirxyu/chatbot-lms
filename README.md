# 🤖 Chatbot LMS — Verifikasi NIM via WhatsApp

Chatbot WhatsApp untuk layanan akun **Portal Belajar LMS**: verifikasi NIM
mahasiswa, pembuatan akun otomatis (username & kata sandi dikirim ke email),
serta ganti kata sandi dengan kode verifikasi via email.

Dibangun dengan Node.js + [Baileys](https://github.com/WhiskeySockets/Baileys)
(tanpa browser/headless — ringan dan efisien).

```
┌──────────────┐   pesan WA    ┌─────────────────┐   REST API    ┌───────────────────┐
│  Mahasiswa   │ ────────────► │  Chatbot (repo  │ ────────────► │  Server LMS       │
│  (WhatsApp)  │ ◄──────────── │  ini, Baileys)  │ ◄──────────── │  database NIM,    │
└──────────────┘   balasan     └─────────────────┘   JSON        │  kirim email      │
                                                                └───────────────────┘
```

## ✨ Fitur

- **Verifikasi NIM** — NIM dicek ke server:
  - Valid & belum punya akun → server membuatkan akun, username + password dikirim ke email mahasiswa.
  - Valid & sudah punya akun → username + password dikirim ulang ke email beserta tautan khusus ganti sandi.
  - Tidak valid → permintaan ditolak dengan pesan jelas.
- **Ganti kata sandi** → kode verifikasi 6 digit via email, lalu atur sandi baru langsung dari WhatsApp.
- Sesi percakapan multi-langkah dengan TTL (auto-expire).
- Rate limiting percobaan NIM/OTP per nomor (anti brute-force).
- Login tanpa scan QR memakai **kode pairing** (cocok untuk server headless).
- Auto-reconnect, tombol menu, panduan bantuan, notifikasi ke nomor admin.
- Masking email di chat, kode referensi galat untuk debugging.
- **Mock API server** siap pakai (database NIM dummy + email ke folder `outbox/`)
  sehingga bisa diuji end-to-end sebelum backend LMS siap.

## 📋 Alur Percakapan

<details>
<summary><b>Contoh: pendaftaran akun</b></summary>

```
Mahasiswa : halo
Bot       : 🎓 Portal LMS Unmul ... (menu 1/2/3)
Mahasiswa : 1
Bot       : 📝 Pendaftaran Akun Baru — kirimkan NIM Anda
Mahasiswa : 2109119001
Bot       : ⏳ Sedang memeriksa data di server...
Bot       : ✅ Verifikasi Berhasil! Username & kata sandi awal telah dikirim ke 📧 21****@student...
```
</details>

<details>
<summary><b>Contoh: ganti kata sandi</b></summary>

```
Mahasiswa : 2
Bot       : 🔑 Ganti Kata Sandi — kirimkan NIM Anda
Mahasiswa : 2109119001
Bot       : 🔐 Kode verifikasi terkirim ke 📧 21****@student... (berlaku 10 menit)
Mahasiswa : 482913
Bot       : 🔑 Buat Kata Sandi Baru (min 8 karakter, huruf+angka)
Mahasiswa : sandibaru123
Bot       : ✅ Berhasil! Kata sandi telah diperbarui.
```
</details>

## 🚀 Memulai Cepat

Persyaratan: **Node.js ≥ 18**.

```bash
git clone git@github.com:zirxyu/chatbot-lms.git
cd chatbot-lms
npm install
cp .env.example .env          # sesuaikan isi .env
```

### Mode uji coba (mock server, tanpa backend LMS)

Terminal 1 — jalankan mock API:

```bash
npm run mock
# Email "terkirim" muncul di folder outbox/
```

Terminal 2 — jalankan bot:

```bash
npm start
# Scan QR yang muncul di terminal lewat WhatsApp → Perangkat Tertaut
```

Tambahkan NIM uji di `data/nims.json`, lalu chat bot dari nomor WhatsApp Anda.

### Login tanpa scan QR (pairing code)

Isi `PAIRING_PHONE=628xxxxxxxxxx` (nomor WA yang dipakai bot) di `.env`,
jalankan `npm start`, lalu masukkan kode pairing dari terminal ke aplikasi
WhatsApp → *Perangkat Tertaut → Tautkan dengan nomor telepon saja*.

## ⚙️ Konfigurasi (.env)

| Variabel | Default | Keterangan |
|---|---|---|
| `APP_NAME` | Portal LMS | Nama aplikasi di pesan & email |
| `APP_URL` | http://localhost:8000 | Alamat web LMS (ditampilkan ke mahasiswa) |
| `ADMIN_CONTACT` | admin | Kontak yang ditampilkan saat bermasalah |
| `SESSION_DIR` | ./session | Folder kredensial WhatsApp (jangan dibagikan!) |
| `PAIRING_PHONE` | *(kosong)* | Nomor WA bot untuk login via kode pairing |
| `BOT_OWNER` | *(kosong)* | Nomor admin penerima notifikasi bot aktif |
| `ALLOW_GROUPS` | false | Balas pesan di grup |
| `MARK_READ` | true | Tandai pesan sudah dibaca |
| `RECONNECT_MS` | 5000 | Jeda reconnect (ms) |
| `LOG_LEVEL` | info | `silent`/`warn`/`debug` |
| `LMS_API_URL` | — | Base URL API server LMS (**wajib**) |
| `LMS_API_KEY` | — | API key server LMS (**wajib**) |
| `REQUEST_TIMEOUT_MS` | 15000 | Timeout panggilan API |
| `NIM_PATTERN` | ^[0-9]{6,15}$ | Regex format NIM sebelum dikirim ke server |
| `MAX_VERIFY_ATTEMPTS` | 5 | Batas percobaan gagal per jendela waktu |
| `RATE_WINDOW_MIN` | 60 | Jendela rate limit (menit) |
| `SESSION_TTL_MIN` | 5 | Masa aktif langkah percakapan (menit) |

Variabel tambahan khusus mock server: `PORT`, `MOCK_API_KEY`, `MOCK_SECRET`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
Jika `SMTP_HOST` kosong, email ditulis ke `outbox/*.html`.

## 🔌 Integrasi Backend LMS

Kontrak lengkap endpoint yang harus disediakan server LMS ada di
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md), termasuk contoh route Laravel
untuk repo `unmul_microservice`. `scripts/mock-server.js` dapat dipakai
sebagai referensi implementasi (respons, status code, template email).

Selama integrasi, arahkan `LMS_API_URL` & `LMS_API_KEY` ke backend asli —
tidak ada perubahan kode di sisi bot.

## 📦 Deployment (VPS)

```bash
npm i -g pm2
pm2 start src/index.js --name chatbot-lms
pm2 save && pm2 startup
pm2 logs chatbot-lms
```

Catatan:

- Simpan folder `session/` — jika hilang/ter-logout, wajib pairing ulang.
- Saat bot ter-logout (`logged out` di log): hapus `session/`, jalankan lagi, scan QR / pairing ulang.
- Satu nomor WhatsApp = satu sesi; jangan menjalankan dua bot dengan session sama.

## 🔒 Keamanan

- API key & secret hanya di `.env` (sudah di-gitignore).
- Bot hanya merespons chat pribadi; grup dinonaktifkan secara default.
- Rate limit + batas percobaan OTP di kedua sisi (bot & server).
- Email masking di chat; password tidak pernah dikirim/dilog oleh bot.

## 🗺️ Rencana Pengembangan

- [ ] Notifikasi kuliah/tugas dari LMS ke mahasiswa via WA
- [ ] Perintah cek jadwal & nilai
- [ ] Dashboard statistik penggunaan bot

## Lisensi

MIT
