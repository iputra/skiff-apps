# skemail-server

Kerangka backend GraphQL untuk `skemail-web`, dibangun dari kontrak di [`docs/skemail-web-api/schema.graphql`](../docs/skemail-web-api/schema.graphql).

Server ini **hanya menyimpan ciphertext**. Semua enkripsi dan dekripsi tetap terjadi di browser, sama seperti di Skiff asli. Server tidak pernah memegang kunci yang bisa membuka isi email.

## Yang sudah berfungsi

| Area | Operasi |
|---|---|
| Login | `loginSrp` (SRP 2 langkah, sesi via cookie), `provisionSrp`, `updateSrp` |
| User | `currentUser`, `user`, `users`, `usersFromEmailAlias(WithCatchall)`, `aliasDisplayInfo`, `fullAliasInfo`, `userPreferences` / `setUserPreferences`, `setDefaultEmailAlias`, `decryptionServicePublicKey` |
| Mailbox | `mailbox` (label sistem / label user, pagination cursor, filter read), `userThread`, `userThreads`, `unread`, `unreadAllLabels`, `numMailboxThreads`, `filteredThreadIDs` |
| Aksi thread | `setReadStatus`, `setAllThreadsReadStatus`, `applyLabels` / `removeLabels` (+ bulk), `bulkTrash`, `deleteThread`, `bulkDeleteTrashedThreads`, CRUD label user |
| Kirim | `sendMessage`, `replyToMessage` antar user lokal, termasuk lampiran |
| Lainnya | Draft (`allDrafts`, `createOrUpdateDraft`, `deleteDraft`), kontak, `attachments` + download lewat link bertanda tangan |

**Semua field lain** dari skema tetap ada, tapi mengembalikan nilai default yang valid secara tipe (`null`, `[]`, `''`, `false`, atau objek kosong yang field-nya ikut terisi default). Setiap field seperti itu dicatat sekali di log:

```
[stub] Query.getCurrentUserCustomDomains is not implemented; returning a default value
```

Log ini bisa dipakai sebagai daftar pekerjaan berikutnya.

### Belum ada
- **Pengiriman ke luar (SMTP) dan penerimaan dari luar (MX).** Penerima yang tidak punya akun di server ini hanya dicatat: `[send] external delivery not implemented`.
- `scheduleSendAt` disimpan, tapi email langsung dikirim.
- MFA, billing, custom domain, import, organisasi/tim, dan dokumen (semuanya masih stub).
- Tidak ada signup di skemail-web, jadi akun dibuat dengan skrip seed.

## Menjalankan

Langkah 1–2 cukup sekali.

```bash
# 1. Dependency monorepo
yarn

# 2. Library bersama (skiff-crypto dipakai oleh seed). Lihat "Catatan build library" di bawah.
(cd libs/skiff-utils && yarn node build.js)
(cd libs/skiff-crypto && yarn node build.js)

# 3. Buat akun demo: alice@skiff.local dan bob@skiff.local, password: password123
yarn seed:server
#    atau akun sendiri:  yarn seed:server carol@skiff.local:rahasia:Carol

# 4. Jalankan server (http://localhost:4000/graphql)
yarn dev:server
```

Untuk menyambungkan frontend, salin `skemail-web/.env.example` ke `skemail-web/.env` (isinya `SKEMAIL_API_BASE_URL=http://localhost:4000`), lalu jalankan `yarn dev` dan buka http://localhost:4200/mail/inbox.

Konfigurasi server ada di `.env` (contoh: [`.env.example`](./.env.example)): `PORT`, `PUBLIC_URL`, `CORS_ORIGINS`, `DATA_DIR`, `COOKIE_SECURE`, `LINK_SECRET`. Data tersimpan di `skemail-server/data/` (SQLite + file lampiran).

## Cara kerja

```
src/
  app.ts            Express + Apollo Server: CORS dengan credentials, cookie, upload multipart, batch request
  schema.ts         memuat docs/skemail-web-api/schema.graphql + resolver
  defaults.ts       fallback otomatis untuk field tanpa resolver
  context.ts        sesi: cookie skiff_session_<userID> + header x-skiff-userid
  scalars.ts        Date, PublicKey, JSON, Void, Upload
  resolvers/        auth, user, mailbox, send, drafts, contacts, attachments
  db/               SQLite (better-sqlite3), migrasi SQL, query
scripts/
  seed.ts           membuat akun seperti alur signup frontend
  clientCrypto.ts   kripto sisi klien (seed dan test), memakai libs/skiff-crypto
test/               vitest
```

- **Multi-akun.** Browser bisa login ke beberapa akun sekaligus. Karena itu tiap akun punya cookie sendiri (`skiff_session_<userID>`), dan header `x-skiff-userid` menentukan akun mana yang dipakai untuk satu request.
- **Thread per user.** Pengirim dan setiap penerima lokal punya salinan thread masing-masing, dengan label, status baca, dan session key terenkripsi milik mereka sendiri. Ini sesuai model `UserThread` di skema.
- **Lampiran.** Blob terenkripsi disimpan di disk. `downloadLink` adalah URL bertanda tangan HMAC yang berlaku 1 jam, karena frontend mengunduhnya dengan `axios.get` biasa yang tidak mengirim cookie lintas origin.
- **Argon2 di Node.** `argon2-browser` memuat wasm-nya lewat `fetch`, yang gagal di Node. `scripts/clientCrypto.ts` menyembunyikan `fetch` sementara supaya wasm dibaca dari disk. Wasm-nya sama dengan yang dipakai browser, jadi hash yang dihasilkan identik dan akun hasil seed bisa login dari UI.

## Test

```bash
yarn workspace skemail-server test        # vitest
yarn workspace skemail-server typecheck
yarn workspace skemail-server codegen     # setelah schema.graphql berubah
```

- `test/auth.test.ts` menguji login SRP penuh: `encryptedUserData` yang dikembalikan bisa didekripsi dengan password yang benar, sedangkan password salah ditolak.
- `test/send.test.ts`: alice → bob dengan konten dan session key terenkripsi asli, reply masuk ke thread yang sama, pemindahan ke TRASH, dan larangan mengirim dari alamat milik orang lain. Test ini memakai **teks operasi persis milik frontend** dari `docs/skemail-web-api/operations.graphql`.
- `test/contract.test.ts` menjalankan **setiap** operasi skemail-web (203) dengan variabel minimal, lalu memastikan tidak ada respons yang melanggar skema atau resolver yang crash.

## Catatan build library

`yarn build:lib` di repo upstream ini rusak di beberapa tempat:
- `libs/tsconfig.json` tidak ada. Sekarang sudah ditambahkan.
- `protos/` tidak berisi `com/skiff/editor/encrypted/encrypted_data.proto`.
- Script build memanggil workspace `@skiff-org/skiff-crypto` yang tidak ada (namanya `skiff-crypto`).
- Codegen `skiff-graphql` membuat ulang `completeSchema.graphql` dari `supergraph.graphql` yang sudah usang. Akibatnya `skiff-front-graphql` gagal divalidasi.

Bundle JS tiap library tetap bisa dibuat dengan `yarn node build.js` di folder masing-masing. Langkah `tsc` (file `.d.ts`) gagal, karena itu `tsconfig.json` server memetakan `skiff-crypto` / `skiff-graphql` / `skiff-utils` langsung ke source TS-nya. **Jangan commit** perubahan `libs/skiff-graphql/src/completeSchema.graphql` atau `types.ts` yang muncul setelah menjalankan `yarn build:lib`.
