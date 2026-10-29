# CafeMatch Semarang

CafeMatch mencari kedai kopi secara langsung melalui Google Places API (New), menampilkan foto beserta atribusi yang tersedia, dan membuka hasil pada Google Maps. Tidak ada daftar kedai atau foto Google yang disimpan sebagai katalog proyek.

## Menjalankan aplikasi

1. Buat atau rotasi API key di Google Cloud. Aktifkan billing, **Maps JavaScript API**, dan **Places API (New)**.
2. Salin `.env.example` menjadi `.env.local`, lalu isi key yang sudah dibatasi:

   ```text
   VITE_GOOGLE_MAPS_API_KEY=key_baru_anda
   ```

3. Batasi key dengan HTTP referrer untuk domain deployment dan localhost yang diperlukan, serta batasi API key hanya ke Maps JavaScript API dan Places API. Variabel `VITE_` tersedia di browser; jangan pernah memakai key tanpa pembatasan atau memasukkannya ke source control.
4. Instal dependency dan jalankan Vite:

   ```sh
   npm install
   npm run dev
   ```

Setelah mengubah `.env.local`, mulai ulang Vite. Tanpa key, aplikasi tetap menampilkan layar setup tetapi tidak meminta data Google.

## Fitur

- Pencarian tipe kafe dan kedai kopi di 11 titik yang mencakup pusat kota dan area Kota Semarang; Places mengembalikan paling banyak 20 hasil per titik dan hasil dapat tumpang tindih.
- Filter radius dari titik awal, rating minimum, level harga, dan status buka; pengurutan berdasarkan rekomendasi, jarak, rating, atau jumlah ulasan.
- Peta, foto Google Maps dengan atribusi author yang dikembalikan Places, detail tempat, tautan Maps, berbagi, lokasi perangkat, favorit, dan catatan lokal.
- Pencarian Places dapat belum mencakup seluruh usaha di Semarang; jumlah maupun cakupan hasil ditentukan oleh relevansi dan batas layanan Google.

Data Places diminta langsung dari Google. CafeMatch menyimpan Place ID favorit, preferensi, dan catatan pada local storage perangkat; detail tempat dan foto diminta ulang saat digunakan. Baca [Kebijakan Privasi](./privacy.html) dan [Ketentuan Penggunaan](./terms.html).

## Validasi

```sh
npm test
npm run build
```
