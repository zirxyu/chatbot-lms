# Chatbot LMS - Panduan Testing

## Instalasi

```bash
git clone https://github.com/zirxyu/chatbot-lms.git
cd chatbot-lms
npm install
```

## Setup `.env`

```bash
cp .env.example .env
```

Edit file `.env`, isi bagian berikut:

| Field | Isi |
|---|---|
| `PAIRING_PHONE` | Nomor WA bot, format `628xxxxxxxxxx` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Email Gmail kamu |
| `SMTP_PASS` | App Password Gmail (bukan password biasa) |
| `MAIL_FROM` | Sama kayak `SMTP_USER` |
| `LMS_API_URL` | `http://localhost:4000` (untuk testing lokal) |

> **Buat App Password:** Buka https://myaccount.google.com/apppasswords, login, lalu generate password baru.

## Tambah Data NIM

Edit file `data/nims.json`:

```json
[
  { "nim": "2109119001", "name": "Nama Mahasiswa" },
  { "nim": "2201102042", "name": "Nama Mahasiswa 2" }
]
```

Format: object dengan field `nim` (angka 6-15 digit) dan `name` (nama lengkap).

## Jalankan

Buka **2 terminal**:

**Terminal 1 — Mock Server:**
```bash
npm run mock
```

**Terminal 2 — Bot WhatsApp:**
```bash
npm start
```

## Pairing WhatsApp

Saat pertama kali jalan, bot akan minta pairing:

- **QR Code Mode:** Scan QR yang muncul di terminal via WhatsApp > Linked Devices > Link a Device
- **Pairing Code Mode:** Kalau `PAIRING_PHONE` sudah diisi, bot akan kasih kode pairing. Masukkan di WhatsApp > Linked Devices > Link with phone number

Session tersimpan di folder `session/`. Jangan hapus folder ini kecuali mau re-pair.

## Flow Testing

Kirim pesan ke nomor bot WhatsApp:

1. Balas `1` atau `daftar`
2. Kirim **NIM** (contoh: `2109119001`)
3. Bot validasi NIM → kalau valid, minta email
4. Kirim **email** (contoh: `nama@gmail.com`)
5. Cek **inbox email** → masukkan kode OTP 6 digit
6. Buat **password** (minimal 8 karakter, kombinasi huruf dan angka)

## Flow Ganti Password

1. Balas `2` atau `ganti sandi`
2. Kirim NIM
3. Kirim email
4. Cek inbox → masukkan kode OTP
5. Buat password baru

## Membatalkan Proses

Kapan saja dalam proses, balas `batal` untuk keluar.

## Cek Log

```bash
# Log mock server
cat /tmp/mock-server.log

# Log bot
cat /tmp/chatbot.log
```

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Bot ga bisa connect | Pastikan Chromium/Puppeteer terinstall |
| OTP ga masuk email | Cek config SMTP di `.env`, pastikan App Password benar |
| NIM tidak ditemukan | Pastikan NIM ada di `data/nims.json` |
| Session expired | Hapus folder `session/`, lalu restart bot dan re-pair |
