'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import {
  ContractData,
  TrackContributor,
  getContractContributors,
  setContractContributors,
  getReleaseCatalogTracks,
} from '@/lib/api';
import { Eyebrow, AccentButton, OutlineButton } from '@/components/roy/ui';

const ROLES: { value: string; label: string }[] = [
  { value: 'composer', label: 'Compositeur' },
  { value: 'author', label: 'Auteur' },
  { value: 'performer', label: 'Interprète' },
  { value: 'musician', label: 'Musicien' },
  { value: 'producer', label: 'Producteur' },
  { value: 'arranger', label: 'Arrangeur' },
  { value: 'publisher', label: 'Éditeur' },
  { value: 'other', label: 'Autre' },
];

interface Row { key: string; isrc: string | null; track_title: string | null; name: string; role: string; pct: string }
let _seq = 0;

export function ContractContributorsModal({
  contract, albumName, onClose,
}: { contract: ContractData; albumName?: string; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tracks, setTracks] = useState<{ isrc: string | null; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = albumName || contract.scope_title || contract.scope_id || 'Contrat';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [contribRes, trackList] = await Promise.all([
          getContractContributors(contract.id!),
          contract.scope === 'release' && contract.scope_id
            ? getReleaseCatalogTracks(contract.scope_id).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setRows(contribRes.contributors.map((c) => ({
          key: `r${_seq++}`,
          isrc: c.isrc ?? null,
          track_title: c.track_title ?? null,
          name: c.contributor_name || '',
          role: c.role || 'composer',
          pct: c.percentage != null ? String(c.percentage) : '',
        })));
        setTracks(trackList.map((tk) => ({ isrc: tk.isrc || null, title: tk.track_title })));
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [contract.id, contract.scope, contract.scope_id]);

  const sections = useMemo(() => {
    if (contract.scope === 'release') {
      const known = new Set(tracks.map((s) => s.isrc));
      const extra = rows
        .filter((r) => r.isrc && !known.has(r.isrc))
        .map((r) => ({ isrc: r.isrc, title: r.track_title || r.isrc! }));
      const dedupExtra = Array.from(new Map(extra.map((e) => [e.isrc, e])).values());
      return [...tracks, ...dedupExtra];
    }
    if (contract.scope === 'track') return [{ isrc: contract.scope_id || null, title: contract.scope_title || contract.scope_id || 'Titre' }];
    return [{ isrc: null, title: 'Tout le contrat' }];
  }, [contract, tracks, rows]);

  const addRow = (isrc: string | null, trackTitle: string | null) =>
    setRows((rs) => [...rs, { key: `r${_seq++}`, isrc, track_title: trackTitle, name: '', role: 'composer', pct: '' }]);
  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = async () => {
    const payload: TrackContributor[] = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        isrc: r.isrc,
        track_title: r.track_title,
        contributor_name: r.name.trim(),
        role: r.role,
        percentage: r.pct.trim() ? parseFloat(r.pct.replace(',', '.')) : null,
      }));
    setSaving(true);
    try {
      await setContractContributors(contract.id!, payload);
      onClose();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-[18px] border border-line w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 sm:p-6 border-b border-line shrink-0">
          <Eyebrow>Répartition par titre</Eyebrow>
          <h2 className="text-[18px] font-bold text-ink mt-1">{title}</h2>
          <p className="text-[12px] text-ink-muted mt-1">Contributeurs (compositeurs, musiciens…) et leur % de royauté — documentation.</p>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : error ? (
            <p className="text-neg text-[13px]">{error}</p>
          ) : sections.length === 0 ? (
            <p className="text-ink-muted text-[13px]">Aucun titre trouvé pour cet album.</p>
          ) : (
            sections.map((s) => {
              const trackRows = rows.filter((r) => (r.isrc || null) === (s.isrc || null));
              return (
                <div key={s.isrc || 'whole'} className="border border-line rounded-[12px] p-3.5">
                  <div className="font-semibold text-ink text-[14px]">{s.title}</div>
                  {s.isrc ? <div className="text-ink-faint text-[11px] mt-0.5">{s.isrc}</div> : null}

                  {trackRows.length === 0 ? (
                    <div className="text-ink-faint text-[12px] mt-2">Aucun contributeur</div>
                  ) : null}

                  <div className="flex flex-col gap-2 mt-3">
                    {trackRows.map((r) => (
                      <div key={r.key} className="flex items-center gap-2">
                        <input
                          value={r.name}
                          onChange={(e) => patchRow(r.key, { name: e.target.value })}
                          placeholder="Nom"
                          className="flex-1 bg-surface-2 border border-line rounded-[8px] px-2.5 py-1.5 text-[13px] text-ink"
                        />
                        <select
                          value={r.role}
                          onChange={(e) => patchRow(r.key, { role: e.target.value })}
                          className="bg-surface-2 border border-line rounded-[8px] px-2 py-1.5 text-[12.5px] text-ink"
                        >
                          {ROLES.map((ro) => <option key={ro.value} value={ro.value}>{ro.label}</option>)}
                        </select>
                        <input
                          value={r.pct}
                          onChange={(e) => patchRow(r.key, { pct: e.target.value })}
                          placeholder="%"
                          inputMode="decimal"
                          className="w-16 bg-surface-2 border border-line rounded-[8px] px-2 py-1.5 text-[13px] text-ink text-center roy-num"
                        />
                        <button onClick={() => removeRow(r.key)} title="Retirer" className="text-neg px-1.5 font-bold">✕</button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => addRow(s.isrc, s.title)}
                    className="mt-3 w-full text-center py-2 rounded-[10px] border border-dashed border-line text-accent text-[12.5px] font-semibold hover:bg-surface-2 transition-colors"
                  >
                    ＋ Ajouter une personne
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-line flex gap-3 shrink-0">
          <OutlineButton onClick={onClose} className="flex-1 justify-center">Annuler</OutlineButton>
          <AccentButton onClick={save} disabled={saving || loading} className="flex-1">
            {saving && <Spinner size="sm" color="white" />}
            Enregistrer
          </AccentButton>
        </div>
      </div>
    </div>
  );
}
