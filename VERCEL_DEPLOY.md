# 🚀 Déploiement Vercel - Guide Complet

## 🎯 Architecture Finale

```
Frontend Admin   →  Vercel (admin.whalesrecords.com)
Frontend Artist  →  Vercel (artist.whalesrecords.com)
Backend API      →  Hetzner 8GB (api.whalesrecords.com)
Database         →  Supabase
```

---

## ⚡ Étape 1 : Frontend Admin sur Vercel

### 1.1 Créer un compte Vercel

1. Allez sur **https://vercel.com/signup**
2. Cliquez "Continue with GitHub"
3. Autorisez Vercel à accéder à vos repos

### 1.2 Importer le projet

1. Cliquez sur **"Add New..."** → **"Project"**
2. Cherchez et sélectionnez le repo **`whalesrecords/roy`**
3. Cliquez **"Import"**

### 1.3 Configuration du projet Admin

**Configure Project:**

- **Project Name:** `royalties-admin`
- **Framework Preset:** Next.js
- **Root Directory:** `frontend` ← IMPORTANT!
- **Build Command:** `next build` (détecté auto)
- **Output Directory:** `.next` (détecté auto)
- **Install Command:** `npm install` (détecté auto)

**Environment Variables:** (Cliquez "Add")

```env
NEXT_PUBLIC_API_URL=https://api.whalesrecords.com
NEXT_PUBLIC_SUPABASE_URL=https://huolkgcnizwrhzyboemd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1b2xrZ2NuaXp3cmh6eWJlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2NjI0NjUsImV4cCI6MjAyNTIzODQ2NX0.oPvj_8NJKwBBmN7p_7jxaBZ-EE-MKYkHPMfvM_EuDSc
```

4. Cliquez **"Deploy"**
5. Attendez 2-3 minutes ☕

### 1.4 Ajouter un domaine custom

Une fois le déploiement terminé :

1. Allez dans **Settings** → **Domains**
2. Ajoutez le domaine : `admin.whalesrecords.com`
3. Vercel vous donnera un CNAME (ex: `cname.vercel-dns.com`)
4. Allez dans votre registrar DNS (OVH, Cloudflare, etc.)
5. Ajoutez l'enregistrement CNAME :
   ```
   Type: CNAME
   Name: admin
   Value: cname.vercel-dns.com
   ```
6. Attendez quelques minutes (propagation DNS)
7. Vercel activera automatiquement le SSL (HTTPS)

✅ **Frontend Admin terminé!**

---

## 🎨 Étape 2 : Frontend Artist sur Vercel

### 2.1 Créer un second projet

1. Dans le dashboard Vercel, cliquez **"Add New..."** → **"Project"**
2. Sélectionnez à nouveau le repo **`whalesrecords/roy`**

### 2.2 Configuration du projet Artist

**Configure Project:**

- **Project Name:** `royalties-artist`
- **Framework Preset:** Next.js
- **Root Directory:** `frontend-artist` ← IMPORTANT!
- **Build Command:** `next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

**Environment Variables:**

```env
NEXT_PUBLIC_API_URL=https://api.whalesrecords.com
NEXT_PUBLIC_SUPABASE_URL=https://huolkgcnizwrhzyboemd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1b2xrZ2NuaXp3cmh6eWJlb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2NjI0NjUsImV4cCI6MjAyNTIzODQ2NX0.oPvj_8NJKwBBmN7p_7jxaBZ-EE-MKYkHPMfvM_EuDSc
```

3. Cliquez **"Deploy"**

### 2.3 Ajouter un domaine custom

1. **Settings** → **Domains**
2. Ajoutez : `artist.whalesrecords.com` (ou `app.whalesrecords.com`)
3. Ajoutez le CNAME dans votre DNS :
   ```
   Type: CNAME
   Name: artist
   Value: cname.vercel-dns.com
   ```

✅ **Frontend Artist terminé!**

---

## 🖥️ Étape 3 : Nettoyer Coolify

Maintenant que les frontends sont sur Vercel, supprimez-les de Coolify :

1. Ouvrez Coolify : `http://46.224.19.144:8000`
2. Trouvez les services **Frontend Admin** et **Frontend Artist**
3. Pour chacun :
   - Cliquez sur le service
   - "Stop"
   - "Delete"
4. Gardez uniquement le service **Backend**

**Résultat :** Votre backend aura maintenant 7GB+ de RAM disponible!

---

## 🔄 Étape 4 : Redéployer le Backend

