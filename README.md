# KOPRASI PLN AREA IV JAWA TIMUR

Versi statis GitHub Pages + Firebase. Tidak menggunakan NPM dan tidak perlu proses build.

Fitur utama mencakup stok, transaksi tunai/bon, cicilan, pelacakan, ekspor Excel, serta edit dan hapus pada transaksi, bon, barang, dan pembeli. Koreksi transaksi otomatis menyesuaikan stok dan sisa utang.

File utama:

- `index.html` — halaman aplikasi
- `style.css` — tampilan laptop dan ponsel
- `app.js` — alur aplikasi
- `firebase-data.js` — penyimpanan dan pembacaan Firestore
- `firebase-config.js` — konfigurasi project Firebase
- `firestore.rules` — pengamanan database
- `firestore.indexes.json` — konfigurasi indeks

Baca [PANDUAN.md](PANDUAN.md) sebelum mengunggah ke GitHub.
