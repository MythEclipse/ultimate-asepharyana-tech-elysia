# Core Features (Essential)

Daftar fitur dasar yang wajib dipahami untuk membangun aplikasi dengan ElysiaJS.

## 1. Routing

Routing adalah bagaimana Elysia menentukan handler mana yang akan menangani permintaan berdasarkan URL dan metode HTTP.

- **Static Routing**: `/abc`
- **Dynamic Path**: `/user/:id`
- **Wildcard**: `/all/*`
- [Dokumentasi Resmi - Route](https://elysiajs.com/essential/route.html)

## 2. Handler

Fungsi yang menerima konteks dan mengembalikan respons. Konteks berisi data seperti `body`, `query`, `params`, `headers`, dan lainnya.

- [Dokumentasi Resmi - Handler](https://elysiajs.com/essential/handler.html)

## 3. Validation (TypeBox)

Elysia menggunakan TypeBox untuk skema validasi. Anda dapat menvalidasi `body`, `query`, `params`, dan `headers` secara deklaratif.

- [Dokumentasi Resmi - Validation](https://elysiajs.com/essential/validation.html)

## 4. Lifecycle (Hooks)

Urutan eksekusi permintaan dalam Elysia:

- `onRequest`
- `onBeforeHandle`
- `onHandle` (Handler utama)
- `onAfterHandle`
- `onResponse`
- `onError` (Middleware penanganan error)
- [Dokumentasi Resmi - Life Cycle](https://elysiajs.com/essential/life-cycle.html)

## 5. Plugin

Mekanisme untuk membagi kode menjadi modul-modul kecil yang dapat digunakan kembali. Digunakan untuk middleware, rute, atau fungsionalitas tambahan lainnya.

- [Dokumentasi Resmi - Plugin](https://elysiajs.com/essential/plugin.html)

## 6. Best Practices

Memahami cara menulis kode Elysia yang efisien, aman, dan mudah dipelihara.

- [Dokumentasi Resmi - Best Practice](https://elysiajs.com/essential/best-practice.html)

---

> [!IMPORTANT]
> Selalu gunakan `Elysia.t` (TypeBox) untuk validasi data guna memastikan keamanan tipe data secara _end-to-end_.
