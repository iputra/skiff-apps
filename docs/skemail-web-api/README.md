# Spesifikasi API backend untuk skemail-web

Dokumen ini menjelaskan API yang harus disediakan backend supaya `skemail-web` (Skiff Mail web) bisa berjalan dengan data sungguhan, bukan mock. Backend asli Skiff tidak pernah dirilis, jadi spec ini diturunkan dari kode frontend.

| File | Isi |
|---|---|
| [`schema.graphql`](./schema.graphql) | **Kontrak API utama.** Skema GraphQL minimal: hanya root field, field objek, argumen, dan tipe yang benar-benar dipakai skemail-web. |
| [`operations.md`](./operations.md) | Katalog semua operasi yang dikirim skemail-web, dikelompokkan per domain, beserta file pemakainya. |
| [`operations.graphql`](./operations.graphql) | Teks persis setiap operasi (dan fragment-nya) yang akan diterima server. Bisa dipakai untuk test kontrak. |
| [`stats.json`](./stats.json) | Ringkasan angka hasil generator. |

`schema.graphql`, `operations.*`, dan `stats.json` **dibuat otomatis**. Jangan diedit manual. Untuk membuat ulang (misalnya setelah frontend berubah):

```bash
yarn            # sekali, untuk memasang dependency `graphql`
yarn spec:skemail-api
```

## Ringkasan

| | Jumlah |
|---|---|
| Operasi yang didefinisikan di `libs/skiff-front-graphql/graphql` | 287 |
| Operasi yang dipakai skemail-web | **203** (88 query, 115 mutation) |
| Root field `Query` yang harus diimplementasi | 65 |
| Root field `Mutation` yang harus diimplementasi | 114 |
| Tipe di skema subset / skema lengkap | 328 / 497 |
| Subscription GraphQL / WebSocket | Tidak ada. Update didapat lewat polling. |

## Cara spec ini dibuat

Generator ada di [`scripts/skemail-api-spec/generate.js`](../../scripts/skemail-api-spec/generate.js):

1. **Menelusuri import** mulai dari semua file di `skemail-web/src`. Generator mengikuti import relatif dan named import dari `skiff-front-utils`, `skiff-front-graphql`, dan `skiff-front-search` sampai ke file yang mendefinisikannya. Hasilnya ±1.100 file yang ikut ter-bundle.
2. **Mencari operasi yang dipakai** di file-file itu, lewat identifier hasil codegen (`useXQuery`, `useXLazyQuery`, `useXMutation`, `XDocument`). File `generated/` dikecualikan karena isinya mendefinisikan semua hook.
3. **Memotong skema** `libs/skiff-graphql/src/completeSchema.graphql` hanya ke bagian yang disentuh operasi tersebut. Field `@client` dibuang karena dihitung di browser oleh Apollo type policy (misalnya `decryptedSubject`), bukan oleh server.
4. **Validasi mandiri.** Setiap operasi divalidasi terhadap skema lengkap *dan* skema subset. Generator gagal kalau ada yang tidak cocok.

**Batasan:** penelusuran import dilakukan per file, bukan per fungsi. Karena itu beberapa operasi dari `skiff-front-utils` (misalnya `shareDoc`, `getDocumentFull`, `createTeam`) ikut terhitung walaupun mungkin hanya dipakai oleh fitur Pages/Drive yang kebetulan berbagi file. Di `operations.md`, kolom *Used in* menunjukkan apakah operasi dipakai langsung dari `skemail-web/src` atau hanya lewat library bersama. Operasi yang hanya lewat library bersama adalah kandidat untuk diabaikan dulu.

## Transport

Diambil dari `skemail-web/src/apollo/client.ts`.

