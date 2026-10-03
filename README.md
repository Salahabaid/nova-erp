# Nova ERP

Plateforme ERP web **production-ready** : React + FastAPI + Supabase (Auth, PostgreSQL, Storage).

Les pages sont branchées sur l’API. Les CRUD, stocks, conversions devis → commande → facture, paiements et soldes sont persistants.

## Architecture

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/DATABASE.md](docs/DATABASE.md).

```
frontend/   React 18 + TypeScript + Vite + Tailwind
backend/    FastAPI (REST, JWT Supabase, RBAC, PDF/CSV/XLSX)
supabase/   migrations SQL + RLS + rôles
```

## Prérequis

- Node.js 20+
- Python 3.11+
- Un projet [Supabase](https://supabase.com)

## 1. Base de données

1. Créez un projet Supabase.
2. **Project Settings → API** : copiez `URL`, `anon key`, `service_role` (secret).
3. **Project Settings → API → JWT Secret**.
4. **SQL Editor** : exécutez `supabase/migrations/0001_init.sql`.
5. Authentication → Providers : Email activé.  
   Pour le développement, désactivez « Confirm email » afin que `/register` connecte immédiatement.

## 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
copy .env.example .env          # puis remplissez les clés
uvicorn app.main:app --reload --port 8000
```

- API : http://127.0.0.1:8000/api/v1
- Documentation Swagger : http://127.0.0.1:8000/docs
- Santé : http://127.0.0.1:8000/health

## 3. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Ou, depuis la racine du projet :

```powershell
.\start-dev.ps1
```

Ouvrez http://localhost:5173

Créez le premier compte via **Créer un compte** : il devient **Super Admin** et passe par l’onboarding entreprise.

## 4. Données de démonstration

Après la première connexion :

```bash
cd backend
.venv\Scripts\activate
python scripts/seed.py
```

Les lignes sont marquées `is_demo = true`. Elles se suppriment depuis **Paramètres → Utilisateurs → Supprimer les données de démonstration**.

## 5. Tests

```bash
cd backend
pytest
```

Couvre les totaux HT/TVA/TTC, les statuts de facture et le calcul de stock.

## Rôles (RBAC)

| Rôle | Accès |
|------|--------|
| Super Admin | Tout, y compris la configuration système |
| Administrateur | Entreprise et modules, hors durcissement système |
| Manager | Opérations (ventes, achats, stock, CRM, tâches, rapports) |
| Commercial | Clients, devis, commandes, ventes |
| Comptable | Factures, paiements, dépenses, rapports |
| Employé | Tâches et documents autorisés |

Le backend refuse toute action non permise (403). L’UI masque les menus.

## Variables d’environnement

**Backend** (`backend/.env.example`)

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **jamais** dans le frontend
- `SUPABASE_JWT_SECRET`
- `CORS_ORIGINS`

**Frontend** (`frontend/.env.example`)

- `VITE_API_URL` (défaut : `/api/v1` via le proxy Vite)

## Déploiement

Guide complet : [docs/DEPLOY.md](docs/DEPLOY.md)

- API : Render (`render.yaml`) — [Blueprint](https://dashboard.render.com/blueprints)
- Frontend : Vercel (racine du repo) ou site statique Render `novaerp-web`

## API — préfixes

`/auth` `/dashboard` `/customers` `/suppliers` `/products` `/inventory`  
`/quotes` `/sales-orders` `/purchases` `/invoices` `/payments` `/expenses`  
`/employees` `/tasks` `/documents` `/reports` `/search` `/notifications` `/settings` `/onboarding`

La documentation interactive est générée par FastAPI (`/docs`).
