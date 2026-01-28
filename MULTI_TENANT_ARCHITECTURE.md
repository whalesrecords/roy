# 🏢 Architecture Multi-Tenant Scalable

## 🎯 Objectif

Transformer l'application en **SaaS multi-tenant** capable de gérer des dizaines/centaines de labels musicaux indépendants avec isolation des données, custom branding, et billing séparé.

---

## 📐 Architecture Globale

```
┌──────────────────────────────────────────────────────────┐
│           🎛️ Platform Admin (Super Admin)               │
│     Gestion labels, onboarding, billing, monitoring      │
│              platform.whalesrecords.com                   │
│                      Vercel                               │
└────────────────────────┬─────────────────────────────────┘
                         │
        ┌────────────────┼────────────────────┐
        │                │                    │
        ▼                ▼                    ▼
┌──────────────┐  ┌──────────────┐    ┌──────────────┐
│ Label 1      │  │ Label 2      │    │ Label N      │
│ "Whales Rec" │  │ "Indie Label"│    │ "BigLabel"   │
│              │  │              │    │              │
│ 🎨 Admin     │  │ 🎨 Admin     │    │ 🎨 Admin     │
│ whales.roy.. │  │ indie.roy..  │    │ custom.com   │
│              │  │              │    │              │
│ 🎤 Artists   │  │ 🎤 Artists   │    │ 🎤 Artists   │
│ artist.wh..  │  │ artist.ind.. │    │ art.custom   │
└──────┬───────┘  └──────┬───────┘    └──────┬───────┘
       │                 │                    │
       └─────────────────┴────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   🔀 API Gateway     │
              │   Load Balancer      │
              │   Rate Limiting      │
              │   SSL Termination    │
              └──────────┬───────────┘
                         │
                         ▼
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Backend 1    │  │ Backend 2    │  │ Backend N    │
│ FastAPI      │  │ FastAPI      │  │ FastAPI      │
│ Hetzner      │  │ Hetzner      │  │ Hetzner      │
│ (Auto-scale) │  │ (Auto-scale) │  │ (Auto-scale) │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┴─────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   Supabase Pro       │
              │   PostgreSQL         │
              │   + Row Level Sec.   │
              │                      │
              │   All labels         │
              │   Single database    │
              └──────────┬───────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Redis Cache  │  │ S3 Storage   │  │ Analytics    │
│ Sessions     │  │ Files/CSV    │  │ Mixpanel     │
│ Rate limits  │  │ Backblaze B2 │  │ or PostHog   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 🗄️ Base de Données Multi-tenant

### 1. Table centrale: `labels`

```sql
CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identité
    name VARCHAR(255) NOT NULL,                    -- "Warner Music France"
    slug VARCHAR(100) UNIQUE NOT NULL,             -- "warner-france"
    legal_name VARCHAR(255),                       -- "Warner Music France SAS"
    siret VARCHAR(14),                             -- Pour France

    -- Domaines
    subdomain VARCHAR(100) UNIQUE NOT NULL,        -- "warner" → warner.royalties.app
    custom_domain VARCHAR(255),                    -- "royalties.warnermusic.fr"
    custom_domain_verified BOOLEAN DEFAULT FALSE,

    -- Branding
    logo_url VARCHAR(500),
    logo_dark_url VARCHAR(500),                    -- Pour dark mode
    primary_color VARCHAR(7) DEFAULT '#3B82F6',    -- Bleu par défaut
    accent_color VARCHAR(7),
    favicon_url VARCHAR(500),

    -- Subscription & Billing
    plan VARCHAR(50) DEFAULT 'trial',              -- "trial", "starter", "pro", "enterprise"
    status VARCHAR(20) DEFAULT 'trial',            -- "trial", "active", "suspended", "cancelled"
    trial_ends_at TIMESTAMP,
    subscription_starts_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    mrr DECIMAL(10, 2),                            -- Monthly Recurring Revenue

    -- Limites du plan
    max_artists INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 5,
    max_transactions_per_month INTEGER DEFAULT 10000,
    max_api_calls_per_day INTEGER DEFAULT 1000,

    -- Features flags
    features JSONB DEFAULT '{}',                   -- {"advanced_analytics": true, "api_access": false}

    -- Settings
    settings JSONB DEFAULT '{}',                   -- Custom settings per label
    /*
    {
      "currency": "EUR",
      "timezone": "Europe/Paris",
      "language": "fr",
      "fiscal_year_start": "01-01",
      "default_royalty_rate": 0.20,
      "invoice_prefix": "INV",
      "email_notifications": true
    }
    */

    -- Contact & Billing
    owner_email VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    billing_email VARCHAR(255),
    technical_contact_email VARCHAR(255),
    phone VARCHAR(50),

    -- Adresse
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),                            -- ISO code: "FR", "US", etc.

    -- Stripe (pour billing)
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),

    -- Metrics (cache)
    total_artists INTEGER DEFAULT 0,
    total_revenue_ytd DECIMAL(15, 2) DEFAULT 0,
    storage_used_gb DECIMAL(10, 2) DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP,

    -- Soft delete
    deleted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_labels_slug ON labels(slug);
