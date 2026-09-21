-- AL.JUST TÁXI — estrutura inicial para pedidos e motoristas
-- Execute no SQL Editor do seu projeto Supabase.
-- Esta versão é PROTÓTIPO: acesso anónimo é usado para facilitar o primeiro teste.
-- Antes de colocar em produção, use Supabase Auth + RLS mais restritiva.

create extension if not exists pgcrypto;

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  car_model text,
  plate text not null,
  status text not null default 'offline' check (status in ('online','offline','busy')),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default 'Cliente',
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  pickup_text text,
  destination_text text,
  passengers integer not null default 1,
  car_type text not null default 'normal',
  estimated_price numeric(12,2) not null default 0,
  status text not null default 'requested'
    check (status in ('requested','accepted','started','completed','cancelled')),
  driver_id uuid references public.drivers(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.drivers enable row level security;
alter table public.rides enable row level security;

drop policy if exists "taxi_drivers_select" on public.drivers;
create policy "taxi_drivers_select" on public.drivers
for select to anon using (true);

drop policy if exists "taxi_drivers_insert" on public.drivers;
create policy "taxi_drivers_insert" on public.drivers
for insert to anon with check (true);

drop policy if exists "taxi_drivers_update" on public.drivers;
create policy "taxi_drivers_update" on public.drivers
for update to anon using (true) with check (true);

drop policy if exists "taxi_rides_select" on public.rides;
create policy "taxi_rides_select" on public.rides
for select to anon using (true);

drop policy if exists "taxi_rides_insert" on public.rides;
create policy "taxi_rides_insert" on public.rides
for insert to anon with check (true);

drop policy if exists "taxi_rides_update" on public.rides;
create policy "taxi_rides_update" on public.rides
for update to anon using (true) with check (true);

-- Realtime para pedidos e atualizações.
do $$
begin
  begin
    alter publication supabase_realtime add table public.rides;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.drivers;
  exception when duplicate_object then null;
  end;
end $$;