Le backend a un fix important (correction du bug d'import promo).

1. Dans Coolify, allez sur le service **Backend**
2. Cliquez **"Redeploy"** ou **"Deploy"**
3. Attendez 2-3 minutes
4. Vérifiez que le status passe à "Running"

---

## 🌐 Étape 5 : Configuration DNS Finale

Dans votre registrar (OVH, Cloudflare, Namecheap, etc.), configurez :

```
admin.whalesrecords.com    CNAME  cname.vercel-dns.com
artist.whalesrecords.com   CNAME  cname.vercel-dns.com
api.whalesrecords.com      A      46.224.19.144
```

**Note :** Si vous utilisez Cloudflare, désactivez le proxy (nuage gris) pour les CNAME Vercel.

---

## ✅ Vérification

### Test Frontend Admin
1. Ouvrez https://admin.whalesrecords.com
2. Connectez-vous avec vos identifiants
3. Vérifiez que les pages chargent rapidement

### Test Frontend Artist
1. Ouvrez https://artist.whalesrecords.com
2. Testez avec un code artiste
3. Vérifiez les pages (stats, releases, etc.)

### Test Backend
```bash
curl https://api.whalesrecords.com/health
# Devrait retourner: {"status":"healthy"}
```

### Test Import Promo
1. Allez sur https://admin.whalesrecords.com/promo/import
2. Uploadez un CSV SubmitHub
3. Devrait maintenant fonctionner sans erreur 500!

---

## 🎁 Features Bonus Vercel

### 1. Preview Deployments (Automatique)

Chaque Pull Request GitHub aura une URL de preview :

```
PR #42 → https://royalties-admin-git-feature-xyz-yourname.vercel.app
```

Parfait pour tester avant de merger!

### 2. Analytics (Gratuit)

Activez Vercel Analytics :
1. Project → Analytics
2. Enable Web Analytics
3. Voyez les page views, performance (Core Web Vitals)

### 3. Git Auto-Deploy

Déjà configuré automatiquement :

```
git push origin main
   ↓
Vercel détecte le commit
   ↓
Build automatique
   ↓
Déploiement automatique
   ↓
Live en 2-3 minutes!
```

### 4. Rollback Instantané

Un bug en production?
1. Project → Deployments
2. Trouvez le déploiement précédent (qui fonctionnait)
3. Cliquez "Promote to Production"
4. Rollback en 10 secondes!

### 5. Logs en temps réel

Dans Vercel :
- Deployment Logs → Voir les erreurs de build
- Function Logs → Voir les erreurs runtime
- Analytics → Voir les erreurs utilisateurs

---

## 🔧 Troubleshooting

### DNS ne se propage pas

**Symptôme :** `admin.whalesrecords.com` ne charge pas après 10 minutes

**Solution :**
```bash
# Vérifiez la propagation DNS
nslookup admin.whalesrecords.com

# Devrait montrer le CNAME Vercel
# Si "NXDOMAIN" → le DNS n'est pas encore propagé (attendez 5-30 min)
```

### Build Vercel échoue

**Symptôme :** "Build failed" dans Vercel

**Solution :**
1. Vérifiez les logs de build dans Vercel
2. Vérifiez que le **Root Directory** est correct (`frontend` ou `frontend-artist`)
3. Vérifiez que toutes les **Environment Variables** sont définies

### API CORS Error

**Symptôme :** "CORS policy blocked" dans la console browser

**Solution :** Votre backend est déjà configuré avec `allow_origins=["*"]`, donc ça devrait fonctionner. Si problème :
1. Vérifiez que `NEXT_PUBLIC_API_URL` pointe vers `https://api.whalesrecords.com`
2. Redéployez le backend dans Coolify

### Frontend charge mais affiche "Failed to fetch"

**Symptôme :** Page charge mais données ne s'affichent pas

**Solution :**
1. Ouvrez la console browser (F12)
2. Regardez l'onglet Network
3. Vérifiez que les requêtes vont vers `https://api.whalesrecords.com`
4. Si elles vont vers un mauvais domaine → vérifiez `NEXT_PUBLIC_API_URL` dans Vercel settings

---

## 💰 Coûts

| Service | Coût mensuel |
|---------|--------------|
| Vercel (2 projets) | **0€** (Free tier) |
| Hetzner CX32 | 8,35€ |
| Supabase | 0€ (Free tier) |
| **TOTAL** | **8,35€/mois** |

**Limites Vercel Free tier :**
- 100 GB de bande passante/mois
- 6000 minutes de build/mois
- 100 déploiements/jour

Largement suffisant pour votre usage!

---

## 📊 Monitoring

### Uptime Monitoring (Gratuit)

Utilisez **UptimeRobot** (gratuit) pour surveiller vos services :

1. https://uptimerobot.com
2. Ajoutez 3 monitors :
   - `https://admin.whalesrecords.com` (HTTP 200)
   - `https://artist.whalesrecords.com` (HTTP 200)
   - `https://api.whalesrecords.com/health` (HTTP 200)
3. Recevez des alertes email si un service est down

### Performance Monitoring

Vercel Analytics (gratuit) vous donne :
- Temps de chargement des pages
- Core Web Vitals (Google)
- Top pages visitées
- Géolocalisation des visiteurs

---

## 🚀 Prochaines Étapes

Une fois tout migré sur Vercel :

### 1. **Activer les Preview Deployments**
Déjà activé par défaut! Chaque PR = URL de test.

### 2. **Configurer les Notifications**
Dans Vercel → Settings → Notifications :
- Email quand un déploiement échoue
- Slack/Discord webhook pour les déploiements

### 3. **Optimiser les Images**
Next.js Image Optimization est gratuit sur Vercel :
```jsx
import Image from 'next/image'

<Image
  src="/artwork.jpg"
  width={300}
  height={300}
  alt="Album"
/>
```
Les images sont auto-optimisées (WebP, lazy loading, etc.)

### 4. **Ajouter Google Analytics**
Dans `frontend/pages/_app.tsx` et `frontend-artist/pages/_app.tsx`

### 5. **Configurer le Cache**
Vercel cache automatiquement les pages statiques. Pour les API :
```tsx
export const revalidate = 60; // Revalidate toutes les 60 secondes
```

---

## 🎉 Félicitations!

Vous avez maintenant :
- ✅ Frontend ultra-rapide avec CDN mondial
- ✅ Backend stable avec 8GB RAM
- ✅ Déploiements automatiques sur git push
- ✅ Preview URLs pour tester avant production
- ✅ SSL automatique sur tous les domaines
- ✅ Rollback instantané en cas de problème
- ✅ Architecture professionnelle et scalable
- ✅ Coûts optimisés (8,35€/mois)

**Bienvenue dans le club des architectures modernes!** 🚀
