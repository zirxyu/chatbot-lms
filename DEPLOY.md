# Instruksi Deployment — WhatsApp Chatbot LMS

> Repository: [zirxyu/chatbot-lms](https://github.com/zirxyu/chatbot-lms)

---

## 1. Prasyarat Server

| Komponen | Versi Minimum |
|----------|---------------|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |
| Google Chrome / Chromium | Latest (untuk puppeteer) |
| OS | Ubuntu 20.04+ / Debian 11+ |

### Install dependencies system (Ubuntu/Debian)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Chromium (agar puppeteer tidak perlu download sendiri)
sudo apt install -y chromium-browser
```

> **Catatan:** Puppeteer butuh Chromium. Kalau pakai `chromium-browser` dari apt, puppeteer otomatis pakai itu. Kalau mau pakai Chromium yang di-download puppeteer sendiri, tidak perlu install `chromium-browser`.

---

## 2. Clone & Install

```bash
cd /opt
git clone https://github.com/zirxyu/chatbot-lms.git
cd chatbot-lms

npm install
```

---

## 3. Konfigurasi Environment

```bash
cp .env.example .env
nano .env
```

Edit nilai berikut:

```env
# ============ Identitas ============
APP_NAME=LMS-FT-UNMUL
APP_URL=https://lms.ft.unmul.ac.id          # URL frontend LMS
ADMIN_CONTACT=admin@ft.unmul.ac.id

# ============ WhatsApp ============
SESSION_DIR=./session
PAIRING_PHONE=62895385979441                # Nomor WA bot (tanpa +)
BOT_OWNER=                                   # (opsional) Nomor WA admin
ALLOW_GROUPS=false
MARK_READ=true
RECONNECT_MS=5000
LOG_LEVEL=info

# ============ Server LMS (API) ============
LMS_API_URL=https://lms.ft.unmul.ac.id/api  # URL backend Laravel
LMS_API_KEY=secret-chatbot-key-smakensaft-unmul  # Harus sama dengan CHATBOT_API_TOKEN di .env Laravel
REQUEST_TIMEOUT_MS=15000

# ============ Format NIM ============
NIM_PATTERN="^[0-9]{6,15}$"

# ============ Batasan ============
MAX_VERIFY_ATTEMPTS=5
RATE_WINDOW_MIN=60
SESSION_TTL_MIN=5
```

**Poin penting:**
- `LMS_API_URL` harus diakhiri `/api` (contoh: `https://lms.ft.unmul.ac.id/api`)
- `LMS_API_KEY` harus **sama persis** dengan `CHATBOT_API_TOKEN` di `.env` Laravel
- `PAIRING_PHONE` adalah nomor WhatsApp yang akan jadi bot (format internasional tanpa `+`)

---

## 4. Jalankan Bot (Pertama Kali — Pairing QR)

```bash
cd /opt/chatbot-lms
npm start
```

Pertama kali dijalankan, bot akan menampilkan **QR code di terminal**. Scan QR tersebut dari WhatsApp di HP:
1. Buka WhatsApp → Titik tiga → Perangkat Tertaut → Tautkan Perangkat
2. Scan QR yang muncul di terminal

Setelah scan berhasil, session akan tersimpan di folder `./session/`. Bot akan otomatis login dijalankan berikutnya.

---

## 5. Jalankan sebagai Service (Production)

Buat systemd service agar bot otomatis jalan dan restart saat crash:

```bash
sudo nano /etc/systemd/system/chatbot-lms.service
```

Isi file:

```ini
[Unit]
Description=WhatsApp Chatbot LMS FT UNMUL
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chatbot-lms
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=chatbot-lms

[Install]
WantedBy=multi-user.target
```

Aktifkan dan jalankan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable chatbot-lms
sudo systemctl start chatbot-lms
```

### Cek status & logs

```bash
# Status
sudo systemctl status chatbot-lms

# Logs (live)
sudo journalctl -u chatbot-lms -f

# Restart
sudo systemctl restart chatbot-lms

# Stop
sudo systemctl stop chatbot-lms
```

---

## 6. Folder Penting

| Folder | Fungsi |
|--------|--------|
| `session/` | Data sesi WhatsApp (otomatis dibuat, **jangan di-push ke git**) |
| `data/` | Data database lokal (jika ada) |
| `qr.png` | QR code terakhir (generated, **jangan di-push**) |
| `src/` | Source code bot |
| `.env` | Konfigurasi rahasia (**jangan di-push**) |

---

## 7. Troubleshooting

### Bot tidak bisa connect ke API Laravel
```bash
# Cek apakah URL bisa diakses
curl -X POST https://lms.ft.unmul.ac.id/api/chatbot/check-nim \
  -H "Content-Type: application/json" \
  -H "X-Chatbot-Token: secret-chatbot-key-smakensaft-unmul" \
  -d '{"nomer_induk":"2109106001"}'
```

### Bot logout / session corrupt
```bash
# Hapus session lama
rm -rf /opt/chatbot-lms/session/*
sudo systemctl restart chatbot-lms
# Scan QR lagi
```

### Puppeteer error (Chrome not found)
```bash
# Install Chromium
sudo apt install -y chromium-browser

# Atau set path manual di .env
# Tambahkan env variable:
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### Bot crash berulang kali
```bash
# Cek logs
sudo journalctl -u chatbot-lms -n 50 --no-pager

# Jika terlalu banyak restart, bot akan berhenti otomatis (MAX_RESTART=5)
# Reset restart counter dengan restart service
sudo systemctl restart chatbot-lms
```

---

## 8. Checklist Sebelum Deploy

- [ ] `LMS_API_URL` sudah benar (akhiri `/api`)
- [ ] `LMS_API_KEY` sama dengan `CHATBOT_API_TOKEN` di Laravel `.env`
- [ ] `PAIRING_PHONE` sudah benar (format 62xxxxxxxxxxx)
- [ ] Server bisa akses `LMS_API_URL` dari terminal (`curl`)
- [ ] Chromium sudah terinstall
- [ ] `session/` folder kosong atau berisi sesi yang valid
