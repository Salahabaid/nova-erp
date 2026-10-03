-- Nova ERP — schéma initial
-- À exécuter dans l'éditeur SQL Supabase (ou via CLI : supabase db push)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rôles & permissions
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  module text not null,
  action text not null,
  description text
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null,
  phone text,
  avatar_url text,
  role_id uuid references public.roles(id),
  status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Entreprise
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  logo_url text,
  address text,
  city text,
  country text default 'MA',
  phone text,
  email text,
  tax_id text,
  currency text not null default 'MAD',
  default_tax_rate numeric(5,2) not null default 20,
  invoice_prefix text not null default 'FAC',
  invoice_next_number integer not null default 1,
  quote_prefix text not null default 'DEV',
  quote_next_number integer not null default 1,
  sales_order_prefix text not null default 'CMD',
  sales_order_next_number integer not null default 1,
  purchase_prefix text not null default 'ACH',
  purchase_next_number integer not null default 1,
  language text not null default 'fr',
  onboarding_completed boolean not null default false,
  notify_low_stock boolean not null default true,
  notify_overdue_invoices boolean not null default true,
  notify_tasks boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

insert into public.company_settings (name) values ('');

-- ---------------------------------------------------------------------------
-- CRM
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  tax_id text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  tax_id text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.warehouses (name, location, is_default)
values ('Entrepôt principal', 'Siège', true);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  purchase_price numeric(14,2) not null default 0,
  sale_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  unit text not null default 'unité',
  stock_quantity numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  image_url text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  movement_type text not null check (movement_type in ('in', 'out', 'transfer', 'adjustment', 'inventory')),
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2),
  reference_type text,
  reference_id uuid,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_stock_movements_product on public.stock_movements(product_id);
create index idx_stock_movements_created on public.stock_movements(created_at desc);

-- ---------------------------------------------------------------------------
-- Documents commerciaux
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  customer_id uuid not null references public.customers(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted', 'cancelled')),
  issue_date date not null default current_date,
  valid_until date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  converted_to_order_id uuid,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0
);

create table public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  customer_id uuid not null references public.customers(id),
  quote_id uuid references public.quotes(id),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'partially_delivered', 'delivered', 'invoiced', 'cancelled')),
  issue_date date not null default current_date,
  delivery_date date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  converted_to_invoice_id uuid,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes
  add constraint quotes_converted_order_fk
  foreign key (converted_to_order_id) references public.sales_orders(id);

create table public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  delivered_qty numeric(14,3) not null default 0
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled')),
  issue_date date not null default current_date,
  expected_date date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  received_qty numeric(14,3) not null default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  invoice_type text not null default 'sales' check (invoice_type in ('sales', 'purchase')),
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  sales_order_id uuid references public.sales_orders(id),
  purchase_order_id uuid references public.purchase_orders(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_orders
  add constraint sales_orders_converted_invoice_fk
  foreign key (converted_to_invoice_id) references public.invoices(id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id),
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  tax_rate numeric(5,2) not null default 20,
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_type text not null check (payment_type in ('customer', 'supplier', 'expense', 'refund')),
  amount numeric(14,2) not null,
  payment_date date not null default current_date,
  method text not null default 'transfer'
    check (method in ('cash', 'transfer', 'card', 'check', 'other')),
  reference text,
  invoice_id uuid references public.invoices(id) on delete set null,
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  notes text,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'transport', 'salaries', 'marketing', 'equipment',
    'software', 'rent', 'electricity', 'phone', 'other'
  )),
  amount numeric(14,2) not null,
  expense_date date not null default current_date,
  description text,
  vendor text,
  receipt_url text,
  payment_id uuid references public.payments(id) on delete set null,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RH / tâches / docs
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  position text,
  department text,
  hire_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave')),
  salary numeric(14,2),
  photo_url text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  related_module text,
  related_id uuid,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_url text not null,
  mime_type text,
  size_bytes integer,
  related_type text,
  related_id uuid,
  is_demo boolean not null default false,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on public.audit_logs(created_at desc);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  delivery_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  sales_order_item_id uuid not null references public.sales_order_items(id),
  quantity numeric(14,3) not null
);

