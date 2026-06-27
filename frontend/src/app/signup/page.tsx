'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Reference lists (starter — editable later in label settings).
const DIGITAL = ['Believe / TuneCore', 'The Orchard', 'FUGA', 'IDOL', 'DistroKid', 'CD Baby', 'Symphonic', 'AWAL', 'ONErpm', 'Ditto Music', 'Horus Music', 'iMusician', 'RouteNote', 'Amuse'];
const PHYSICAL = ['Believe Distribution', 'The Orchard', 'PIAS', 'Differ-ant', 'Modulor', 'Socadisc', "L'Autre Distribution", 'Musicast', 'Wagram', 'Season of Mist', 'Rough Trade'];
const ONLINE = ['Bandcamp', 'Boutique Shopify', 'Big Cartel', 'Music Glue', 'Amazon', 'Apple Music Store', 'Qobuz', 'Beatport', 'Juno', '7digital', 'Discogs', 'Fnac.com'];
const TOOLS = ['SubmitHub', 'Groover', 'Spotify for Artists', 'Apple Music for Artists', 'Meta Ads', 'Chartmetric', 'Soundcharts', 'Songstats', 'Linkfire', 'Feature.fm', 'Linktree'];

const STEPS = ['Compte', 'Label', 'Artistes', 'Distribution', 'Outils', 'Récap'];

