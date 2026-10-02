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
| **Mail server** | Email **ke** dan **dari** server lain (Gmail, dll.): SMTP masuk (MX), pengiriman langsung ke MX penerima dengan DKIM, antrean + retry, bounce, threading lewat `Message-ID` / `In-Reply-To`. Lihat [Email ke dan dari luar](#email-ke-dan-dari-luar). |

**Semua field lain** dari skema tetap ada, tapi mengembalikan nilai default yang valid secara tipe (`null`, `[]`, `''`, `false`, atau objek kosong yang field-nya ikut terisi default). Setiap field seperti itu dicatat sekali di log:

```
[stub] Query.getCurrentUserCustomDomains is not implemented; returning a default value
```

Log ini bisa dipakai sebagai daftar pekerjaan berikutnya.

### Belum ada
- `scheduleSendAt` disimpan, tapi email langsung dikirim.
- MFA, billing, custom domain, import, organisasi/tim, dan dokumen (semuanya masih stub).
- Tidak ada signup di skemail-web, jadi akun dibuat dengan skrip seed.

## Menjalankan

Butuh **Node.js 22** (minimal 20.18, karena `mailauth`). Langkah 1–2 cukup sekali.

```bash
# 1. Dependency monorepo
yarn

# 2. Bundle JS library bersama, berurutan (lihat "Catatan build library" di bawah)
for lib in skiff-utils skiff-mail-protos skiff-graphql skiff-crypto skiff-crypto-v2 \
           skiff-front-graphql skiff-front-search nightwatch-ui skiff-front-utils; do
  (cd libs/$lib && yarn node build.js)
done

# 3. Buat akun demo: alice@skiff.local dan bob@skiff.local, password: password123
yarn seed:server
#    atau akun sendiri:  yarn seed:server carol@skiff.local:rahasia:Carol

# 4. Jalankan server (http://localhost:4000/graphql)
yarn dev:server

# 5. Di terminal lain: arahkan skemail-web ke server ini, lalu jalankan
cp skemail-web/.env.example skemail-web/.env     # SKEMAIL_API_BASE_URL=http://localhost:4000
yarn dev                                         # buka http://localhost:4200/mail/inbox
```

Setiap `yarn node build.js` mencetak error `tsc` (lihat catatan di bawah). Error itu bisa diabaikan selama folder `dist/cjs` dan `dist/esm` terbentuk. Kalau sebuah build tidak kembali ke prompt setelah selesai, tekan Ctrl+C. Itu proses esbuild yang menggantung, dan hasil build-nya sudah tersimpan.

Login dengan `alice@skiff.local` / `password123`, kirim email ke `bob@skiff.local`, lalu login sebagai bob untuk membaca dan membalas. Alur ini sudah diuji di Chromium.

Konfigurasi server ada di `.env` (contoh: [`.env.example`](./.env.example)): `PORT`, `PUBLIC_URL`, `CORS_ORIGINS`, `DATA_DIR`, `COOKIE_SECURE`, `LINK_SECRET`. Data tersimpan di `skemail-server/data/` (SQLite + file lampiran).

## Email ke dan dari luar

skemail-server adalah mail server lengkap. Ia **tidak** memakai relay pihak ketiga.

```
                 SMTP port 25 (MX)                            SMTP port 25
Gmail, dll. ───────────────────────► src/mail/inbound.ts       src/mail/outbound.ts ───────► MX penerima
                                       │ parse MIME                ▲ susun ulang MIME + DKIM
                                       ▼                           │ (antrean, retry, bounce)
                                 enkripsi untuk kunci         buka session key dengan kunci
                                 publik penerima              server (externalEncryptedSessionKey)
                                       │                           ▲
                                       ▼                           │
                                 ─────────── SQLite: hanya ciphertext ───────────
```

- **Keluar.** Kalau ada penerima di luar server, skemail-web juga membungkus session key untuk `decryptionServicePublicKey`. Server memakainya untuk membuka isi email **di memori**, lalu menyusun MIME (teks, HTML, lampiran, `Message-ID`, `In-Reply-To`) dan menandatanganinya dengan **DKIM**. Pesan itu dikirim **langsung** ke host MX domain penerima sesuai urutan prioritas.
  - Antrean hanya menyimpan referensi dan ciphertext, dan MIME disusun ulang di setiap percobaan.
  - Kegagalan sementara (4xx atau server tidak bisa dihubungi) dicoba lagi setelah 1 m, 5 m, 15 m, 1 j, 3 j, 6 j, dan 12 j.
  - Penolakan permanen (5xx) atau habisnya jatah percobaan menghasilkan email **bounce** ("Undelivered Mail Returned to Sender") di inbox pengirim.
- **Masuk.** Server SMTP bawaan menerima email untuk domain di `MAIL_DOMAINS`. Plaintext langsung dienkripsi dengan session key baru, yang dibungkus untuk kunci publik penerima, dengan format yang sama persis seperti email dari sesama user Skiff. Balasan otomatis masuk ke thread yang benar lewat `In-Reply-To` / `References`.
  - Server **tidak pernah me-relay**: penerima di domain lain ditolak dengan `554`, dan user yang tidak ada ditolak dengan `550`. Tidak ada `AUTH`; user mengirim lewat GraphQL.
- **Batas enkripsi.** Seperti di Skiff asli, email ke dan dari luar **tidak** end-to-end, karena server melihat isinya sesaat di memori. Email antar user di server yang sama tetap end-to-end.

### Mencoba secara lokal (tanpa domain)

`MX_OVERRIDES` mengarahkan sebuah domain ke host tertentu, sehingga "server lain" bisa dijalankan di komputer yang sama:

```bash
# Terminal 1: server SMTP apa pun di port 2626 berperan sebagai external.test,
# misalnya Mailpit: docker run -p 2626:1025 -p 8025:8025 axllent/mailpit  (lihat email di http://localhost:8025)
# Terminal 2:
MX_OVERRIDES=external.test=127.0.0.1:2626 yarn dev:server
```

Kirim email dari alice ke `siapa@external.test` lewat UI, dan email itu muncul di Mailpit. Untuk mengirim email masuk ke alice, pakai klien SMTP apa pun ke `localhost:2525`, misalnya [swaks](https://github.com/jetmore/swaks):

```bash
swaks --server localhost:2525 --from teman@external.test --to alice@skiff.local \
      --header "Subject: Halo dari luar" --body "Isi email"
```

### Memakai domain sungguhan

1. **Server.** Pakai VPS dengan IP publik statis. **Port 25 harus terbuka keluar maupun masuk**: banyak penyedia cloud (AWS, GCP, Azure, DigitalOcean, dan sebagainya) memblokir port 25 secara default dan harus diminta membukanya. Minta juga penyedia mengatur **reverse DNS (PTR)** IP itu ke `MAIL_HOSTNAME`.
2. **Konfigurasi `.env`.** Isi `MAIL_DOMAINS=example.com`, `MAIL_HOSTNAME=mail.example.com`, `SMTP_PORT=25`, dan (disarankan) `SMTP_TLS_KEY_FILE` / `SMTP_TLS_CERT_FILE` dari Let's Encrypt untuk `mail.example.com`. Akun harus memakai domain itu, misalnya `yarn seed:server alice@example.com:rahasia:Alice`.
3. **DNS.** Jalankan `yarn workspace skemail-server dns <IP-server>` untuk mencetak record yang perlu dibuat: `A` untuk host mail, `MX`, `SPF`, `DKIM` (kunci dibuat otomatis di `data/dkim-private.pem`), dan `DMARC`.
4. **Uji.** Kirim email ke alamat dari [mail-tester.com](https://www.mail-tester.com) untuk memeriksa SPF, DKIM, DMARC, PTR, dan blacklist. Lalu uji kirim dan terima ke akun Gmail.

### Penyaringan email masuk

Setiap email masuk melewati beberapa pemeriksaan (`src/mail/filter.ts`, `src/mail/inbound.ts`):

| Pemeriksaan | Hasil |
|---|---|
| IP pengirim terdaftar di DNSBL (`DNSBL_ZONES`, default `zen.spamhaus.org`) | koneksi ditolak (`554`) |
| Lebih dari `INBOUND_PER_IP_PER_MINUTE` pesan per menit dari satu IP | ditunda (`421`) |
| DMARC gagal, dan domain pengirim memasang `p=reject` | ditolak (`550`) |
| DMARC gagal dengan `p=quarantine`, atau SPF gagal tanpa tanda tangan DKIM yang valid | masuk folder **Spam** |
| rspamd (kalau `RSPAMD_URL` diisi) memutuskan `reject` / `greylist` / `add header` | ditolak / ditunda / **Spam** |

SPF, DKIM, DMARC, dan ARC diperiksa dengan [mailauth](https://github.com/postalsys/mailauth). Untuk filter konten (bayesian, URL blocklist, dan sebagainya), jalankan [rspamd](https://rspamd.com) di samping server dan isi `RSPAMD_URL=http://127.0.0.1:11333`.

**Penting soal Spamhaus:** Spamhaus menolak query yang datang lewat resolver publik besar (8.8.8.8, 1.1.1.1). Jawaban penolakan itu dianggap "tidak terdaftar", jadi DNSBL diam-diam tidak bekerja. Jalankan resolver lokal (misalnya `unbound`) di server, atau pakai zona Spamhaus DQS dengan kunci Anda sendiri.

### Batas kirim per akun

Batas ini mencegah akun yang dibobol dipakai menyebar spam (`src/limits.ts`). Yang dihitung adalah jumlah penerima (to + cc + bcc), baik lokal maupun luar, dalam jendela waktu bergulir:

| Variabel | Default | Kalau terlampaui |
|---|---|---|
| `SEND_MAX_RECIPIENTS` | 50 per email | email ditolak |
| `SEND_LIMIT_PER_HOUR` | 50 per jam | toast "Sending too fast…" (`RATE_LIMIT_EXCEEDED`) |
| `SEND_LIMIT_PER_DAY` | 200 per 24 jam (sama dengan batas akun gratis Skiff) | modal batas pesan bawaan skemail-web (`MESSAGE_LIMIT`) |

### TLS antar mail server: MTA-STS dan DANE

**Saat mengirim**, server memakai kebijakan terkuat yang dipasang domain penerima (`src/mail/tls-policy.ts`):

1. **DANE.** Kalau MX penerima punya record TLSA di zona yang ditandatangani DNSSEC, STARTTLS wajib dan sertifikatnya harus cocok dengan TLSA:
   - usage 3 (DANE-EE) mengunci sertifikat atau kunci server;
   - usage 2 (DANE-TA) mengunci trust anchor di rantai sertifikat, ditambah pemeriksaan nama host.

   Node tidak bisa memvalidasi DNSSEC sendiri, jadi lookup MX/TLSA memakai resolver DNS-over-HTTPS yang memvalidasi DNSSEC (`DANE_DOH_URL`, default Cloudflare) dan menghormati flag AD-nya.
2. **MTA-STS.** Kalau domain penerima memasang policy `enforce`, server hanya memakai host MX yang terdaftar di policy, STARTTLS wajib, dan sertifikat harus tepercaya publik untuk nama MX itu. Policy di-cache sesuai `max_age`. Mode `testing` hanya mencatat pelanggaran ke log.
3. **Selain itu** dipakai STARTTLS oportunistik (dipakai kalau tersedia).

Kalau syarat TLS tidak terpenuhi, host MX berikutnya dicoba, lalu email dicoba ulang nanti. Email tidak pernah dikirim tanpa enkripsi kalau policy mewajibkan TLS.

**Saat menerima**, kita memasang hal yang sama untuk domain sendiri. `yarn workspace skemail-server dns <IP>` mencetak record-nya:
- `_mta-sts.<domain>` (TXT) dan `mta-sts.<domain>` (CNAME ke host mail). Policy-nya disajikan server di `/.well-known/mta-sts.txt`, dan harus bisa diakses lewat **HTTPS** di `https://mta-sts.<domain>/`, misalnya lewat reverse proxy. Mulai dengan `MTA_STS_MODE=testing`, lalu ganti ke `enforce` setelah STARTTLS di port 25 stabil.
- `_smtp._tls.<domain>` (TXT) untuk laporan TLS-RPT.
- `_25._tcp.<host mail>` (TLSA), dicetak kalau `SMTP_TLS_CERT_FILE` diisi. Record ini **hanya berguna kalau zona DNS Anda ditandatangani DNSSEC**. Karena TLSA mengunci kunci sertifikat, perpanjang sertifikat dengan kunci yang sama (`certbot --reuse-key`), atau terbitkan record baru sebelum sertifikat diganti.

### Belum ada di mail server
- **Greylisting**, dan reputasi pengirim di luar DNSBL/rspamd.
- **Mengirim laporan DMARC/TLS-RPT ke domain lain.** Laporan yang masuk ke `postmaster@` hanya tersimpan sebagai email biasa.
- **Dukungan IPv6 khusus.** Pengiriman memakai apa yang dikembalikan DNS, jadi pastikan IPv6 juga punya PTR, atau nonaktifkan IPv6 keluar.

## Cara kerja

```
src/
  app.ts            Express + Apollo Server: CORS dengan credentials, cookie, upload multipart, batch request
  schema.ts         memuat docs/skemail-web-api/schema.graphql + resolver
  defaults.ts       fallback otomatis untuk field tanpa resolver
  context.ts        sesi: cookie skiff_session_<userID> + header x-skiff-userid
  scalars.ts        Date, PublicKey, JSON, Void, Upload
  resolvers/        auth, user, mailbox, send, drafts, contacts, attachments
  limits.ts         batas kirim per akun
  mail/             inbound (SMTP/MX), filter (SPF/DKIM/DMARC, DNSBL, rspamd), ingest (MIME -> ciphertext),
                    outbound (antrean, MX, DKIM, bounce), tls-policy (DANE, MTA-STS), published (policy &
                    record DNS milik kita), datagrams (format terenkripsi skemail-web), dkim
  db/               SQLite (better-sqlite3), migrasi SQL, query
scripts/
  seed.ts           membuat akun seperti alur signup frontend
  dns.ts            mencetak record DNS (MX, SPF, DKIM, DMARC, MTA-STS, TLS-RPT, TLSA) untuk MAIL_DOMAINS
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
- `test/external-mail.test.ts` memakai server SMTP palsu sebagai "Gmail":
  - Email keluar sampai dengan isi, lampiran, dan DKIM yang **lolos verifikasi** (`mailauth`).
  - Retry untuk server yang tidak bisa dihubungi, dan bounce untuk penolakan 5xx serta user lokal yang tidak ada.
  - Email masuk terenkripsi untuk penerima dan masuk ke thread yang benar, lengkap dengan lampiran.
  - Penolakan relay (`554`) dan user tidak dikenal (`550`).
- `test/inbound-filter.test.ts` memakai DNS palsu dan menguji:
  - email lolos SPF, DKIM, dan DMARC masuk inbox;
  - pemalsuan ditolak oleh DMARC `p=reject`;
  - `p=quarantine` dan SPF gagal masuk Spam;
  - DNSBL, batas per IP, serta keputusan rspamd.
- `test/limits.test.ts` menguji batas per jam, per hari, dan per email.
- `test/tls-policy.test.ts` memakai server tujuan dengan STARTTLS dan menguji:
  - DANE-EE dan DANE-TA cocok;
  - sertifikat tidak cocok, server tanpa STARTTLS, dan TLSA tanpa DNSSEC (diabaikan);
  - MTA-STS `enforce` dan `testing`, cache policy, serta policy milik kita sendiri.
- `test/contract.test.ts` menjalankan **setiap** operasi skemail-web (203) dengan variabel minimal, lalu memastikan tidak ada respons yang melanggar skema atau resolver yang crash.

## Catatan build library

`yarn build:lib` di repo upstream ini rusak di beberapa tempat:
- `libs/tsconfig.json` tidak ada. Sekarang sudah ditambahkan.
- `protos/` tidak berisi `com/skiff/editor/encrypted/encrypted_data.proto`.
- Script build memanggil workspace `@skiff-org/skiff-crypto` yang tidak ada (namanya `skiff-crypto`).
- Codegen `skiff-graphql` membuat ulang `completeSchema.graphql` dari `supergraph.graphql` yang sudah usang. Akibatnya `skiff-front-graphql` gagal divalidasi.

Perbaikan yang dibutuhkan supaya `skemail-web` bisa dikompilasi dan berjalan:
- **`@tiptap/pm`** ditambahkan ke dependency skemail-web. Paket ini adalah peer dependency wajib `@tiptap/core@2.0.3` dan sebelumnya tidak ada di `yarn.lock`.
- **`libs/tsconfig.json`** memakai `"jsx": "react-jsx"`. Tanpa itu, esbuild mewarisi `"jsx": "react-native"` (JSX tidak ditransformasi) dari tsconfig root, sehingga bundle `nightwatch-ui` berisi JSX mentah.
- **Alias singleton di `skemail-web/configs/webpack.config.base.js`.** Yarn memasang salinan terpisah (versi sama) dari `@apollo/client`, `styled-components`, `notistack`, `@mui/*`, `react-redux` dan lainnya untuk library workspace. Dua salinan berarti dua React context, sehingga misalnya `useSnackbar()` di dalam library mengembalikan `undefined`. Semua paket `prosemirror-*` juga diarahkan ke salinan yang di-hoist, karena `@tiptap/pm` membawa versi lebih baru dan ProseMirror menolak plugin dari instance berbeda.

Karena masalah `yarn build:lib` di atas, bundle JS tiap library dibuat dengan `yarn node build.js` di folder masing-masing (langkah 2). Langkah `tsc` (file `.d.ts`) gagal, karena itu `tsconfig.json` server memetakan `skiff-crypto` / `skiff-graphql` / `skiff-utils` langsung ke source TS-nya. **Jangan commit** perubahan `libs/skiff-graphql/src/completeSchema.graphql` atau `types.ts` yang muncul setelah menjalankan `yarn build:lib`.