CREATE INDEX idx_labels_subdomain ON labels(subdomain);
CREATE INDEX idx_labels_custom_domain ON labels(custom_domain);
CREATE INDEX idx_labels_status ON labels(status);
CREATE INDEX idx_labels_plan ON labels(plan);
CREATE INDEX idx_labels_owner_email ON labels(owner_email);
```

### 2. Ajouter `label_id` à TOUTES les tables existantes

```sql
-- Artists
ALTER TABLE artists ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_artists_label_id ON artists(label_id);

-- Transactions
ALTER TABLE transactions_normalized ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_transactions_label_id ON transactions_normalized(label_id);

-- Advance Ledger
ALTER TABLE advance_ledger ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_advance_ledger_label_id ON advance_ledger(label_id);

-- Contracts
ALTER TABLE contracts ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_contracts_label_id ON contracts(label_id);

-- Release Artwork
ALTER TABLE release_artwork ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_release_artwork_label_id ON release_artwork(label_id);

-- Track Artwork
ALTER TABLE track_artwork ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_track_artwork_label_id ON track_artwork(label_id);

-- Promo Submissions
ALTER TABLE promo_submissions ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_promo_submissions_label_id ON promo_submissions(label_id);

-- Promo Campaigns
ALTER TABLE promo_campaigns ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_promo_campaigns_label_id ON promo_campaigns(label_id);

-- Imports
ALTER TABLE imports ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_imports_label_id ON imports(label_id);

-- Tickets
ALTER TABLE tickets ADD COLUMN label_id UUID REFERENCES labels(id) ON DELETE CASCADE;
CREATE INDEX idx_tickets_label_id ON tickets(label_id);

-- Repeat for ALL tables...
```

### 3. Row Level Security (RLS) pour isolation complète

```sql
-- Enable RLS sur toutes les tables
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions_normalized ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
-- Répéter pour TOUTES les tables

-- Policy globale: Les utilisateurs ne voient QUE leur label
CREATE POLICY "label_isolation_policy"
ON artists
FOR ALL
USING (label_id = current_setting('app.current_label_id', true)::uuid);

-- Répéter cette policy pour chaque table
CREATE POLICY "label_isolation_policy" ON transactions_normalized
FOR ALL USING (label_id = current_setting('app.current_label_id', true)::uuid);

CREATE POLICY "label_isolation_policy" ON advance_ledger
FOR ALL USING (label_id = current_setting('app.current_label_id', true)::uuid);

-- Super admins peuvent tout voir
CREATE POLICY "super_admin_policy"
ON artists
FOR ALL
USING (current_setting('app.user_role', true) = 'super_admin');

-- Répéter pour toutes les tables
```

### 4. Table `users` multi-tenant

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Auth
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                    -- Si auth custom (sinon Supabase)

    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    phone VARCHAR(50),

    -- Multi-tenant
    default_label_id UUID REFERENCES labels(id),  -- Label par défaut à la connexion

    -- Rôle global
    global_role VARCHAR(50) DEFAULT 'user',        -- "super_admin", "support", "user"

    -- Status
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_default_label_id ON users(default_label_id);
```

### 5. Table `user_label_roles` (many-to-many)

Un utilisateur peut avoir accès à plusieurs labels avec des rôles différents.

```sql
CREATE TABLE user_label_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    label_id UUID REFERENCES labels(id) ON DELETE CASCADE,

    -- Rôle dans ce label spécifique
    role VARCHAR(50) NOT NULL,                     -- "admin", "manager", "accountant", "viewer"

    -- Permissions granulaires (optionnel)
    permissions JSONB DEFAULT '{}',
    /*
    {
      "artists": ["read", "write"],
      "contracts": ["read"],
      "finances": ["read", "write"],
      "settings": []
    }
    */

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, label_id)
);

CREATE INDEX idx_user_label_roles_user_id ON user_label_roles(user_id);
CREATE INDEX idx_user_label_roles_label_id ON user_label_roles(label_id);
```

