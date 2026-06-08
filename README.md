# SIGAP-BU Online v3.0

Aplikasi online multi-user untuk data pegawai Biro Umum.

## Stack
- Vite + React
- Supabase Auth + Postgres + Realtime
- Vercel hosting

## Data awal
- Pegawai berhasil masuk ke seed SQL: 251
- Jaksa: 26
- TU: 225

## Setup Supabase
1. Buat project Supabase.
2. SQL Editor → jalankan `supabase/schema.sql`.
3. SQL Editor → jalankan `supabase/seed_pegawai.sql`.
4. Authentication → Add user.
5. Ambil UUID user lalu buat profile:

```sql
insert into public.profiles (id, nama, role, unit_kerja)
values ('UUID_USER', 'Febriani Larasati', 'super_admin', null);
```

Admin bagian:

```sql
insert into public.profiles (id, nama, role, unit_kerja)
values ('UUID_USER', 'Admin TUK', 'admin_bagian', 'Tata Usaha & Kearsipan');
```

Viewer:

```sql
insert into public.profiles (id, nama, role, unit_kerja)
values ('UUID_USER', 'Viewer', 'viewer', null);
```

## Jalankan lokal
```bash
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local`:
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Deploy Vercel
1. Upload folder ini ke GitHub.
2. Import ke Vercel.
3. Tambahkan Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.
