# Architecture — Nova ERP

Application ERP SaaS mono-entreprise, frontend et backend séparés, données persistantes dans Supabase PostgreSQL.

## 1. Architecture globale

```
┌──────────────┐     JWT (Supabase Auth)      ┌────────────────┐
│  React SPA   │ ───────────────────────────► │  FastAPI API   │
│  Vite + TS   │ ◄─────────────────────────── │  Python 3.11+  │
└──────────────┘         REST JSON            └────────┬───────┘
        │                                              │
        │ signIn / signUp / session                    │ service role
        ▼                                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  Auth  ·  PostgreSQL + RLS  ·  Storage (logos, pièces jointes)   │
└──────────────────────────────────────────────────────────────────┘
```

- Le navigateur n’utilise **jamais** la clé `service_role`.
- Toute la logique métier (stocks, conversions devis→commande→facture, soldes, numérotation) vit dans FastAPI.
- Supabase Auth émet le JWT ; FastAPI le vérifie à chaque requête.
- RLS reste activé comme filet de sécurité si quelqu’un interroge Postgres directement.

## 2. Architecture frontend

```
frontend/src/
  api/            client HTTP + endpoints typés
  components/     UI kit + layout
  contexts/       Auth, Company, Toast
  hooks/          données, permissions, debounce
  i18n/           fr / en (+ structure RTL)
  layouts/        AppShell (sidebar + header)
  pages/          une page par module
  types/          contrats API
  utils/          formatage, export, RBAC côté UI
```

- React 18 + TypeScript + Vite
- Tailwind CSS (design system premium)
- TanStack Query (cache, pagination, invalidation)
- React Router (routes protégées + garde RBAC)
- react-i18next (FR / EN, prêt pour AR / ES)
- Recharts (dashboard + rapports)

## 3. Architecture backend

```
backend/app/
  api/v1/         routeurs REST
  core/           config, sécurité JWT, RBAC, erreurs
  schemas/        Pydantic v2
  services/       règles métier
  repositories/   accès Supabase / PostgREST
  middleware/     audit, CORS, request-id
  utils/          PDF, CSV, pagination
```

Couches : Route → Service (métier) → Repository (données).  
Aucun calcul de stock / facture / paiement dans les composants React.

## 4. Authentification

1. Inscription / connexion via `/auth/*` (FastAPI délègue à Supabase Auth).
2. Le frontend stocke la session Supabase (localStorage géré par `@supabase/supabase-js`).
3. Chaque appel API envoie `Authorization: Bearer <access_token>`.
4. FastAPI valide le JWT (secret projet Supabase) et charge `profiles` + rôle.
5. Premier utilisateur : rôle `super_admin` + onboarding entreprise.

## 5. RBAC

| Rôle          | Portée |
|---------------|--------|
| super_admin   | Tout, y compris sécurité système |
| admin         | Entreprise, utilisateurs (sauf rôles système), tous modules |
| manager       | Opérations : ventes, achats, stock, CRM, tâches, rapports |
| sales         | Clients, devis, commandes, ventes |
| accountant    | Factures, paiements, dépenses, rapports financiers |
| employee      | Tâches assignées, lecture limitée |

Permissions atomiques : `{module}.{action}`  
ex. `customers.read`, `invoices.create`, `settings.update`, `users.manage`.

Le backend refuse toute action non autorisée (403).  
Le frontend masque menus / boutons (jamais comme seule protection).

## 6. APIs principales

| Préfixe | Modules |
|---------|---------|
| `/api/v1/auth` | login, register, me, password |
| `/api/v1/dashboard` | KPI + graphiques + activité |
| `/api/v1/customers` | CRM clients |
| `/api/v1/suppliers` | Fournisseurs |
| `/api/v1/products` | Catalogue + catégories |
| `/api/v1/inventory` | Entrepôts, mouvements, alertes |
| `/api/v1/purchases` | Commandes fournisseur + réception |
| `/api/v1/sales` | Devis, commandes, livraisons |
| `/api/v1/invoices` | Factures + PDF |
| `/api/v1/payments` | Encaissements / décaissements |
| `/api/v1/expenses` | Dépenses |
| `/api/v1/employees` | RH |
| `/api/v1/tasks` | Tâches kanban / liste |
| `/api/v1/documents` | Fichiers |
| `/api/v1/reports` | Exports CSV / XLSX / PDF |
| `/api/v1/notifications` | Cloche |
| `/api/v1/search` | Recherche globale |
| `/api/v1/settings` | Entreprise, numérotation, users |
| `/api/v1/onboarding` | Première configuration |

## 7. Pages frontend

`/login` `/register` `/onboarding`  
`/` dashboard  
`/sales` `/quotes` `/orders`  
`/purchases`  
`/products` `/inventory`  
`/customers` `/suppliers`  
`/invoices` `/payments` `/expenses`  
`/employees` `/tasks` `/documents`  
`/reports` `/settings` `/settings/users`

## 8. Workflows métier

**Ventes** : Devis (brouillon→envoyé→accepté) → Commande → Livraison → Facture → Paiement(s).  
Chaque conversion copie les lignes, recalcule HT / TVA / TTC, verrouille le document source.

**Achats** : Brouillon → Envoyée → Confirmée → Réception partielle / complète → Facture → Paiement.  
La réception crée des `stock_movements` de type `in` et recalcule le stock.

**Stock** : `stock_actuel = SUM(entrées) - SUM(sorties) + SUM(ajustements)`  
Le champ `products.stock_quantity` est une projection maintenue par le service stock (jamais édité à la main hors ajustement).

**Facture** : `reste = total_ttc - SUM(paiements)`.  
Statut dérivé : brouillon / envoyée / partiellement payée / payée / en retard / annulée.

**Soldes** :  
- Client = factures vente ouvertes − paiements client  
- Fournisseur = factures achat ouvertes − paiements fournisseur