---

## 🔐 Backend Multi-tenant

### 1. Middleware de détection du label

```python
# app/middleware/tenant.py

from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

async def detect_label_from_request(request: Request, db: AsyncSession) -> str:
    """
    Détecte le label_id depuis:
    1. Custom domain (ex: royalties.warnermusic.fr)
    2. Subdomain (ex: warner.royalties.app)
    3. Header X-Label-ID (pour API)
    4. Token JWT (pour utilisateurs authentifiés)
    """

    # 1. Check custom domain
    host = request.headers.get("host", "")
    result = await db.execute(
        select(Label).where(Label.custom_domain == host)
    )
    label = result.scalar_one_or_none()
    if label:
        return str(label.id)

    # 2. Check subdomain
    if "." in host:
        subdomain = host.split(".")[0]
        result = await db.execute(
            select(Label).where(Label.subdomain == subdomain)
        )
        label = result.scalar_one_or_none()
        if label:
            return str(label.id)

    # 3. Check X-Label-ID header (pour API externe)
    label_id = request.headers.get("X-Label-ID")
    if label_id:
        return label_id

    # 4. Check JWT token (user authentifié)
    # TODO: Extract from JWT

    raise HTTPException(status_code=400, detail="Could not determine label context")


async def set_rls_context(db: AsyncSession, label_id: str, user_role: str = "user"):
    """
    Configure Row Level Security context pour Supabase/PostgreSQL.
    Toutes les queries suivantes respecteront automatiquement l'isolation.
    """
    await db.execute(
        text(f"SET app.current_label_id = '{label_id}'")
    )
    await db.execute(
        text(f"SET app.user_role = '{user_role}'")
    )
```

### 2. Dependency FastAPI

```python
# app/dependencies/tenant.py

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.middleware.tenant import detect_label_from_request, set_rls_context

async def get_current_label_id(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> str:
    """
    Dependency qui retourne le label_id actuel.
    À utiliser dans tous les endpoints.
    """
    label_id = await detect_label_from_request(request, db)
    await set_rls_context(db, label_id)
    return label_id


async def get_current_label(
    label_id: str = Depends(get_current_label_id),
    db: AsyncSession = Depends(get_db)
) -> Label:
    """
    Dependency qui retourne l'objet Label complet.
    """
    result = await db.execute(
        select(Label).where(Label.id == UUID(label_id))
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return label
```

### 3. Utilisation dans les endpoints

```python
# app/routers/artists.py

@router.get("/artists")
async def list_artists(
    label_id: str = Depends(get_current_label_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les artistes du label actuel.
    Le RLS s'applique automatiquement, on n'a même pas besoin de filtrer!
    """
    result = await db.execute(
        select(Artist).order_by(Artist.name)
        # Pas besoin de .where(Artist.label_id == label_id)
        # Le RLS le fait automatiquement!
    )
    artists = result.scalars().all()
    return artists


@router.post("/artists")
async def create_artist(
    artist_data: ArtistCreate,
    label: Label = Depends(get_current_label),
    db: AsyncSession = Depends(get_db),
):
    """
    Crée un artiste dans le label actuel.
    """
    # Check limits
    if label.total_artists >= label.max_artists:
        raise HTTPException(
            status_code=402,
            detail=f"Artist limit reached ({label.max_artists}). Please upgrade your plan."
        )

    artist = Artist(
        **artist_data.dict(),
        label_id=label.id  # ← Toujours set le label_id!
    )
    db.add(artist)
    await db.commit()

    # Update counter
    label.total_artists += 1
    await db.commit()

    return artist
```

---

## 🎨 Frontend Multi-tenant

### 1. Architecture frontend

**3 applications distinctes:**

1. **Platform Admin** (`platform.royalties.app`)
   - Gestion des labels (CRUD)
   - Onboarding nouveaux labels
   - Billing global
   - Analytics global
   - Support tickets

2. **Label Admin** (`{subdomain}.royalties.app` ou custom domain)
   - Frontend admin actuel
   - Branding dynamique (logo, couleurs du label)
   - Gestion artistes, royalties, contrats du label

3. **Artist Portal** (`artists.{subdomain}.royalties.app`)
   - Frontend artist actuel
   - Branding dynamique

### 2. Détection du label frontend

```typescript
// lib/tenant.ts

export async function detectLabel(): Promise<Label> {
  const host = window.location.hostname;

  // Call backend API to detect label from domain
  const response = await fetch(`${API_URL}/labels/detect`, {
    headers: {
      'X-Hostname': host,
    },
  });

  if (!response.ok) {
    throw new Error('Label not found');
  }

  return response.json();
}

// Usage in _app.tsx or layout
const [label, setLabel] = useState<Label | null>(null);

useEffect(() => {
  detectLabel().then(setLabel);
}, []);
```