type Artist = { name: string; spotify_id?: string; image_url?: string };

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string } | null>(null);

  // Step 1 — account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [haveAccount, setHaveAccount] = useState(false);

  // Step 2 — label
  const [labelName, setLabelName] = useState('');
  const [country, setCountry] = useState('France');
  const [accent, setAccent] = useState('#EF7E2E');
  const [logo, setLogo] = useState<string | null>(null);

  // Step 3 — artists
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artistInput, setArtistInput] = useState('');

  // Steps 4/5 — distributors & tools (name -> kind)
  const [digital, setDigital] = useState<Set<string>>(new Set());
  const [physical, setPhysical] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [otherDigital, setOtherDigital] = useState('');
  const [otherPhysical, setOtherPhysical] = useState('');
  const [otherOnline, setOtherOnline] = useState('');
  const [otherTools, setOtherTools] = useState('');

  const slug = labelName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, v: string) {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  }

  function addArtist() {
    const n = artistInput.trim();
    if (n && !artists.some((a) => a.name.toLowerCase() === n.toLowerCase())) {
      setArtists([...artists, { name: n }]);
    }
    setArtistInput('');
  }

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(f);
  }

  // Step 1 → create or sign in the Supabase account.
  async function submitAccount() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Adresse e-mail invalide.');
    if (!haveAccount && password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.');
    setBusy(true);
    try {
      const { error: e1 } = haveAccount
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (e1) { setError(e1.message); return; }
      // Need a session (JWT) to finish. If email confirmation is required,
      // signUp won't return one — guide the user.
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setError("Compte créé. Confirmez votre e-mail puis revenez et choisissez « J'ai déjà un compte ».");
        return;
      }
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function submitAll() {
    setError(null);
    if (!labelName.trim()) { setStep(2); return setError('Le nom du label est requis.'); }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { setError('Session expirée — reconnectez-vous (étape 1).'); setStep(1); return; }

      const distributors = [
        ...Array.from(digital).map((name) => ({ kind: 'digital', name })),
        ...Array.from(physical).map((name) => ({ kind: 'physical', name })),
        ...Array.from(online).map((name) => ({ kind: 'online_sales', name })),
        ...Array.from(tools).map((name) => ({ kind: 'tool', name })),
        ...(otherDigital.trim() ? [{ kind: 'digital', name: otherDigital.trim() }] : []),
        ...(otherPhysical.trim() ? [{ kind: 'physical', name: otherPhysical.trim() }] : []),
        ...(otherOnline.trim() ? [{ kind: 'online_sales', name: otherOnline.trim() }] : []),
        ...(otherTools.trim() ? [{ kind: 'tool', name: otherTools.trim() }] : []),
      ];

      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          label_name: labelName.trim(),
          country: country || null,
          accent_color: accent,
          logo_base64: logo,
          artists,
          distributors,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.detail || 'Une erreur est survenue. Réessayez.');
        return;
      }
      const j = await res.json();
      setDone({ slug: j.slug });
    } finally {
      setBusy(false);
    }
  }

  // ---- shared styles ----
  const input = 'w-full h-11 px-3 bg-surface border border-line-strong rounded-[10px] text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors';
  const label = 'block text-[12px] font-semibold text-ink-muted mb-1.5';
  const primary = 'w-full h-11 rounded-[10px] bg-accent text-white font-semibold text-[14px] disabled:opacity-50 transition-opacity';
  const ghost = 'h-11 px-4 rounded-[10px] border border-line text-ink-muted text-[14px]';
  const chip = (on: boolean) => `text-[12.5px] px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-accent text-white border-accent' : 'bg-surface text-ink-muted border-line'}`;

  if (done) {
    return (
      <Shell>
        <div className="text-center py-6">
          <div className="text-3xl mb-3">✅</div>
          <h1 className="text-[18px] font-bold text-ink mb-2">Votre label « {labelName} » a été créé</h1>
          <p className="text-[13.5px] text-ink-muted leading-relaxed">
            Statut : <strong>en attente de validation</strong>. L'équipe Whales activera votre espace
            et vous recevrez un e-mail à l'activation.
          </p>
          <a href="/login" className={`${primary} inline-flex items-center justify-center mt-6 px-6`} style={{ width: 'auto' }}>
            Aller à la connexion
          </a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold text-ink-muted">Étape {step}/6 · {STEPS[step - 1]}</span>
          <span className="text-[11px] text-ink-faint">Créer votre espace label</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-[10px] bg-[rgba(220,76,87,0.1)] text-neg text-[12.5px]">{error}</div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="email">E-mail professionnel *</label>
            <input id="email" type="email" className={input} placeholder="vous@votre-label.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="pwd">Mot de passe *</label>
            <input id="pwd" type="password" className={input} placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-[12.5px] text-ink-muted">
            <input type="checkbox" checked={haveAccount} onChange={(e) => setHaveAccount(e.target.checked)} />
            J'ai déjà un compte
          </label>
          <button className={primary} disabled={busy} onClick={submitAccount}>{busy ? '…' : 'Continuer →'}</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="ln">Nom du label *</label>
            <input id="ln" className={input} placeholder="Mon Super Label" value={labelName} onChange={(e) => setLabelName(e.target.value)} />
            {slug && <p className="text-[11px] text-ink-faint mt-1">Adresse : {slug}</p>}
          </div>
          <div>
            <label className={label} htmlFor="co">Pays</label>
            <input id="co" className={input} placeholder="France" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className={label} htmlFor="lg">Logo (PNG/JPG, fond clair)</label>
              <input id="lg" type="file" accept="image/*" onChange={onLogoFile} className="text-[12px] text-ink-muted" />
            </div>
            {logo && <img src={logo} alt="aperçu logo" className="w-12 h-12 rounded-[8px] object-contain border border-line" />}
          </div>
          <div>
            <label className={label} htmlFor="ac">Couleur d'accent</label>
            <input id="ac" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-16 rounded border border-line bg-surface" />
          </div>
          <NavRow onBack={() => setStep(1)} onNext={() => { if (!labelName.trim()) return setError('Le nom du label est requis.'); setError(null); setStep(3); }} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className={label} htmlFor="ar">Ajouter un artiste</label>
            <div className="flex gap-2">
              <input id="ar" className={input} placeholder="Nom de l'artiste" value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addArtist())} />
              <button className={ghost} onClick={addArtist} type="button">Ajouter</button>
            </div>
            <p className="text-[11px] text-ink-faint mt-1">Vous pourrez enrichir vos artistes (photo, Spotify) plus tard dans l'app.</p>
          </div>
          {artists.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {artists.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 rounded-full bg-surface-2 text-ink">
                  {a.name}
                  <button type="button" onClick={() => setArtists(artists.filter((_, j) => j !== i))} className="text-ink-faint">✕</button>
                </span>
              ))}
            </div>
          )}
          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel={artists.length ? 'Continuer →' : 'Passer →'} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <CheckGroup title="Digital (streaming / téléchargement)" items={DIGITAL} sel={digital} onToggle={(v) => toggle(digital, setDigital, v)} other={otherDigital} onOther={setOtherDigital} chip={chip} input={input} label={label} />
          <CheckGroup title="Physique (CD / vinyle)" items={PHYSICAL} sel={physical} onToggle={(v) => toggle(physical, setPhysical, v)} other={otherPhysical} onOther={setOtherPhysical} chip={chip} input={input} label={label} />
          <CheckGroup title="Vente en ligne (D2C / marketplaces)" items={ONLINE} sel={online} onToggle={(v) => toggle(online, setOnline, v)} other={otherOnline} onOther={setOtherOnline} chip={chip} input={input} label={label} />
          <NavRow onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-5">
          <CheckGroup title="Outils (promo / analytics / smartlinks)" items={TOOLS} sel={tools} onToggle={(v) => toggle(tools, setTools, v)} other={otherTools} onOther={setOtherTools} chip={chip} input={input} label={label} />
          <NavRow onBack={() => setStep(4)} onNext={() => setStep(6)} />
        </div>
      )}

      {step === 6 && (
        <div className="space-y-3">
          <Recap k="Label" v={`${labelName || '—'}${slug ? ` (${slug})` : ''}`} onEdit={() => setStep(2)} />
          <Recap k="Artistes" v={artists.map((a) => a.name).join(', ') || 'Aucun'} onEdit={() => setStep(3)} />
          <Recap k="Distribution" v={[...Array.from(digital), ...Array.from(physical), ...Array.from(online)].join(', ') || 'Aucune'} onEdit={() => setStep(4)} />
          <Recap k="Outils" v={Array.from(tools).join(', ') || 'Aucun'} onEdit={() => setStep(5)} />
          <p className="text-[12px] text-ink-muted bg-surface-2 rounded-[10px] px-3 py-2">
            ⓘ Votre label sera créé puis validé par l'équipe Whales avant activation.
          </p>
          <div className="flex gap-2 pt-1">
            <button className={ghost} onClick={() => setStep(5)} type="button">← Retour</button>
            <button className={primary} disabled={busy} onClick={submitAll}>{busy ? 'Création…' : 'Créer mon label'}</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-app flex items-start sm:items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[560px] bg-surface rounded-[16px] border border-line p-6 sm:p-8">
        <h2 className="text-[15px] font-bold text-ink mb-5">Whales Records — Inscription label</h2>
        {children}
      </div>
    </main>
  );
}

