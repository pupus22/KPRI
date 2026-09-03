# Tutorial GitHub Pages + Firebase Tanpa NPM

Ikuti urutan berikut. Anda hanya perlu mengedit `firebase-config.js`, lalu upload seluruh file ke GitHub.

## A. Buat project Firebase

1. Buka https://console.firebase.google.com/
2. Klik **Add project / Tambahkan project**.
3. Nama project: misalnya `koprasi-pln-area-iv`.
4. Google Analytics boleh dinonaktifkan.
5. Setelah selesai, klik ikon roda gigi → **Project settings**.

## B. Buat aplikasi Web Firebase

1. Di bagian **Your apps**, klik ikon Web `</>`.
2. Nama aplikasi: `Koprasi Web`.
3. Klik **Register app**.
4. Firebase menampilkan kode `firebaseConfig`.
5. Buka file `firebase-config.js` dari paket ini.
6. Ganti semua nilai `ISI_...` dengan nilai dari Firebase.

Contoh:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "koprasi-pln.firebaseapp.com",
  projectId: "koprasi-pln",
  storageBucket: "koprasi-pln.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Simpan file tersebut. Konfigurasi Web Firebase boleh berada di GitHub; keamanan data ditentukan oleh Authentication dan Firestore Rules.

## C. Buat database Firestore

1. Firebase Console → **Build → Firestore Database**.
2. Klik **Create database**.
3. Pilih **Standard edition** dan **Native mode** jika diminta.
4. Pilih **Start in production mode**.
5. Pilih lokasi terdekat, misalnya Jakarta jika tersedia.
6. Klik **Create**.

## D. Pasang aturan keamanan Firestore

1. Buka file `firestore.rules` dari paket ini memakai Notepad.
2. Salin seluruh isinya.
3. Firebase Console → **Firestore Database → Rules**.
4. Hapus rules lama dan tempel rules dari file tersebut.
5. Klik **Publish**.

Jangan pernah menggunakan `allow read, write: if true` karena database dapat dibaca dan diubah orang lain.

## E. Aktifkan login email dan password

1. Firebase Console → **Build → Authentication**.
2. Klik **Get started**.
3. Buka **Sign-in method**.
4. Pilih **Email/Password**, aktifkan, lalu **Save**.
5. Buka tab **Users** → **Add user**.
6. Masukkan email dan kata sandi petugas.
7. Setelah dibuat, salin nilai **User UID**.

## F. Beri izin kepada petugas

1. Firebase Console → **Firestore Database → Data**.
2. Klik **Start collection**.
3. Collection ID: `users`.
4. Document ID: tempel **User UID** tadi.
5. Tambahkan field berikut:

| Field | Type | Value |
|---|---|---|
| `active` | boolean | `true` |
| `name` | string | Nama petugas |
| `role` | string | `admin` |

6. Klik **Save**.

Ulangi langkah E–F jika ingin menambah petugas lain. Untuk menonaktifkan petugas, ubah `active` menjadi `false`.

## G. Upload file ke GitHub

1. Login ke https://github.com/
2. Klik **New repository**.
3. Nama repository: misalnya `koprasi-pln-area-iv`.
4. Pilih **Private** atau **Public**. GitHub Pages pada akun tertentu mungkin membutuhkan repository Public.
5. Klik **Create repository**.
6. Pilih **uploading an existing file**.
7. Upload semua file dari folder hasil ekstrak:

```text
index.html
style.css
app.js
firebase-data.js
firebase-config.js
firestore.rules
firestore.indexes.json
firebase.json
.firebaserc
README.md
PANDUAN.md
```

8. Pastikan `index.html` berada langsung di halaman utama repository, bukan di dalam folder tambahan.
9. Klik **Commit changes**.

## H. Aktifkan GitHub Pages

1. Repository GitHub → **Settings**.
2. Pilih **Pages**.
3. Pada **Build and deployment**, pilih **Deploy from a branch**.
4. Branch: `main`.
5. Folder: `/ (root)`.
6. Klik **Save**.
7. Tunggu sekitar 1–5 menit.

Alamat aplikasi akan berbentuk:

```text
https://USERNAME.github.io/koprasi-pln-area-iv/
```

## I. Izinkan alamat GitHub di Firebase Authentication

1. Salin bagian domain dari alamat GitHub Pages, misalnya `USERNAME.github.io`.
2. Firebase Console → **Authentication → Settings**.
3. Buka **Authorized domains**.
4. Klik **Add domain**.
5. Masukkan `USERNAME.github.io` tanpa `https://` dan tanpa nama repository.
6. Simpan.

Jika langkah ini dilewati, login di alamat GitHub Pages dapat ditolak Firebase.

## J. Tes aplikasi

1. Buka alamat GitHub Pages.
2. Login menggunakan akun petugas.
3. Tambahkan satu barang percobaan.
4. Coba transaksi tunai tanpa nama.
5. Buat pembeli dan coba transaksi bon.
6. Pada menu **Transaksi**, gunakan tombol **Edit** untuk mengoreksi item, jumlah, harga, pembeli, atau pembayaran. Alasan koreksi wajib diisi.
7. Gunakan tombol **Hapus** untuk membatalkan transaksi salah. Stok dikembalikan dan cicilan terkait dibalik secara otomatis; jejak pembatalannya tetap disimpan.
8. Menu **Bon**, **Barang**, dan **Pembeli** juga memiliki tombol **Edit** dan **Hapus**.
9. Menghapus barang akan menyembunyikannya dari pilihan penjualan baru. Stok dan riwayat lamanya tetap tersimpan untuk pelacakan.
10. Pembeli yang masih mempunyai bon tidak dapat dihapus sebelum bon dilunasi atau transaksi bon dibatalkan.
6. Coba pembayaran bon serta Ekspor Excel.

## Alur data yang dipakai

| Collection | Fungsi |
|---|---|
| `users` | Petugas yang boleh membuka aplikasi |
| `products` | Barang dan stok |
| `customers` | Pembeli bon |
| `sales` | Transaksi dan item belanja |
| `payments` | Pembayaran/cicilan bon |
| `stockMovements` | Riwayat perubahan stok |

## Catatan penting

- Tidak perlu Node.js, NPM, Terminal, atau proses build.
- Setiap revisi cukup edit file lalu upload ulang ke GitHub.
- GitHub Pages menjadi tempat aplikasi; Firebase menjadi login dan database.
- Data aplikasi lama tidak otomatis masuk ke Firebase baru.
- Gunakan **Ekspor Excel** secara berkala untuk laporan operasional.
