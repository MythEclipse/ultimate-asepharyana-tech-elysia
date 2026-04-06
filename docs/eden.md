# Client-side Eden

Eden adalah library klien yang dirancang khusus untuk ElysiaJS untuk memberikan sinkronisasi tipe data otomatis antara server dan klien.

## 1. Overview

Eden memungkinkan Anda mengonsumsi API Elysia dengan pengalaman pengembang yang mirip dengan memanggil fungsi lokal, lengkap dengan autocompletion dan validasi tipe data.

- [Dokumentasi Resmi - Eden Overview](https://elysiajs.com/eden/overview.html)

## 2. Treaty

Treaty adalah cara yang paling direkomendasikan untuk menggunakan Eden. Ini memberikan antarmuka bergaya objek untuk mengakses rute API Anda.

- **Type Safety**: Berbagi skema validasi dari server.
- **Params & Query**: Penanganan parameter URL dan query string secara otomatis.
- [Dokumentasi Resmi - Treaty](https://elysiajs.com/eden/treaty/overview.html)

## 3. Eden Fetch

Alternatif ringan untuk Treaty yang beroperasi lebih mirip dengan fungsi `fetch` standar namun tetap menjaga keamanan tipe data.

- [Dokumentasi Resmi - Eden Fetch](https://elysiajs.com/eden/fetch.html)

## 4. Web Socket Client

Dukungan penuh untuk klien Web Socket dengan sinkronisasi tipe pesan.

- [Dokumentasi Resmi - Eden WebSocket](https://elysiajs.com/eden/treaty/websocket.html)

---

> [!TIP]
> Gunakan `Eden Treaty` pada aplikasi frontend (React, Vue, Svelte) untuk mendapatkan pengalaman pengembangan _full-stack_ yang mulus.