function NavRow({ onBack, onNext, nextLabel = 'Continuer →' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-2 pt-1">
      <button className="h-11 px-4 rounded-[10px] border border-line text-ink-muted text-[14px]" onClick={onBack} type="button">← Retour</button>
      <button className="flex-1 h-11 rounded-[10px] bg-accent text-white font-semibold text-[14px]" onClick={onNext} type="button">{nextLabel}</button>
    </div>
  );
}

function Recap({ k, v, onEdit }: { k: string; v: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-ink-muted">{k}</div>
        <div className="text-[13px] text-ink break-words">{v}</div>
      </div>
      <button type="button" onClick={onEdit} className="text-[12px] text-accent shrink-0">Modifier</button>
    </div>
  );
}

function CheckGroup({ title, items, sel, onToggle, other, onOther, chip, input, label }: {
  title: string; items: string[]; sel: Set<string>; onToggle: (v: string) => void;
  other: string; onOther: (v: string) => void; chip: (on: boolean) => string; input: string; label: string;
}) {
  return (
    <div>
      <div className={label}>{title}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((it) => (
          <button key={it} type="button" className={chip(sel.has(it))} onClick={() => onToggle(it)}>{it}</button>
        ))}
      </div>
      <input className={input} placeholder="+ autre…" value={other} onChange={(e) => onOther(e.target.value)} />
    </div>
  );
}
