# Déploiement Hetzner + Coolify

## 1. Créer un serveur Hetzner

1. Va sur https://console.hetzner.cloud
2. Crée un nouveau projet "royalties"
3. Ajoute un serveur:
   - **Location**: Falkenstein (eu-central)
   - **Image**: Ubuntu 24.04
   - **Type**: CX22 (2 vCPU, 4GB RAM, 40GB) - 4,35€/mois
   - **SSH Key**: Ajoute ta clé SSH
4. Note l'IP du serveur

## 2. Installer Coolify

Connecte-toi au serveur:
```bash
ssh root@YOUR_SERVER_IP
```

Installe Coolify:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Accède à Coolify: `http://YOUR_SERVER_IP:8000`

## 3. Configurer le domaine (optionnel)

Ajoute des enregistrements DNS:
- `A` → `app.tondomaine.com` → `YOUR_SERVER_IP`
- `A` → `api.tondomaine.com` → `YOUR_SERVER_IP`

## 4. Déployer l'application

### Dans Coolify:

1. **Ajouter la source GitHub:**
   - Settings → Sources → Add GitHub App
   - Autorise l'accès au repo `whalesrecords/roy`

2. **Déployer le Backend:**
   - New Resource → Docker Compose
   - Repository: `whalesrecords/roy`
   - Compose file: Utilise seulement le service `backend`
   - Variables d'environnement:
     ```
     DATABASE_URL=postgresql+asyncpg://postgres:xxx@db.huolkgcnizwrhzyboemd.supabase.co:5432/postgres
     ADMIN_TOKEN=ton-token-admin-securise
     SPOTIFY_CLIENT_ID=xxx
     SPOTIFY_CLIENT_SECRET=xxx
     ```
   - Domaine: `api.tondomaine.com`

3. **Déployer le Frontend:**
   - New Resource → Docker Compose
   - Repository: `whalesrecords/roy`
   - Path: `/frontend`
   - Build args:
     ```
     NEXT_PUBLIC_API_URL=https://api.tondomaine.com
     NEXT_PUBLIC_SUPABASE_URL=https://huolkgcnizwrhzyboemd.supabase.co
     NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
     ```
   - Domaine: `app.tondomaine.com`

## 5. SSL automatique

Coolify configure automatiquement Let's Encrypt SSL pour tes domaines.

## 6. Stockage (optionnel)

Pour le stockage de fichiers volumineux:

1. **Hetzner Storage Box** (recommandé):
   - Console Hetzner → Storage Box → BX11 (1TB, 3,81€/mois)
   - Monte via SFTP ou CIFS

2. **Backblaze B2** (alternative S3):
   - 10GB gratuits, puis $5/TB/mois

## Commandes utiles

```bash
# Voir les logs
docker logs -f <container_name>

# Redémarrer un service
docker restart <container_name>

# Mise à jour Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

## Architecture finale

```
┌─────────────────────────────────────────┐
│          Hetzner VPS (CX22)             │
│  ┌─────────────┐  ┌─────────────────┐   │
│  │  Frontend   │  │    Backend      │   │
│  │  Next.js    │  │    FastAPI      │   │
│  │  :3000      │→→│    :8000        │   │
│  └─────────────┘  └────────┬────────┘   │
│         ↓                  ↓            │
│  ┌─────────────────────────────────┐    │
│  │      Coolify (reverse proxy)    │    │
│  │      + Let's Encrypt SSL        │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                     ↓
        ┌────────────────────────┐
        │       Supabase         │
        │  PostgreSQL + Auth     │
        └────────────────────────┘
```

## Coûts mensuels

| Service | Coût |
|---------|------|
| Hetzner CX22 | 4,35€ |
| Supabase Free | 0€ |
| **Total** | **~5€/mois** |

Pour scaler:
- CX32 (4 vCPU, 8GB): 8,35€/mois
- Supabase Pro: $25/mois
- Storage Box 1TB: 3,81€/mois