- **Endpoint:** `POST {API_BASE_URL}/graphql`. Saat lokal (`http://localhost:1212`), frontend memanggil `http://localhost:4000/graphql`. Selain itu dipakai env `SKEMAIL_API_BASE_URL`.
- **Query** dikirim lewat `BatchHttpLink`. Body request bisa berupa **array** beberapa operasi sekaligus, jadi server harus mendukung *batched requests* (Apollo Server: `allowBatchedHttpRequests: true`).
- **Mutation** dikirim lewat `apollo-upload-client`, mengikuti [GraphQL multipart request spec](https://github.com/jaydenseric/graphql-multipart-request-spec). Server harus mendukung scalar `Upload` (dipakai `EncryptedFileInput.encryptedFile` dan `ImportEmlEmailRequest.emlFiles`).
- **Cookie:** semua request memakai `credentials: 'include'`. Sesi disimpan di cookie, jadi CORS harus mengizinkan origin frontend dengan `Access-Control-Allow-Credentials: true`.
- **Header `x-skiff-userid`:** dikirim di setiap request, berisi userID yang sedang aktif (`SKIFF_USERID_HEADER_NAME` di `libs/skiff-utils/src/constants.ts`). Satu browser bisa login ke beberapa akun sekaligus, dan header ini menentukan akun mana yang dipakai untuk request tersebut.
- **Polling:** mailbox di-refresh dengan `pollInterval` dan `MailboxRequest.polling: true` (`components/mailbox/Mailbox.tsx`). Tidak ada endpoint realtime.

### Scalar khusus

| Scalar | Bentuk di wire |
|---|---|
| `Date` | Timestamp. Frontend mem-parse-nya menjadi `Date` (`apollo/date.ts`). |
| `PublicKey` | Objek `{ key: string, signature?: string }`, key berupa base64. |
| `PublicKeyWithSignature` | `{ key: string, signature: string }` |
| `JSON` | JSON bebas |
| `Upload` | File multipart (lihat di atas) |
| `Void` | Mutation tanpa nilai balik |

## Autentikasi (SRP)

Server **tidak pernah** menerima password. Alurnya memakai SRP (Secure Remote Password) dan dua kali memanggil mutation `loginSrp`:

1. **`loginSrpStep1`**: client mengirim `{ username, step: 1 }`, lalu server membalas `salt` dan `serverEphemeralPublic`.
2. **`loginSrpStep2`**: client mengirim `{ username, step: 2, clientEphemeralPublic, clientSessionProof, tokenMFA? }`. Server memverifikasi proof, memasang cookie sesi, lalu membalas `LoginSrpResponse`. Isinya antara lain `serverSessionProof`, `userID`, `publicKey`, `signingPublicKey`, **`encryptedUserData`** (private key user yang dienkripsi dengan kunci turunan password), `jwt`, `mfaTypes`, dan `status`.

Saat registrasi atau ganti password, client mengirim verifier SRP lewat `provisionSrp` / `updateSrp`. Server cukup menyimpan salt, verifier, dan blob terenkripsi. Server tidak perlu bisa mendekripsinya.

## Model data dan enkripsi

Prinsip yang harus dipegang backend: **server menyimpan dan meneruskan ciphertext**. Field `encrypted*` adalah blob base64 buram yang tidak boleh diubah.

- **Email** (`Email`) berisi `encryptedSubject`, `encryptedText`, `encryptedHtml`, dan seterusnya, ditambah `encryptedSessionKey { encryptedSessionKey, encryptedBy }`. Session key dienkripsi untuk *masing-masing* penerima. Jadi server harus mengembalikan salinan session key milik user yang sedang login.
- **Kirim email** (`sendMessage` / `sendReplyMessage` → `replyToMessage`) memakai `SendEmailRequest`, yang berisi konten terenkripsi, `to/cc/bcc` (`SendAddressRequest` berisi `encryptedSessionKey` per penerima), dan `rawSubject`. Penerima di luar Skiff tidak punya kunci. Untuk mereka, client mengenkripsi session key ke `decryptionServicePublicKey` (`externalEncryptedSessionKey`), dan server memakainya untuk membuat MIME lalu mengirim lewat SMTP.
- **Kunci publik penerima** diambil lewat `usersFromEmailAliasWithCatchall` sebelum email dikirim (`libs/skiff-front-graphql/src/crypto/encryptMessageUtils.ts`). Hasilnya berupa daftar `User` dengan `publicKey`. **Urutan dan panjang hasil harus sama persis dengan input `emailAliases`**, karena client mencocokkan berdasarkan indeks. Alamat yang tidak dikenal (bukan user Skiff) harus berisi `null` di posisinya, sehingga client tahu harus memakai jalur penerima eksternal. Domain email konsumen umum (Gmail dan sejenisnya) tidak dikirim ke query ini.
- **Thread dan label**: `UserThread` (key `threadID`) memiliki `attributes.userLabels` / `systemLabels`. Pagination mailbox memakai `MailboxRequest.cursor` dan `Mailbox.pageInfo`.

## Endpoint non-GraphQL

Frontend juga memanggil beberapa URL di luar `/graphql`:

| Kebutuhan | Bagaimana frontend memanggilnya | Yang harus disediakan backend |
|---|---|---|
| Download lampiran | `GET Attachment.downloadLink` (`components/Attachments/useAttachments.ts`). Responsnya teks datagram terenkripsi, didekripsi di client. | URL (misalnya presigned S3) yang mengembalikan blob lampiran terenkripsi |
| Export `.eml` | `GET attachment.downloadLink` (`utils/exportEml.ts`) | Sama seperti di atas |
| Import MBOX | `getMboxImportUrl` mengembalikan `uploadData` (JSON `{ url, fields }`), lalu `POST` multipart ke `url` (`ImportMbox.utils.ts`) | Presigned POST (format S3), lalu `importMboxEmails({ fileID })` |
| Upload avatar | `createUpload*AvatarLink` mengembalikan URL upload | Presigned upload URL |
| Kunci PGP penerima (WKD) | `GET {proxy}/wkd_proxy_advanced/?domain=&address=&hash=` dan `/wkd_proxy_direct/...` (`libs/skiff-crypto-v2/src/pgp/keyManagement.ts`) | Proxy ke `/.well-known/openpgpkey/...` milik domain penerima. Saat lokal proxy diharapkan di `http://localhost:9999`. |
| Proxy gambar eksternal | `{proxy}/image_proxy/?...` (`libs/skiff-front-utils/src/utils/domUtils.ts`) | Proxy gambar supaya IP pembaca tidak bocor ke pengirim |

## Prioritas implementasi (saran)

Kalau tujuannya inbox yang bisa dipakai, kerjakan bertahap. Nama di bawah adalah nama operasi (lihat `operations.md`). Nama root field ada dalam kurung jika berbeda.

**Tahap 1: login dan membaca email**
`loginSrpStep1`, `loginSrpStep2` (`loginSrp`), `provisionSrp`, `currentUser`, `getUserProfileData` (`user`), `currentUserEmailAliases`, `currentUserDefaultEmailAlias`, `getUserPreferences`, `userLabels`, `mailbox`, `getThreadFromID` (`userThread`), `getThreadsFromIDs` (`userThreads`), `getNumUnread` (`unread`), `getNumUnreadAllLabels`, `getAttachments` (`attachments`), `setReadStatus`, `markThreadAsOpened`.

**Tahap 2: mengirim email**
`sendMessage`, `sendReplyMessage` (`replyToMessage`), `usersFromEmailAliasWithCatchall`, `usersFromEmailAlias`, `decryptionServicePublicKey`, `createOrUpdateDraft`, `getAllDrafts` (`allDrafts`), `deleteDraft`, `getAllCurrentUserContacts` (`allContacts`), `createOrUpdateContact`.

**Tahap 3: mengelola mailbox**
`applyLabels`, `removeLabels`, `bulkApplyLabels`, `bulkRemoveLabels`, `createUserLabel`, `editUserLabel`, `deleteUserLabel`, `deleteThread`, `bulkTrash`, `bulkDeleteTrashedThreads`, `getBulkActionJobStatus`, `setAllThreadsReadStatus`, `filteredThreadIDs` (pencarian).

**Tahap 4: pengaturan dan fitur lanjutan**
Alias, custom domain, quick alias, filter, auto-reply, signature, MFA/WebAuthn, import (Gmail/Outlook/MBOX/EML), billing/credits, organisasi. Semuanya ada di `operations.md`.

Billing (Stripe), Bonfida/ENS, dan referral bisa dibuat sebagai stub yang mengembalikan nilai default yang valid secara tipe.
