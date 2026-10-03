# Schéma PostgreSQL / Supabase

Toutes les tables sont dans le schéma `public`.  
`auth.users` (Supabase) est la source d’identité.

## Relations

```
auth.users 1──1 profiles ──N roles
roles N──N permissions          (role_permissions)

customers 1──N quotes / sales_orders / invoices / payments
suppliers 1──N purchase_orders / invoices / payments / products
categories 1──N products
warehouses 1──N stock_movements
products 1──N stock_movements / * _items

quotes 1──N quote_items → products
quotes 0──1 sales_orders
sales_orders 1──N sales_order_items
sales_orders 0──1 invoices
purchase_orders 1──N purchase_order_items
invoices 1──N invoice_items
invoices 1──N payments
expenses ── payments
employees 0──1 profiles
tasks ── employees / profiles
notifications ── profiles
documents ── (polymorphe related_type / related_id)
audit_logs ── profiles
company_settings (singleton)
```

## Conventions

- UUID `gen_random_uuid()` pour toutes les PK
- `created_at` / `updated_at` sur chaque table métier
- `is_demo boolean default false` sur les entités seedables
- `created_by` → `profiles.id`
- Statuts en `text` + check constraint
- Montants en `numeric(14,2)`, quantités en `numeric(14,3)`
- Numéros de documents uniques (`quotes.number`, `invoices.number`, …)

Voir `supabase/migrations/0001_init.sql`.
