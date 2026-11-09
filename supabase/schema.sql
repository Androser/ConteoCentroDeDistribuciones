-- Esquema para Inventario CD - Centro de Distribución
-- Ejecutar en Supabase SQL Editor

create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by text not null,
  created_at timestamp with time zone default now(),
  status text default 'active'
);

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  sku text not null,
  item_number text,
  product_name text,
  conteo integer default 0,
  search_name text,
  size text,
  stile text,
  warehouse text,
  created_at timestamp with time zone default now(),
  unique(session_id, sku)
);

create table if not exists scans (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references sessions(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  sku text not null,
  delta integer not null,
  user_name text not null,
  created_at timestamp with time zone default now()
);

-- Habilitar Realtime para sincronización en vivo
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table scans;

-- Políticas permisivas solo para desarrollo
alter table sessions enable row level security;
alter table products enable row level security;
alter table scans enable row level security;

create policy "dev_sessions_all" on sessions for all using (true) with check (true);
create policy "dev_products_all" on products for all using (true) with check (true);
create policy "dev_scans_all" on scans for all using (true) with check (true);
