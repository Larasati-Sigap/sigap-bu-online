-- SIGAP-BU Online v3.0 - Supabase schema
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role text not null default 'viewer' check (role in ('super_admin','admin_bagian','viewer')),
  unit_kerja text,
  created_at timestamptz default now()
);

create table if not exists public.pegawai (
  id uuid primary key default uuid_generate_v4(),
  no_urut text,
  nama text not null,
  nip_nrp text,
  pangkat_gol text,
  jabatan text,
  unit_kerja text,
  sub_unit text,
  jenis text check (jenis in ('Jaksa','TU')),
  status text default 'Aktif' check (status in ('Aktif','Naik Pangkat','Mutasi','Pensiun')),
  tmt_pangkat date,
  tmt_jabatan date,
  tanggal_pensiun date,
  keterangan text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.riwayat_perubahan (
  id uuid primary key default uuid_generate_v4(),
  pegawai_id uuid references public.pegawai(id) on delete set null,
  tipe text not null,
  field_diubah text,
  nilai_lama text,
  nilai_baru text,
  catatan text,
  admin_id uuid references auth.users(id) on delete set null,
  admin_nama text,
  created_at timestamptz default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_pegawai_updated_at on public.pegawai;
create trigger set_pegawai_updated_at
before update on public.pegawai
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.pegawai enable row level security;
alter table public.riwayat_perubahan enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_super_admin_all" on public.profiles;
create policy "profiles_super_admin_all" on public.profiles
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

drop policy if exists "pegawai_select_authenticated" on public.pegawai;
create policy "pegawai_select_authenticated" on public.pegawai
for select using (auth.role() = 'authenticated');

drop policy if exists "pegawai_super_admin_all" on public.pegawai;
create policy "pegawai_super_admin_all" on public.pegawai
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
);

drop policy if exists "pegawai_admin_bagian_update" on public.pegawai;
create policy "pegawai_admin_bagian_update" on public.pegawai
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin_bagian'
    and p.unit_kerja = pegawai.unit_kerja
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin_bagian'
    and p.unit_kerja = pegawai.unit_kerja
  )
);

drop policy if exists "pegawai_admin_bagian_insert" on public.pegawai;
create policy "pegawai_admin_bagian_insert" on public.pegawai
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'admin_bagian'
    and p.unit_kerja = pegawai.unit_kerja
  )
);

drop policy if exists "riwayat_select_authenticated" on public.riwayat_perubahan;
create policy "riwayat_select_authenticated" on public.riwayat_perubahan
for select using (auth.role() = 'authenticated');

drop policy if exists "riwayat_insert_admin" on public.riwayat_perubahan;
create policy "riwayat_insert_admin" on public.riwayat_perubahan
for insert with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('super_admin','admin_bagian')
  )
);
