# Couverture du cahier des charges

Nova ERP n’est pas une maquette. Chaque écran appelle FastAPI, qui persiste dans Supabase.

| Module | État | Notes |
|--------|------|--------|
| Auth + onboarding + RBAC | Fait | 6 rôles, JWT, refresh |
| Dashboard KPI / graphiques / activité | Fait | Données agrégées live |
| Clients / fournisseurs | Fait | CRUD, solde, historique |
| Produits + catégories | Fait | Import/export, fiche, mouvements |
| Stocks | Fait | in/out/transfer/adjust/inventory |
| Devis → commande → livraison → facture | Fait | Stock mis à jour à la livraison |
| Achats → réception | Fait | Stock mis à jour à la réception |
| Factures PDF / paiement / duplication | Fait | Statuts dérivés des paiements |
| Paiements / dépenses | Fait | Filtres période, justificatif URL |
| Employés / tâches kanban | Fait | Responsable + module associé |
| Documents | Fait | Upload Storage |
| Rapports CSV/XLSX/PDF | Fait | Filtres date + client |
| Recherche globale + notifications | Fait | Alertes stock, retard, tâches |
| Paramètres + audit + profil | Fait | |
| i18n FR/EN + ES/AR (base) | Fait | RTL si `ar` |
| Responsive | Fait | Sidebar mobile, tables → cartes |
| Seed démo + purge | Fait | `is_demo` |
| Tests métier | Fait | totaux, stock, RBAC |

Architecture : `docs/ARCHITECTURE.md` · Schéma : `docs/DATABASE.md` · SQL : `supabase/migrations/0001_init.sql`
