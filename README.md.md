# Aplikasi Absensi Online PPNPN Kantor GTK Provinsi Maluku Utara

Aplikasi absensi online berbasis lokasi untuk pegawai PPNPN Kantor Guru dan Tenaga Kependidikan Provinsi Maluku Utara.

## 📋 Fitur Utama

- ✅ **Autentikasi berbasis NIK dan password**
- 📍 **Absensi dengan verifikasi lokasi GPS**
- 🗺️ **Peta interaktif dengan marker kantor**
- 📊 **Dashboard statistik kehadiran**
- 👥 **Panel admin untuk manajemen data**
- 📱 **Responsive design untuk mobile**

## 🚀 Cara Install dan Deploy

### 1. Setup Supabase Database

1. Daftar akun di [Supabase](https://supabase.com)
2. Buat project baru
3. Buka SQL Editor dan jalankan script dari file `supabase-setup.sql`
4. Catat **Project URL** dan **anon public key** dari Settings > API

### 2. Update Konfigurasi

1. Buka file `script.js`
2. Ganti nilai variabel di bagian atas file:
   ```javascript
   const SUPABASE_URL = 'https://your-project-ref.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';