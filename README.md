# CafeMatch — Sistem Pakar Kafe Semarang

CafeMatch adalah demo sistem pakar rekomendasi tempat kopi di Kota Semarang. Mesin inferensi menggunakan forward chaining untuk menyaring data berdasarkan titik awal, radius, kecamatan, fasilitas yang tercatat, dan suasana.

## Menjalankan aplikasi

```sh
npm install
npm run dev
```

Inferensi dan basis pengetahuan berjalan lokal di browser. Aplikasi tidak memakai Google Maps, Places API, kunci API, atau API pencarian tempat langsung. Peta dibuat dengan Leaflet dan React Leaflet; peta dasar memakai tile OpenStreetMap melalui koneksi jaringan. Jarak dan radius dihitung di browser.

Lokasi perangkat opsional. Aplikasi hanya meminta izin setelah pengguna menekan “Gunakan lokasi saya”. Koordinat dipakai sementara di browser, tidak disimpan, dan tidak dikirim ke server aplikasi. Gunakan localhost atau HTTPS untuk mengaktifkan geolocation.

## Basis pengetahuan dan sumber data

Basis pengetahuan memiliki 163 tempat unik: 67 objek OSM bertag `amenity=cafe` atau `shop=coffee`, 64 listing unik dari 72 listing kategori Coffee Shop pada [Direktori Kota Semarang](https://direktori.semarangkota.go.id/), 11 listing tambahan Ngaliyan, dan 21 listing kedai kopi dari pencarian manual [Google Maps](https://www.google.com/maps/). Delapan listing direktori yang duplikat dengan data yang sudah ada tidak dimasukkan lagi. Snapshot data diambil pada 5 November 2026; nama, alamat, dan tautan sumber tersedia pada setiap kartu. Aplikasi tidak memanggil Google Maps API; peta tetap menggunakan Leaflet dan tile OpenStreetMap.

Semua 16 kecamatan Kota Semarang tersedia di filter dan memiliki setidaknya satu listing bersumber. Koordinat 67 objek OSM dicocokkan dengan batas kecamatan administratif OSM. Listing Google Maps menambah tempat di Gayamsari, Genuk, Pedurungan, dan Tugu, yang belum terwakili pada data sebelumnya. Cakupan ini bukan inventaris lengkap semua tempat yang beroperasi. Basis pengetahuan memiliki 13 tempat di Ngaliyan: dua objek OSM dan 11 listing tambahan. Listing manual Ngaliyan bersumber dari [Direktori Kota Semarang](https://direktori.semarangkota.go.id/loc/ngaliyan/) dan [artikel tempat ngopi Ngaliyan dari SemarangBawah](https://semarangbawah.com/cafe-ngaliyan/).

Fitur suasana menyediakan pilihan santai, nongkrong, kerja/belajar, outdoor, pemandangan, dan ramah keluarga. Label suasana hanya diambil dari deskripsi listing; tempat yang tidak memiliki label tidak dianggap cocok saat filter suasana dipakai. Untuk Sora Kafe, Folkafe Ngaliyan, Wardana Kopi View Laut, Kopi Nuri Ngaliyan, dan Noms Kopi Ngaliyan, sumber yang ditemukan hanya memberi alamat/kawasan, bukan koordinat tempat; pin dan jaraknya merupakan perkiraan kawasan dan ditandai di aplikasi. Data adalah snapshot statis, bukan pencarian API langsung. Fasilitas dan jam buka yang tidak tercantum diperlakukan sebagai “belum ada data”; periksa sumber sebelum berkunjung. Data dapat tidak lengkap atau berubah dan tidak menjamin semua tempat yang beroperasi sudah terdaftar.

Data OpenStreetMap tersedia di bawah [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright). Atribusi: © OpenStreetMap contributors. Listing direktori dan listing Ngaliyan memiliki sumber masing-masing di kartu; atribusi ODbL hanya untuk data OSM. Tile peta juga berasal dari server tile OpenStreetMap dan mematuhi [kebijakan penggunaan tile](https://operations.osmfoundation.org/policies/tiles/); koneksi tile mengirim permintaan jaringan browser. Lisensi data tidak mengubah lisensi kode aplikasi.

## Sistem pakar

Aturan R1–R9 memeriksa cakupan wilayah Semarang, radius, kecocokan syarat Wi-Fi dan area luar, identifikasi tempat kopi, kecocokan kecamatan dan suasana, kelayakan kandidat, serta prioritas hasil. Jejak inferensi ditampilkan pada setiap hasil. Favorit dan preferensi disimpan lokal di browser.

Lihat [Kebijakan Privasi](./privacy.html) dan [Ketentuan Penggunaan](./terms.html).

## Validasi

```sh
npm test
npm run build
npm run lint
```
