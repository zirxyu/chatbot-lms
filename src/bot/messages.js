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
    '2. Jika NIM terdaftar di sistem, akun langsung dibuat dan username serta kata sandi dikirim ke email Anda.',
    '',
    '*🔑 Ganti kata sandi*',
    '1. Balas *2*, lalu kirim NIM Anda.',
    '2. Masukkan kode verifikasi yang dikirim ke email Anda.',
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
    `Contoh: ${mono('2109119012')}`,
    '',
    '_Balas *batal* untuk membatalkan._',
  ].join('\n');
}

function askNimForReset() {
  return [
    '🔑 *Ganti Kata Sandi*',
    '',
    'Kirimkan NIM Anda untuk menerima kode verifikasi via email.',
    `Contoh: ${mono('2109119012')}`,
    '',
    '_Balas *batal* untuk membatalkan._',
  ].join('\n');
}

function checking() {
  return '⏳ Sedang memeriksa data di server, mohon tunggu sebentar...';
}

function registerSuccess(result) {
  return [
    '✅ *Verifikasi Berhasil!*',
    '',
    'Selamat, akun Anda telah dibuat. 🎉',
    'Username dan kata sandi awal telah dikirim ke:',
    `📧 ${result.email}`,
    '',
    'Silakan cek kotak masuk (atau folder *Spam/Promosi*), lalu masuk ke:',
    appUrl,
    '',
    '_Segera ganti kata sandi Anda setelah login pertama._',
  ].join('\n');
}

function alreadyRegistered(result) {
  const parts = [
    '⚠️ *NIM Sudah Terdaftar*',
    '',
    'Akun dengan NIM tersebut sudah ada di sistem.',
    'Username, kata sandi saat ini, beserta tautan khusus untuk mengganti kata sandi telah dikirim ke:',
    `📧 ${result.email}`,
    '',
    '_Cek folder *Spam/Promosi* bila email tidak ditemukan._',
  ];
  return parts.join('\n');
}

function nimNotFound(nim) {
  return [
    '❌ *NIM Tidak Ditemukan*',
    '',
    `NIM ${mono(nim)} tidak terdaftar dalam sistem, sehingga permintaan pembuatan akun *ditolak*.`,
    '',
    `Pastikan NIM yang Anda kirim benar. Bila Anda yakin NIM sudah benar, hubungi ${adminContact}.`,
    '',
    '_Balas *1* untuk mencoba lagi._',
  ].join('\n');
}

function noAccount() {
  return [
    'ℹ️ *Belum Memiliki Akun*',
    '',
    'NIM Anda terdaftar di akademik, tetapi belum memiliki akun LMS.',
    '',
    'Balas *1* untuk membuat akun terlebih dahulu.',
  ].join('\n');
}

function invalidNimFormat() {
  return [
    '⚠️ *Format NIM Tidak Valid*',
    '',
    'NIM hanya boleh berisi angka (6–15 digit), tanpa huruf atau simbol.',
    'Balas dengan NIM yang benar, atau balas *batal*.',
  ].join('\n');
}

function otpSent(result) {
  return [
    '🔐 *Kode Verifikasi Terkirim*',
    '',
    'Kode verifikasi (6 digit) telah dikirim ke:',
    `📧 ${mono(result.emailMasked)}`,
    '',
    `Berlaku selama *${result.expiresInMinutes} menit*.`,
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
    'Syarat kata sandi:',
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

function resetFailed(result) {
  if (result.kind === 'invalid_code') {
    return [
      '❌ *Kode Tidak Valid*',
      '',
      'Kode verifikasi salah atau sudah kedaluwarsa.',
      'Balas *2* untuk meminta kode baru.',
    ].join('\n');
  }
  return genericFailure(result);
}

function otpRequestFailed(result, nim) {
  if (result.kind === 'invalid') return nimNotFound(nim);
  if (result.kind === 'no_account') return noAccount();
  if (result.kind === 'throttled') {
    return '⏳ Permintaan kode terlalu sering. Tunggu sekitar satu menit, lalu ulangi dari menu *2*.';
  }
  return genericFailure(result);
}

function genericFailure(result = {}) {
  const parts = [
    '🚫 *Terjadi Kendala*',
    '',
    'Maaf, sistem sedang tidak dapat memproses permintaan Anda.',
  ];
  if (result.ref) parts.push(`Kode referensi: ${mono(result.ref)}`);
  parts.push('', `_Bila masalah berlanjut, hubungi ${adminContact}._`);
  return parts.join('\n');
}

function rateLimited() {
  return [
    `⛔ Terlalu banyak percobaan dalam ${config.limits.windowMinutes} menit terakhir.`,
    '',
    'Untuk keamanan akun, silakan coba lagi nanti atau hubungi ' + adminContact + '.',
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
  noAccount,
  invalidNimFormat,
  otpSent,
  invalidOtpInput,
  askNewPassword,
  weakPassword,
  passwordUpdated,
  resetFailed,
  otpRequestFailed,
  genericFailure,
  rateLimited,
};