### 3. Branding dynamique

```typescript
// contexts/BrandingContext.tsx

interface BrandingContextType {
  label: Label;
  primaryColor: string;
  logoUrl: string;
}

export const BrandingProvider = ({ children }: { children: ReactNode }) => {
  const { label } = useTenant();

  useEffect(() => {
    // Apply branding dynamically
    document.documentElement.style.setProperty('--primary-color', label.primary_color);
    document.title = `${label.name} - Royalties`;

    // Update favicon
    const favicon = document.querySelector("link[rel='icon']");
    if (favicon && label.favicon_url) {
      favicon.setAttribute('href', label.favicon_url);
    }
  }, [label]);

  return (
    <BrandingContext.Provider value={{ label, primaryColor: label.primary_color, logoUrl: label.logo_url }}>
      {children}
    </BrandingContext.Provider>
  );
};
```

---

## 💰 Plans & Pricing

### Plans suggérés

| Plan | Prix | Artists | Storage | Features |
|------|------|---------|---------|----------|
| **Trial** | Gratuit 14j | 3 | 1 GB | Toutes features |
| **Starter** | 49€/mois | 20 | 10 GB | Analytics basiques, Support email |
| **Pro** | 149€/mois | 100 | 100 GB | Analytics avancés, API access, Support prioritaire |
| **Enterprise** | Sur devis | Illimité | Illimité | White-label, SLA 99.9%, Dedicated support, Custom integrations |

### Table `subscription_plans`

```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,             -- "starter", "pro", "enterprise"
    display_name VARCHAR(100),                    -- "Pro Plan"
    price_monthly DECIMAL(10, 2),
    price_yearly DECIMAL(10, 2),                  -- Avec discount annuel

    -- Limites
    max_artists INTEGER,
    max_storage_gb INTEGER,
    max_transactions_per_month INTEGER,
    max_api_calls_per_day INTEGER,

    -- Features
    features JSONB,
    /*
    {
      "advanced_analytics": true,
      "api_access": true,
      "custom_domain": true,
      "white_label": false,
      "priority_support": true,
      "sla": "99.9"
    }
    */

    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Stripe Integration

```python
# app/services/billing.py

import stripe

async def create_subscription(label: Label, plan: str, payment_method_id: str):
    """
    Crée une souscription Stripe pour un label.
    """
    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Create or retrieve customer
    if not label.stripe_customer_id:
        customer = stripe.Customer.create(
            email=label.billing_email,
            name=label.name,
            metadata={"label_id": str(label.id)},
        )
        label.stripe_customer_id = customer.id
        await db.commit()

    # Get plan pricing
    plan_obj = await get_plan(plan)

    # Create subscription
    subscription = stripe.Subscription.create(
        customer=label.stripe_customer_id,
        items=[{"price": plan_obj.stripe_price_id_monthly}],
        default_payment_method=payment_method_id,
    )

    # Update label
    label.stripe_subscription_id = subscription.id
    label.plan = plan
    label.status = "active"
    label.subscription_starts_at = datetime.now()

    await db.commit()

    return subscription
```

---

## 🚀 Scalabilité Technique

### 1. Load Balancing

Pour scaler au-delà de 100 labels :

```
              ┌──────────────────┐
              │  Hetzner Load    │
              │  Balancer (LB11) │
              │  20€/mois        │
              └────────┬─────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Backend 1    │ │ Backend 2    │ │ Backend 3    │
