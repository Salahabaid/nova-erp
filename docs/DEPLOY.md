# Déploiement Nova ERP

**Recommandé : tout sur Vercel** (frontend + API FastAPI).  
La base reste **Supabase**. Aucun secret dans le frontend.

Render demande une carte bancaire (vérification $1, non débité) même pour le plan Free. Ce n’est pas contournable. Si vous ne voulez pas l’ajouter, ignorez Render.

## 1. Vercel — un seul projet

1. Ouvrez [https://vercel.com/new](https://vercel.com/new) et importez `Salahabaid/nova-erp`.
2. Root Directory : **racine du repo** (ne pas choisir `frontend/`).
3. **Settings → Environment Variables** (Production + Preview), mêmes valeurs que `backend/.env` :

   | Nom | Obligatoire |
   |-----|-------------|
   | `SUPABASE_URL` | oui |
   | `SUPABASE_ANON_KEY` | oui |
   | `SUPABASE_SERVICE_ROLE_KEY` | oui |
   | `SUPABASE_JWT_SECRET` | oui |
   | `DATABASE_URL` | oui (pooler IPv4, `sslmode=require`) |
   | `APP_ENV` | `production` |
   | `CORS_ORIGINS` | `http://localhost:5173` |

4. Deploy.
5. Testez `https://VOTRE-PROJET.vercel.app/health` puis la page de login.

Le frontend appelle `/api/v1` (même domaine). Pas de proxy Render.

## 2. Render (optionnel)

Uniquement si vous acceptez d’ajouter **votre** carte sur le formulaire Render (identité, autorisation $1). Ne communiquez jamais un numéro de carte ici.

Ensuite : [Blueprints](https://dashboard.render.com/blueprints) → repo `Salahabaid/nova-erp` → secrets sur `novaerp-api`.

## Checklist

- [ ] Variables d’environnement Vercel renseignées
- [ ] `GET /health` = 200
- [ ] Login Super Admin
- [ ] Confirmation email Auth : à réactiver plus tard si besoin
