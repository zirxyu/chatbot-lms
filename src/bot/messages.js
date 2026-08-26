const config = require('../config');

const { appName, appUrl, adminContact } = config;

const mono = (value) => `\`\`\`${value}\`\`\``;

function welcome() {
  return [
    `🎓 *${appName}*`,
    '',
    'Halo! 👋 Saya asisten virtual layanan akun mahasiswa.',
    '',
    'Silakan pilih menu dengan membalas angka:',
    '*1* — Daftar akun baru (verifikasi NIM)',
    '*2* — Ganti kata sandi',
    '*3* — Panduan penggunaan',
    '',
    '_Balas *batal* kapan saja untuk keluar dari sebuah proses._',
  ].join('\n');
}

function help() {
  return [
    '📖 *Panduan Penggunaan*',
    '',
    '*📝 Daftar akun baru*',
    '1. Balas *1*, lalu kirim NIM Anda.',
    '2. Masukkan kode verifikasi 6 digit yang dikirim ke email Anda.',
    '3. Buat kata sandi baru (minimal 8 karakter, kombinasi huruf dan angka).',
    '',
    '*🔑 Ganti kata sandi*',
    '1. Balas *2*, lalu kirim NIM Anda.',
    '2. Masukkan kode verifikasi 6 digit yang dikirim ke email Anda.',
    '3. Buat kata sandi baru (minimal 8 karakter, kombinasi huruf dan angka).',
    '',
    '*🔒 Catatan keamanan*',
    '• Jangan bagikan kata sandi atau kode verifikasi kepada siapa pun.',
    '• Hapus pesan yang berisi sandi/kode dari chat ini setelah digunakan.',
  ].join('\n');
}

function canceled() {
  return '✔️ Proses dibatalkan. Balas *menu* untuk menampilkan daftar menu kembali.';
}

function askNimForRegister() {
  return [
    '📝 *Pendaftaran Akun Baru*',
    '',
    'Kirimkan NIM Anda sekarang.',
    '',
    '_Balas *batal* untuk membatalkan._',
  ].join('\n');
}

function askNimForReset() {
  return [
    '🔑 *Ganti Kata Sandi*',
    '',
    'Kirimkan NIM Anda untuk menerima kode verifikasi via email.',
    '',
    '_Balas *batal* untuk membatalkan._',
  ].join('\n');
}

function checking() {
  return '⏳ Sedang memeriksa data di server, mohon tunggu sebentar...';
}

function registerSuccess(result) {
  return [
    '✅ *Pendaftaran Berhasil!*',
    '',
    'Akun Anda telah dibuat. 🎉',
    `📧 ${result.email}`,
    '',
    'Silakan masuk ke:',
    appUrl,
    '',
    'Gunakan email dan password yang baru saja Anda buat.',
  ].join('\n');
}

function alreadyRegistered() {
  return [
    '⚠️ *NIM Sudah Terdaftar*',
    '',
    'Akun dengan NIM tersebut sudah ada di sistem.',
    'Silakan login menggunakan akun yang sudah ada.',
    '',
    'Balas *2* jika ingin mengganti kata sandi.',
  ].join('\n');
}

function nimNotFound(nim) {
  return [
    '❌ *NIM Tidak Ditemukan*',
    '',
    `NIM ${mono(nim)} tidak terdaftar dalam sistem.`,
    '',
    `Pastikan NIM yang Anda kirim benar. Bila yakin sudah benar, hubungi ${adminContact}.`,
    '',
    '_Balas *1* untuk mencoba lagi, atau *batal* untuk keluar._',
  ].join('\n');
}

function invalidNimFormat() {
  return [
    '⚠️ *Format NIM Tidak Valid*',
    '',
    'NIM hanya boleh berisi angka (6–15 digit).',
    'Balas dengan NIM yang benar, atau balas *batal*.',
  ].join('\n');
}

function otpSent(result) {
  return [
    '🔐 *Kode Verifikasi Terkirim*',
    '',
    'Kode verifikasi (6 digit) telah dikirim ke:',
    `📧 ${result.emailMasked}`,
    '',
    'Berlaku selama *10 menit*.',
    'Balas pesan ini dengan kode tersebut.',
  ].join('\n');
}

function invalidOtpInput() {
  return '⚠️ Kode verifikasi harus berupa 6 digit angka. Silakan balas dengan kode yang benar.';
}

function askNewPassword() {
  return [
    '🔑 *Buat Kata Sandi Baru*',
    '',
    'Balas dengan kata sandi baru Anda.',
    '',
    'Syarat:',
    '• Minimal 8 karakter',
    '• Mengandung huruf dan angka',
    '• Tanpa spasi',
    '',
    '_Balas *batal* untuk membatalkan._',
  ].join('\n');
}

function weakPassword() {
  return [
    '⚠️ Kata sandi belum memenuhi syarat:',
    '• Minimal 8 karakter',
    '• Kombinasi huruf dan angka',
    '• Tanpa spasi',
    '',
    'Balas dengan kata sandi lain, atau balas *batal*.',
  ].join('\n');
}

function passwordUpdated() {
  return [
    '✅ *Berhasil!*',
    '',
    'Kata sandi akun Anda telah diperbarui.',
    `Silakan masuk ke ${appUrl} menggunakan kata sandi baru.`,
    '',
    '_Tips keamanan: hapus riwayat pesan ini dari perangkat Anda._',
  ].join('\n');
}

function wrongOtp(attemptsLeft) {
  return [
    '❌ *Kode Verifikasi Salah*',
    '',
    `Sisa percobaan: *${attemptsLeft}*`,
    'Balas dengan kode yang benar, atau balas *batal*.',
  ].join('\n');
}

function otpExpired() {
  return [
    '⏰ *Kode Verifikasi Kedaluwarsa*',
    '',
    'Kode verifikasi sudah tidak berlaku.',
    'Balas *1* atau *2* untuk meminta kode baru.',
  ].join('\n');
}

function tooManyAttempts() {
  return [
    '⛔ *Terlalu Banyak Percobaan*',
    '',
    'Anda telah melebihi batas maksimum percobaan.',
    `Silakan coba lagi nanti atau hubungi ${adminContact}.`,
  ].join('\n');
}

function cooldown(waitSeconds) {
  const minutes = Math.ceil(waitSeconds / 60);
  return `⏳ Mohon tunggu *${minutes} menit* sebelum meminta kode verifikasi ulang.`;
}

function genericFailure() {
  return [
    '🚫 *Terjadi Kendala*',
    '',
    'Maaf, sistem sedang tidak dapat memproses permintaan Anda.',
    '',
    `_Bila masalah berlanjut, hubungi ${adminContact}._`,
  ].join('\n');
}

function rateLimited() {
  return [
    `⛔ Terlalu banyak percobaan dalam ${config.limits.windowMinutes} menit terakhir.`,
    '',
    `Untuk keamanan akun, silakan coba lagi nanti atau hubungi ${adminContact}.`,
  ].join('\n');
}

module.exports = {
  welcome,
  help,
  canceled,
  askNimForRegister,
  askNimForReset,
  checking,
  registerSuccess,
  alreadyRegistered,
  nimNotFound,
  invalidNimFormat,
  otpSent,
  invalidOtpInput,
  askNewPassword,
  weakPassword,
  passwordUpdated,
  wrongOtp,
  otpExpired,
  tooManyAttempts,
  cooldown,
  genericFailure,
  rateLimited,
};
