# Kontrak API: Chatbot WhatsApp ↔ Server LMS

Dokumen ini mendefinisikan endpoint yang **wajib disediakan server LMS** agar chatbot
WhatsApp (`chatbot-lms`) dapat bekerja. Mock server di `scripts/mock-server.js`
mengimplementasikan kontrak ini 1:1 dan bisa dipakai sebagai referensi implementasi.

---

## Umum

| Hal | Nilai |
|---|---|
| Base URL | dikonfigurasi via `LMS_API_URL` (contoh: `https://lms.unmul.ac.id/api`) |
| Method | `POST` (semua endpoint) |
| Content-Type | `application/json` |
| Autentikasi | header `x-api-key: <LMS_API_KEY>` |
| Timeout sisi bot | `REQUEST_TIMEOUT_MS` (default 15 detik) |

Setiap request dari bot menyertakan field `ref` (string acak) untuk keperluan
tracing log lintas sistem. Server disarankan mencatatnya juga.

### Format respons standar

```jsonc
// sukses
{ "success": true, "status": "<nama_status>", "data": { } }

// gagal
{ "success": false, "status": "<nama_status>", "message": "penjelasan singkat" }
```

### Daftar status

| Status | HTTP | Arti |
|---|---|---|
| `account_created` | 201 | NIM valid, akun baru berhasil dibuat |
| `account_exists` | 200 | NIM valid, akun sudah ada sebelumnya |
| `otp_sent` | 200 | Kode verifikasi terkirim ke email |
| `password_updated` | 200 | Kata sandi berhasil diganti |
| `nim_not_found` | 404 | NIM tidak ada di database akademik |
| `account_not_found` | 404 | NIM valid tapi belum punya akun LMS |
| `too_many_requests` | 429 | Throttle permintaan OTP |
| `invalid_code` | 400 | Kode OTP salah / kedaluwarsa / kelebihan percobaan |
| `weak_password` | 422 | Kata sandi tidak memenuhi kebijakan |
| `invalid_request` | 400 | Parameter tidak valid |
| `unauthorized` | 401 | API key salah/tidak ada |

---

## 1. Registrasi / Verifikasi NIM

Dipanggil bot saat mahasiswa memilih menu daftar dan mengirim NIM.

```
POST /auth/wa/register
```

**Request**

```json
{ "nim": "2109119012", "phone": "6281234567890", "ref": "a1b2c3d4" }
```

**Respons — NIM valid, akun baru dibuat** (server membuat username + password,
lalu mengirim keduanya ke email mahasiswa):

```json
{
  "success": true,
  "status": "account_created",
  "data": { "username": "mhs2109119012", "email": "2109119012@student.unmul.ac.id" }
}
```

**Respons — NIM valid tetapi sudah punya akun** (server mengirim ulang username +
password saat ini beserta tautan ganti sandi berbatas waktu ke email mahasiswa):

```json
{
  "success": true,
  "status": "account_exists",
  "data": {
    "username": "mhs2109119012",
    "email": "2109119012@student.unmul.ac.id",
    "reset_url": "https://lms.unmul.ac.id/reset-password?token=<signed-token>"
  }
}
```

**Respons — NIM tidak ditemukan:**

```json
{ "success": false, "status": "nim_not_found", "message": "NIM tidak terdaftar dalam database akademik" }
```

---

## 2. Permintaan Kode Verifikasi Ganti Sandi

```
POST /auth/wa/password-reset/request
```

**Request**

```json
{ "nim": "2109119012", "phone": "6281234567890", "ref": "a1b2c3d4" }
```

**Respons sukses** (`email_masked` akan ditampilkan bot ke pengguna):

```json
{
  "success": true,
  "status": "otp_sent",
  "data": { "email_masked": "21************@student.unmul.ac.id", "expires_in_minutes": 10 }
}
```

Status lain: `nim_not_found`, `account_not_found`, `too_many_requests`.

> Rekomendasi server: kode OTP 6 digit, kedaluwarsa ≤10 menit, simpan sebagai
> hash, maksimal 5 percobaan, throttle 1 permintaan/menit per NIM.

## 3. Konfirmasi Ganti Sandi

```
POST /auth/wa/password-reset/confirm
```

**Request**

```json
{ "nim": "2109119012", "code": "482913", "new_password": "rahasia12", "ref": "a1b2c3d4" }
```

**Respons sukses:**

```json
{ "success": true, "status": "password_updated" }
```

Status lain: `invalid_code`, `weak_password`, `account_not_found`.

---

## Contoh cURL

```bash
curl -X POST http://localhost:4000/api/auth/wa/register \
  -H "content-type: application/json" \
  -H "x-api-key: mock-secret-key" \
  -d '{"nim":"2109119001","phone":"6281234567890"}'
```

## Catatan implementasi untuk backend Laravel (unmul_microservice)

Contoh definisi rute (`routes/api.php`):

```php
Route::prefix('auth/wa')
    ->middleware('api.key') // cek header x-api-key
    ->group(function () {
        Route::post('register', [WaAuthController::class, 'register']);
        Route::post('password-reset/request', [WaAuthController::class, 'requestOtp']);
        Route::post('password-reset/confirm', [WaAuthController::class, 'confirmReset']);
    });
```

Checklist keamanan:

- [ ] Semua endpoint hanya lewat HTTPS.
- [ ] `LMS_API_KEY` panjang-acak, disimpan di `.env`, tidak pernah di-commit.
- [ ] Password disimpan ter-hash (bcrypt/argon2). Untuk kebutuhan "kirim ulang
      password", simpan salinan terenkripsi (AES-256-GCM) seperti pada mock server,
      atau ubah alur menjadi reset-link-only bila kebijakan keamanan ketat.
- [ ] Token `reset_url` bertanda tangan (HMAC/JWT) dan berumur pendek (≤30 menit).
- [ ] Rate limit per NIM maupun per IP; log semua percobaan dengan field `ref`.
