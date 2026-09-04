# KOPRASI PLN AREA IV JAWA TIMUR

Versi statis GitHub Pages + Firebase. Tidak menggunakan NPM dan tidak perlu proses build.

Fitur utama mencakup stok, transaksi tunai/bon, cicilan, pelacakan, ekspor Excel, serta edit dan hapus pada transaksi, bon, barang, dan pembeli. Koreksi transaksi otomatis menyesuaikan stok dan sisa utang.

Penghapusan dilakukan secara permanen pada dokumen Firebase yang terkait. Saat transaksi dihapus, stok dan alokasi cicilan otomatis dikembalikan agar perhitungan tetap benar. Ekspor Excel hanya mengambil data aktif dan menyediakan pilihan tanggal awal–akhir untuk data transaksi, pembayaran bon, dan pergerakan stok.

Harga pada transaksi selalu mengikuti **Harga Jual** di Master Barang dan tidak dapat diketik atau diubah dari halaman transaksi.

Uang lebih dari transaksi tunai dapat dialokasikan otomatis ke beberapa bon milik pembeli dengan urutan bon paling lama terlebih dahulu (FIFO). Setiap alokasi tersimpan dan dapat ditelusuri dua arah antara transaksi pembayaran dan bon tujuan.

File utama:

- `index.html` — halaman aplikasi
- `style.css` — tampilan laptop dan ponsel
- `app.js` — alur aplikasi
- `firebase-data.js` — penyimpanan dan pembacaan Firestore
- `firebase-config.js` — konfigurasi project Firebase
- `firestore.rules` — pengamanan database
- `firestore.indexes.json` — konfigurasi indeks

Baca [PANDUAN.md](PANDUAN.md) sebelum mengunggah ke GitHub.
