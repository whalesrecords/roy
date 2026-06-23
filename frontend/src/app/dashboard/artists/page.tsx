'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import { getArtistsSummary, ArtistSummary } from '@/lib/api';
import { AdminBottomNav } from '@/components/roy/AdminBottomNav';
import { Sheet } from '@/components/roy/Sheet';

const fmtEUR = (s: string | number) => {
  const n = typeof s === 'string' ? parseFloat(s) : s;
  return (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const fmtMillions = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.', ',') + ' K';
  return n.toString();
};

const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default function MobileArtistsPage() {
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ArtistSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getArtistsSummary();
        setArtists(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(a => a.name.toLowerCase().includes(q));
  }, [artists, search]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[124px]" style={{ background: 'var(--bg)' }}>
      <div className="px-5 pt-2 max-w-md mx-auto">
        <div className="py-2 mb-3.5">
          <h1 className="text-[22px] font-bold tracking-[-0.025em]" style={{ color: 'var(--text)' }}>
            Artistes
          </h1>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
            {artists.length} artiste{artists.length > 1 ? 's' : ''} signé{artists.length > 1 ? 's' : ''}
          </div>
        </div>

        {error && (
          <div className="mb-3 px-4 py-3 rounded-[12px] border border-line text-sm text-neg" style={{ background: 'var(--surface)' }}>
            {error}
          </div>
        )}

        {/* Search */}
        <div
          className="flex items-center gap-2.5 rounded-[14px] border px-3.5 py-[11px]"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} style={{ color: 'var(--text-3)' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un artiste…"
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-ink-faint"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-3)' }}>
            {search ? 'Aucun résultat' : 'Aucun artiste'}
          </div>
        ) : (
          <div
            className="mt-[14px] rounded-[20px] border px-4 py-1.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}
          >
            {filtered.map((a, i) => {
              const gross = parseFloat(a.total_gross);
              const isTop = i === 0 && !search;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full flex items-center gap-3 py-[13px] text-left ${i < filtered.length - 1 ? 'border-b' : ''}`}
                  style={i < filtered.length - 1 ? { borderColor: 'var(--border)' } : undefined}
                >
                  {a.image_url_small || a.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image_url_small || a.image_url}
                      alt={a.name}
                      className="w-10 h-10 rounded-full object-cover flex-none"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold flex-none"
                      style={{
                        background: isTop ? 'var(--accent-soft)' : 'var(--surface-2)',
                        color: isTop ? 'var(--accent)' : 'var(--text-2)',
                      }}
                    >
                      {initials(a.name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {a.name}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {fmtMillions(a.total_streams || 0)} streams
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="roy-num text-[13px] font-bold" style={{ color: 'var(--text)' }}>
                      {fmtEUR(gross)}
                    </div>
                    <div className="text-[10px] mt-0.5 font-semibold" style={{ color: gross > 0 ? 'var(--accent)' : 'var(--text-2)' }}>
                      {gross > 0 ? 'Actif' : 'En test'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Artist detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="flex items-center gap-[15px]">
              {selected.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selected.image_url} alt={selected.name} className="w-[60px] h-[60px] rounded-full object-cover flex-none" />
              ) : (
                <div
                  className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[20px] font-bold flex-none"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {initials(selected.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold tracking-[-0.02em] truncate" style={{ color: 'var(--text)' }}>
                  {selected.name}
                </div>
                <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Signé · {selected.has_collaborations ? 'Collaborations' : 'Solo'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[11px] mt-[18px]">
              <div
                className="rounded-[16px] border p-[15px]"
                style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}
              >
                <div className="roy-eyebrow text-[9px]">Revenus totaux</div>
                <div className="roy-num text-xl font-bold mt-1.5" style={{ color: 'var(--text)' }}>
                  {fmtEUR(selected.total_gross)}
                </div>
              </div>
              <div
                className="rounded-[16px] border p-[15px]"
                style={{ background: 'var(--hero)', borderColor: 'var(--border)' }}
              >
                <div className="roy-eyebrow text-[9px]">Streams</div>
                <div className="roy-num text-xl font-bold mt-1.5" style={{ color: 'var(--text)' }}>
                  {fmtMillions(selected.total_streams)}
                </div>
              </div>
            </div>
            <div
              className="mt-[14px] rounded-[16px] border px-4 py-1.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Transactions</span>
                <span className="roy-num text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  {selected.transaction_count.toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>Inscrit</span>
                <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  {new Date(selected.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="w-full mt-4 py-[14px] rounded-[14px] border text-[13.5px] font-semibold"
              style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              Fermer
            </button>
          </>
        )}
      </Sheet>

      <AdminBottomNav />
    </div>
  );
}