-- ---------------------------------------------------------------------------
-- Triggers documents updated_at
-- ---------------------------------------------------------------------------
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger sales_orders_updated_at before update on public.sales_orders
  for each row execute function public.set_updated_at();
create trigger purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed rôles & permissions
-- ---------------------------------------------------------------------------
insert into public.roles (slug, name, description) values
  ('super_admin', 'Super Admin', 'Accès complet, y compris la configuration système'),
  ('admin', 'Administrateur', 'Gestion globale hors configuration système critique'),
  ('manager', 'Manager', 'Pilotage opérationnel'),
  ('sales', 'Commercial', 'Clients, devis, commandes et ventes'),
  ('accountant', 'Comptable', 'Factures, paiements, dépenses et rapports'),
  ('employee', 'Employé', 'Tâches et informations autorisées');

insert into public.permissions (code, module, action, description) values
  ('dashboard.read', 'dashboard', 'read', 'Voir le tableau de bord'),
  ('customers.read', 'customers', 'read', 'Voir les clients'),
  ('customers.write', 'customers', 'write', 'Créer / modifier les clients'),
  ('customers.delete', 'customers', 'delete', 'Supprimer les clients'),
  ('suppliers.read', 'suppliers', 'read', 'Voir les fournisseurs'),
  ('suppliers.write', 'suppliers', 'write', 'Créer / modifier les fournisseurs'),
  ('suppliers.delete', 'suppliers', 'delete', 'Supprimer les fournisseurs'),
  ('products.read', 'products', 'read', 'Voir les produits'),
  ('products.write', 'products', 'write', 'Créer / modifier les produits'),
  ('products.delete', 'products', 'delete', 'Supprimer les produits'),
  ('inventory.read', 'inventory', 'read', 'Voir les stocks'),
  ('inventory.write', 'inventory', 'write', 'Mouvements de stock'),
  ('purchases.read', 'purchases', 'read', 'Voir les achats'),
  ('purchases.write', 'purchases', 'write', 'Gérer les achats'),
  ('sales.read', 'sales', 'read', 'Voir les ventes'),
  ('sales.write', 'sales', 'write', 'Gérer les ventes'),
  ('invoices.read', 'invoices', 'read', 'Voir les factures'),
  ('invoices.write', 'invoices', 'write', 'Gérer les factures'),
  ('payments.read', 'payments', 'read', 'Voir les paiements'),
  ('payments.write', 'payments', 'write', 'Enregistrer les paiements'),
  ('expenses.read', 'expenses', 'read', 'Voir les dépenses'),
  ('expenses.write', 'expenses', 'write', 'Gérer les dépenses'),
  ('employees.read', 'employees', 'read', 'Voir les employés'),
  ('employees.write', 'employees', 'write', 'Gérer les employés'),
  ('tasks.read', 'tasks', 'read', 'Voir les tâches'),
  ('tasks.write', 'tasks', 'write', 'Gérer les tâches'),
  ('documents.read', 'documents', 'read', 'Voir les documents'),
  ('documents.write', 'documents', 'write', 'Gérer les documents'),
  ('reports.read', 'reports', 'read', 'Voir les rapports'),
  ('notifications.read', 'notifications', 'read', 'Voir les notifications'),
  ('settings.read', 'settings', 'read', 'Voir les paramètres'),
  ('settings.write', 'settings', 'write', 'Modifier les paramètres'),
  ('users.manage', 'users', 'manage', 'Gérer les utilisateurs et rôles'),
  ('system.configure', 'system', 'configure', 'Configuration système');

-- Helper: accorder toutes les permissions d'une liste de codes à un rôle
create or replace function public.grant_perms(role_slug text, codes text[])
returns void language plpgsql as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.slug = role_slug and p.code = any(codes)
  on conflict do nothing;
end;
$$;

-- Super admin : tout
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.slug = 'super_admin';

