# Agent IA Elyamaje

Conseillère virtuelle qui répond aux clients d'Elyamaje (produits, livraison, retours, formations) à partir de la FAQ.

## Architecture

```
Navigateur (fenêtre de chat)
        │  message du client
        ▼
Next.js — application unique (conteneur « app »)
  ├─ src/components/Chat.tsx      fenêtre de discussion (affichage en direct)
  ├─ src/app/api/chat/route.ts    reçoit le message, renvoie la réponse en flux continu
  ├─ src/lib/agent.ts             cerveau de l'agent : consignes, outils, appel à Claude
  ├─ src/lib/connaissances.ts     transforme la FAQ de la base en texte pour l'agent
  └─ src/lib/conversations.ts     enregistrement et relecture des conversations
        │                                   │
        ▼                                   ▼
PostgreSQL (conteneur « db »)          API Claude (Anthropic)
  faq_entries              base de connaissances
  conversations, messages  historique des discussions
  questions_sans_reponse   journal des questions à ajouter à la FAQ
  demandes_humain          demandes à traiter par l'équipe
```

Au démarrage, `scripts/init-db.mjs` crée les tables et réimporte `donnees/faq-elyamaje.md`.
Les notes `[À COMPLÉTER]` / `[À VÉRIFIER]` sont retirées, et une question sans réponse n'est pas importée.

## Démarrer

1. Installer Docker Desktop.
2. Copier `.env.example` en `.env` et renseigner `ANTHROPIC_API_KEY` et `POSTGRES_PASSWORD`.
3. Lancer :
   ```
   docker compose up -d --build
   ```
4. Ouvrir http://localhost:3080 (port réglé par `APP_PORT` dans `.env`).

Vérifier l'état : http://localhost:3080/api/health

## Commandes utiles

| Action | Commande |
|---|---|
| Voir les journaux de l'application | `docker compose logs -f app` |
| Recharger la FAQ après modification | `docker compose restart app` |
| Appliquer une modification du code | `docker compose up -d --build` |
| Arrêter | `docker compose down` |
| Consulter les questions sans réponse | `docker compose exec db psql -U elyamaje -c "SELECT cree_le, question FROM questions_sans_reponse ORDER BY id DESC LIMIT 20"` |
| Consulter les demandes à traiter | `docker compose exec db psql -U elyamaje -c "SELECT cree_le, motif, resume, contact FROM demandes_humain ORDER BY id DESC LIMIT 20"` |

## Réglages (.env)

| Variable | Rôle | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé de l'API Claude (payante). Sans clé valide :  | vide |
| `AGENT_MODE` | `auto` (IA si clé valide), `ia` ou `sans-ia` | `auto` |
| `POSTGRES_PASSWORD` | Mot de passe de la base | obligatoire |
| `CLAUDE_MODEL` | Modèle utilisé | `claude-opus-5-5` |
| `CLAUDE_EFFORT` | Profondeur de réflexion (`low` → `max`) | `low` |
| `APP_PORT` | Port local | `3000` |
