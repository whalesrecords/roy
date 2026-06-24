import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getArtistPromoSubmissions, getArtistAdCampaigns, invalidateCache,
  PromoSubmission, ArtistAdCampaign,
} from '@/lib/api';
import { Card, Eyebrow, Money, Loader } from '@/components/ui';
import { IconSpotify, IconChevronRight, IconLink } from '@/components/icons';
import { fmtMoney, fmtNum, fmtPct, fmtDec, fmtDateShort } from '@/lib/format';

const POSITIVE = ['approved', 'shared', 'playlisted', 'accepted'];
function isPositive(s: PromoSubmission) {
  const d = (s.decision || s.action || '').toLowerCase();
  return POSITIVE.some((k) => d.includes(k));
}

function formatListen(ms: number | null): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

function MetaRow({ label, value }: { label: string; value?: string | null }) {
  const p = usePalette();
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: p.text3, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 12.5, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function SubmissionRow({ s, isLast }: { s: PromoSubmission; isLast: boolean }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const positive = isPositive(s);
  const link = s.sharing_link || s.campaign_url || null;
  const title = s.outlet_name || s.influencer_name || s.song_title;
  const subtype = s.outlet_type || s.influencer_type;

  return (
    <View style={{ borderBottomColor: p.border, borderBottomWidth: isLast ? 0 : 1 }}>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
          <Text style={{ color: p.text3, fontSize: 11 }} numberOfLines={1}>{s.song_title}{subtype ? ` · ${subtype}` : ''} · {s.source}</Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: positive ? p.accentSoft : p.surface2 }}>
          <Text style={{ color: positive ? p.accent : p.text3, fontSize: 10.5, fontWeight: '600' }}>{s.decision || s.action || '—'}</Text>
        </View>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <IconChevronRight size={15} color={p.text3} />
        </View>
      </Pressable>

      {open ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 8 }}>
          {s.feedback ? (
            <View style={{ backgroundColor: p.surface2, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: p.text3, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 }}>RETOUR</Text>
              <Text style={{ color: p.text, fontSize: 13, lineHeight: 19 }}>{s.feedback}</Text>
            </View>
          ) : null}
          <MetaRow label="Média / curateur" value={[title, subtype].filter(Boolean).join(' · ')} />
          <MetaRow label="Action" value={s.action} />
          <MetaRow label="Décision" value={s.decision} />
          {s.listen_time ? <MetaRow label="Écoute" value={formatListen(s.listen_time)} /> : null}
          <MetaRow label="Envoyé le" value={s.submitted_at ? fmtDateShort(s.submitted_at) : null} />
          <MetaRow label="Réponse le" value={s.responded_at ? fmtDateShort(s.responded_at) : null} />
          {link ? (
            <Pressable
              onPress={() => Linking.openURL(link).catch(() => {})}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, paddingVertical: 11, borderRadius: 12, backgroundColor: p.accent }}
            >
              <IconLink size={15} color={p.accentInk} />
              <Text style={{ color: p.accentInk, fontWeight: '700', fontSize: 13 }}>Ouvrir la playlist / le lien</Text>
            </Pressable>
          ) : null}
          {!s.feedback && !link ? (
            <Text style={{ color: p.text3, fontSize: 12 }}>Aucun détail supplémentaire (ni lien playlist ni retour écrit).</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  if (value === '—') return null;
  return (
    <View style={{ width: '31%', backgroundColor: p.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Money style={{ fontSize: 13, fontWeight: '800' }}>{value}</Money>
      <Text style={{ color: p.text3, fontSize: 9.5, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function AdCard({ c }: { c: ArtistAdCampaign }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const period = [c.start_date, c.end_date].filter(Boolean).map((d) => fmtDateShort(d)).join(' → ');

  const headline = [
    { label: 'Portée', value: c.reach != null ? fmtNum(c.reach) : '—' },
    { label: 'Nouveaux auditeurs', value: c.new_active_listeners != null ? fmtNum(c.new_active_listeners) : '—' },
    { label: 'Convertis', value: c.converted_listeners != null ? fmtNum(c.converted_listeners) : '—' },
  ];
  const detail = [
    { label: 'Clics', value: c.clicks != null ? fmtNum(c.clicks) : '—' },
    { label: 'Auditeurs amplifiés', value: c.amplified_listeners != null ? fmtNum(c.amplified_listeners) : '—' },
    { label: 'Réactivés', value: c.reactivated_listeners != null ? fmtNum(c.reactivated_listeners) : '—' },
    { label: 'Taux conversion', value: fmtPct(c.conversion_rate != null ? Number(c.conversion_rate) : null) },
    { label: "Taux d'intention", value: fmtPct(c.intent_rate != null ? Number(c.intent_rate) : null) },
    { label: 'Streams/auditeur', value: fmtDec(c.active_streams_per_listener) },
    { label: 'Enregistrements', value: c.saves != null ? fmtNum(c.saves) : '—' },
    { label: 'Ajouts playlist', value: c.playlist_adds != null ? fmtNum(c.playlist_adds) : '—' },
    { label: 'Taux ajout', value: fmtPct(c.playlist_add_rate != null ? Number(c.playlist_add_rate) : null) },
  ];
  const other = [
    { label: 'Auditeurs', value: c.listeners_other_releases != null ? fmtNum(c.listeners_other_releases) : '—' },
    { label: 'Streams/aud.', value: fmtDec(c.streams_per_listener_other_releases) },
    { label: 'Enregistr.', value: c.saves_other_releases != null ? fmtNum(c.saves_other_releases) : '—' },
    { label: 'Ajouts playlist', value: c.playlist_adds_other_releases != null ? fmtNum(c.playlist_adds_other_releases) : '—' },
  ];
  const hasOther = other.some((m) => m.value !== '—');

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopColor: p.border, borderTopWidth: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{c.release_name || c.campaign_name}</Text>
          <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{period}{c.country ? ` · ${c.country}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Money style={{ fontSize: 15, fontWeight: '800' }}>{fmtMoney(c.spend ?? 0, c.currency)}</Money>
          <Text style={{ color: p.text3, fontSize: 10 }}>{c.budget ? `/ ${fmtMoney(c.budget, c.currency)}` : 'dépensé'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {headline.map((m) => <MetricTile key={m.label} {...m} />)}
      </View>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: p.surface2 }}>
        <Text style={{ color: p.text2, fontSize: 11.5, fontWeight: '600' }}>{open ? 'Masquer le détail' : 'Voir tous les résultats'}</Text>
        <IconChevronRight size={14} color={p.text3} />
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {detail.map((m) => <MetricTile key={m.label} {...m} />)}
          </View>
          {hasOther ? (
            <View style={{ marginTop: 12, borderRadius: 12, borderColor: p.border, borderWidth: 1, padding: 12 }}>
              <Text style={{ color: p.text, fontSize: 11.5, fontWeight: '700' }}>Impact sur vos autres sorties</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {other.filter((m) => m.value !== '—').map((m) => <MetricTile key={m.label} {...m} />)}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function PromoScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [subs, setSubs] = useState<PromoSubmission[]>([]);
  const [campaigns, setCampaigns] = useState<ArtistAdCampaign[]>([]);
  const [adSpend, setAdSpend] = useState('0');
  const [adCurrency, setAdCurrency] = useState('EUR');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await getArtistPromoSubmissions({ limit: 500 });
    setSubs(s);
    try {
      const ads = await getArtistAdCampaigns();
      setCampaigns(ads.campaigns);
      setAdSpend(ads.total_spend);
      setAdCurrency(ads.currency || 'EUR');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); invalidateCache('/artist-portal/promo'); try { await load(); } finally { setRefreshing(false); } };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  const totalPositive = subs.filter(isPositive).length;
  const totalPlaylists = subs.filter((s) => (s.outlet_type || '').toLowerCase().includes('playlist') || (s.action || '').toLowerCase().includes('playlist')).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('nav.promo')}</Text>

        {/* Summary */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}><Eyebrow>Soumissions</Eyebrow><Money style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>{fmtNum(subs.length)}</Money></Card>
          <Card style={{ flex: 1 }}><Eyebrow>Retours +</Eyebrow><Money style={{ fontSize: 20, fontWeight: '800', marginTop: 6, color: p.accent }}>{fmtNum(totalPositive)}</Money></Card>
          <Card style={{ flex: 1 }}><Eyebrow>Playlists</Eyebrow><Money style={{ fontSize: 20, fontWeight: '800', marginTop: 6 }}>{fmtNum(totalPlaylists)}</Money></Card>
        </View>

        {/* Spotify Ads */}
        {campaigns.length > 0 ? (
          <Card style={{ padding: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSpotify size={20} />
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>Publicités Spotify</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Eyebrow>Total dépensé</Eyebrow>
                <Money style={{ fontSize: 15, fontWeight: '800' }}>{fmtMoney(adSpend, adCurrency)}</Money>
              </View>
            </View>
            {campaigns.map((c) => <AdCard key={c.id} c={c} />)}
          </Card>
        ) : null}

        {/* Submissions */}
        <Card style={{ padding: 0 }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: p.border, borderBottomWidth: 1 }}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>Retours promo</Text>
          </View>
          {subs.length === 0 ? (
            <Text style={{ color: p.text3, fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>Aucune soumission</Text>
          ) : subs.slice(0, 100).map((s, i, arr) => (
            <SubmissionRow key={s.id} s={s} isLast={i === arr.length - 1} />
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