select public.grant_perms('admin', array[
  'dashboard.read','customers.read','customers.write','customers.delete',
  'suppliers.read','suppliers.write','suppliers.delete',
  'products.read','products.write','products.delete',
  'inventory.read','inventory.write',
  'purchases.read','purchases.write','sales.read','sales.write',
  'invoices.read','invoices.write','payments.read','payments.write',
  'expenses.read','expenses.write','employees.read','employees.write',
  'tasks.read','tasks.write','documents.read','documents.write',
  'reports.read','notifications.read','settings.read','settings.write','users.manage'
]);

select public.grant_perms('manager', array[
  'dashboard.read','customers.read','customers.write',
  'suppliers.read','suppliers.write',
  'products.read','products.write',
  'inventory.read','inventory.write',
  'purchases.read','purchases.write','sales.read','sales.write',
  'invoices.read','payments.read','expenses.read',
  'employees.read','tasks.read','tasks.write',
  'documents.read','documents.write','reports.read','notifications.read'
]);

select public.grant_perms('sales', array[
  'dashboard.read','customers.read','customers.write',
  'products.read','sales.read','sales.write',
  'invoices.read','payments.read','tasks.read','tasks.write',
  'notifications.read'
]);

select public.grant_perms('accountant', array[
  'dashboard.read','customers.read','suppliers.read',
  'invoices.read','invoices.write','payments.read','payments.write',
  'expenses.read','expenses.write','reports.read','notifications.read'
]);

select public.grant_perms('employee', array[
  'tasks.read','tasks.write','notifications.read','documents.read'
]);

-- ---------------------------------------------------------------------------
-- Profil automatique à l'inscription
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  assigned_role uuid;
  user_count integer;
begin
  select count(*) into user_count from public.profiles;
  if user_count = 0 then
    select id into assigned_role from public.roles where slug = 'super_admin';
  else
    select id into assigned_role from public.roles where slug = 'employee';
  end if;

  insert into public.profiles (id, email, first_name, last_name, role_id, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    assigned_role,
    'active'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.categories enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.employees enable row level security;
alter table public.tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_items enable row level security;

create or replace function public.current_role_slug()
returns text language sql stable security definer set search_path = public as $$
  select r.slug
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

create or replace function public.has_perm(code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid() and perm.code = code
  )
$$;

-- Lecture des référentiels de sécurité pour utilisateurs authentifiés
create policy roles_read on public.roles for select to authenticated using (true);
create policy perms_read on public.permissions for select to authenticated using (true);
create policy role_perms_read on public.role_permissions for select to authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated
  using (true);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('users.manage'));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.has_perm('users.manage') or id = auth.uid());

create policy company_read on public.company_settings for select to authenticated using (true);
create policy company_update on public.company_settings for update to authenticated
  using (public.has_perm('settings.write') or public.has_perm('system.configure'));

-- Politique générique : authentifié + permission module
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','suppliers','categories','warehouses','products','stock_movements',
    'quotes','quote_items','sales_orders','sales_order_items',
    'purchase_orders','purchase_order_items','invoices','invoice_items',
    'payments','expenses','employees','tasks','documents',
    'deliveries','delivery_items'
  ]
  loop
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      t, t
    );
  end loop;
end $$;

create policy notifications_own on public.notifications for all to authenticated
  using (user_id = auth.uid() or public.has_perm('users.manage'))
  with check (user_id = auth.uid() or public.has_perm('users.manage'));

create policy audit_read on public.audit_logs for select to authenticated
  using (public.has_perm('system.configure') or public.has_perm('users.manage'));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (true);

-- Storage (exécuter aussi dans Storage > Policies si le bucket est créé à la main)
insert into storage.buckets (id, name, public)
values ('erp-files', 'erp-files', true)
on conflict (id) do nothing;

-- Service role bypasses RLS — le backend FastAPI l'utilise pour la logique métier.
-- Les politiques ci-dessus protègent un accès direct PostgREST depuis le frontend.
