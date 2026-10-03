# Déploiement Nova ERP

Stack retenue : **API sur Render**, **frontend sur Vercel** (ou aussi sur Render).

La base reste **Supabase**. Ne jamais y mettre les secrets dans le frontend.

## 1. API — Render

1. Ouvrez [https://dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)
2. Connectez le repo `Salahabaid/nova-erp` et appliquez `render.yaml`
3. Dans le service `novaerp-api`, renseignez les secrets (mêmes valeurs que `backend/.env` local) :
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `DATABASE_URL` (pooler IPv4, `sslmode=require`)
4. Health check : `https://novaerp-api.onrender.com/health`

Le plan Free s’endort après inactivité : le premier appel peut prendre 30–60 s.

## 2. Frontend — Vercel (recommandé)

1. [Importer le repo sur Vercel](https://vercel.com/new)
2. Root Directory : laisser la racine (le `vercel.json` à la racine build `frontend/`)
3. Variables : aucune obligatoire (`VITE_API_URL=/api/v1` via `.env.production`)
4. Les appels `/api/*` sont proxifiés vers `https://novaerp-api.onrender.com`

## 2 bis. Frontend — Render

Le Blueprint crée aussi `novaerp-web` (`https://novaerp-web.onrender.com`) qui appelle l’API en direct.

## 3. Après le premier déploiement

Dans `novaerp-api`, ajoutez l’URL Vercel à `CORS_ORIGINS` :

```
http://localhost:5173,https://novaerp-web.onrender.com,https://VOTRE-PROJET.vercel.app
```

Les origines `*.vercel.app` et `*.onrender.com` sont déjà acceptées par regex.

## Checklist

- [ ] HTTPS partout
- [ ] Secrets uniquement sur Render (API)
- [ ] `GET /health` = 200
- [ ] Login Super Admin
- [ ] Confirmation email Auth : à réactiver en production si besoin