│ CPX31 8GB    │ │ CPX31 8GB    │ │ CPX31 8GB    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Coût:**
- 1 backend: 8€/mois (jusqu'à ~30 labels)
- 2 backends + LB: ~36€/mois (jusqu'à ~100 labels)
- 3 backends + LB: ~54€/mois (jusqu'à ~200 labels)

### 2. Database Scaling

**Supabase Pro:**
- Jusqu'à 100 GB: 25$/mois
- Pooling automatique
- Read replicas si besoin

**Si > 500 labels:**
- Passer à Supabase Enterprise (~300$/mois)
- Ou auto-héberger PostgreSQL sur Hetzner dédié

### 3. Cache Redis

Pour performance optimal avec beaucoup de labels:

```python
# Cache les settings du label pendant 1h
@cache(ttl=3600, key="label:{label_id}")
async def get_label_settings(label_id: str):
    # ...
```

**Coût:** Hetzner Cloud Redis (CX21): ~5€/mois

---

## 📊 Analytics & Monitoring

### Usage tracking par label

```sql
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY,
    label_id UUID REFERENCES labels(id),

    metric_type VARCHAR(50),  -- "api_calls", "storage_gb", "transactions_processed"
    value DECIMAL(15, 2),

    period_start DATE,
    period_end DATE,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_metrics_label_period ON usage_metrics(label_id, period_start);
```

### Platform Admin Dashboard

Affiche:
- Total labels actifs
- MRR (Monthly Recurring Revenue)
- Churn rate
- Labels à risque (low activity)
- Top labels par revenue
- Support tickets ouverts

---

## 🛣️ Plan de Migration (6-8 semaines)

### Phase 1: Database (Semaine 1-2)
- [ ] Créer table `labels`
- [ ] Ajouter `label_id` à toutes les tables
- [ ] Setup RLS policies
- [ ] Créer table `users` et `user_label_roles`
- [ ] Migration des données existantes (créer 1 label "Whales Records" initial)

### Phase 2: Backend Multi-tenant (Semaine 3-4)
- [ ] Middleware de détection du label
- [ ] Dependencies FastAPI
- [ ] Adapter tous les endpoints existants
- [ ] Tests unitaires multi-tenant
- [ ] API de gestion des labels (CRUD)

### Phase 3: Frontend Platform Admin (Semaine 5)
- [ ] Nouvelle app Next.js `platform-admin`
- [ ] Dashboard global
- [ ] CRUD labels
- [ ] Onboarding flow
- [ ] User management

### Phase 4: Branding Dynamique (Semaine 6)
- [ ] Adapter frontend admin pour branding
- [ ] Adapter frontend artist pour branding
- [ ] Custom domains support
- [ ] SSL automatique par domaine

### Phase 5: Billing (Semaine 7)
- [ ] Intégration Stripe
- [ ] Plans & pricing
- [ ] Webhooks Stripe
- [ ] Usage tracking
- [ ] Invoicing automatique

### Phase 6: Testing & Launch (Semaine 8)
- [ ] Tests end-to-end multi-tenant
- [ ] Load testing (100 labels simulés)
- [ ] Security audit
- [ ] Documentation
- [ ] Beta launch avec 3-5 labels pilotes

---

## 💵 Coûts Projetés

### Startup (1-10 labels)
| Service | Coût |
|---------|------|
| Hetzner CPX31 (1 backend) | 8€/mois |
| Supabase Pro | 25$/mois (~23€) |
| Vercel (frontends) | 0€ (free tier) |
| **Total** | **~31€/mois** |
| **Revenue (10 labels × 49€)** | **490€/mois** |
| **Profit** | **~459€/mois** 🎉 |

### Scale (50 labels)
| Service | Coût |
|---------|------|
| Hetzner (2 backends + LB) | 36€/mois |
| Supabase Pro | 25$/mois |
| Redis Cache | 5€/mois |
| Backblaze B2 Storage (500GB) | 3$/mois |
| **Total** | **~67€/mois** |
| **Revenue (50 labels × 49€)** | **2,450€/mois** |
| **Profit** | **~2,383€/mois** 💰 |

### Scale (200 labels mix)
- 150 Starter (49€) = 7,350€
- 40 Pro (149€) = 5,960€
- 10 Enterprise (500€) = 5,000€
- **Total revenue: 18,310€/mois**

| Service | Coût |
|---------|------|
| Hetzner (3 backends + LB) | 54€/mois |
| Supabase Enterprise | 300$/mois (~280€) |
| Redis Cache | 10€/mois |
| Backblaze B2 (5TB) | 30$/mois (~28€) |
| Support (1 personne) | 3,000€/mois |
| **Total** | **~3,372€/mois** |
| **Profit** | **~14,938€/mois** 🚀 |

---

## 🎯 Next Steps

1. **Valider le business model:**
   - Est-ce que 49€/mois est le bon prix?
   - Combien de labels potentiels?
   - Quelle est votre stratégie d'acquisition?

2. **Prioriser les features:**
   - Commencer par multi-tenant simple (1 subdomain par label)
   - Ou aller full white-label direct (custom domains)?

3. **Calendrier:**
   - Besoin dans combien de temps?
   - Avez-vous déjà des labels intéressés?

4. **Ressources:**
   - Combien de temps pouvez-vous dédier?
   - Besoin d'aide dev additionnelle?

**Voulez-vous que je commence à implémenter Phase 1 (Database multi-tenant)?** 🚀
