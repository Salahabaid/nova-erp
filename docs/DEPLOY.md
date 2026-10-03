# Déploiement Nova ERP

## Frontend

```bash
cd frontend
npm run build
```

Hébergez `frontend/dist` (Vercel, Netlify, Cloudflare Pages, S3+CloudFront).

Variables :

```
VITE_API_URL=https://api.votre-domaine.com/api/v1
```

Ne jamais y mettre `SUPABASE_SERVICE_ROLE_KEY` ni `SUPABASE_JWT_SECRET`.

## Backend

Service Python (Render, Fly.io, Cloud Run, Railway) :

```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Variables : voir `backend/.env.example`.  
`CORS_ORIGINS` doit contenir l’URL exacte du frontend.

## Supabase

1. Exécuter `supabase/migrations/0001_init.sql`
2. Auth : réactiver la confirmation d’email en production
3. Restreindre le bucket `erp-files` si les fichiers ne doivent pas être publics
4. Vérifier que RLS est actif (la migration l’active)

## Checklist production

- [ ] HTTPS partout
- [ ] Secrets uniquement côté backend
- [ ] Premier utilisateur Super Admin créé
- [ ] Onboarding entreprise terminé
- [ ] Sauvegarde automatique Postgres (Supabase)
- [ ] `pytest` vert
- [ ] `npm run build` vert
