import React from 'react';
import { View, Text } from 'react-native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow, Money } from '@/components/ui';
import { Screen, State, SectionTitle, BarRow, StatusBadge } from '@/components/kit';
import { IconSpotify } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getDetailedPromoStats, getAdCampaigns, AdCampaign } from '@/lib/api';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';

function Kpi({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <Card style={{ flex: 1, minWidth: 110 }}>
      <Eyebrow>{label}</Eyebrow>
      <Money style={{ fontSize: 19, fontWeight: '800', marginTop: 5 }}>{value}</Money>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={{ width: '33%', paddingVertical: 6 }}>
      <Text style={{ color: p.text3, fontSize: 10.5 }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function CampaignCard({ c }: { c: AdCampaign }) {
  const p = usePalette();
  const n = (v?: number | null) => (v == null ? '—' : fmtNum(v));
  const pct = (v?: string | null) => (v == null ? '—' : fmtPct(parseFloat(v)));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconSpotify size={18} />
        <Text style={{ color: p.text, fontSize: 14.5, fontWeight: '800', flex: 1 }} numberOfLines={1}>{c.campaign_name}</Text>
        {c.spend ? <Money style={{ fontSize: 13.5, fontWeight: '800', color: p.accent }}>{fmtMoney(c.spend, c.currency)}</Money> : null}
      </View>
      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 3 }}>
        {[c.artist_name, c.release_name, c.ad_format].filter(Boolean).join('  ·  ') || '—'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        <Metric label="Portée" value={n(c.reach)} />
        <Metric label="Clics" value={n(c.clicks)} />
        <Metric label="Conversion" value={pct(c.conversion_rate)} />
        <Metric label="Nouveaux act." value={n(c.new_active_listeners)} />
        <Metric label="Réactivés" value={n(c.reactivated_listeners)} />
        <Metric label="Convertis" value={n(c.converted_listeners)} />
        <Metric label="Str./auditeur" value={c.active_streams_per_listener ?? '—'} />
        <Metric label="Playlists" value={n(c.playlist_adds)} />
        <Metric label="Saves" value={n(c.saves)} />
      </View>
    </Card>
  );
}

export default function PromoScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const statsQ = useFetch(getDetailedPromoStats);
  const adsQ = useFetch(getAdCampaigns);
  const s = statsQ.data;
  const ads = adsQ.data;

  const byArtist = s ? [...s.by_artist].sort((a, b) => b.total_submissions - a.total_submissions).slice(0, 8) : [];
  const maxSub = byArtist.reduce((m, a) => Math.max(m, a.total_submissions), 0) || 1;

  return (
    <Screen title={t('promo.title')} onRefresh={() => { statsQ.reload(); adsQ.reload(); }} refreshing={statsQ.loading}>
      <State loading={statsQ.loading} error={statsQ.error} onRetry={statsQ.reload}>
        {s ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Kpi label={t('promo.submissions')} value={fmtNum(s.total_submissions)} />
              <Kpi label={t('promo.approvals')} value={fmtNum(s.total_approvals)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Kpi label={t('promo.playlists')} value={fmtNum(s.total_playlists)} />
              <Kpi label={t('promo.listens')} value={fmtNum(s.total_listens)} />
            </View>

            {ads && ads.campaigns.length ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                  <SectionTitle>{t('promo.campaigns')}</SectionTitle>
                  <StatusBadge label={`${t('promo.spend')} ${fmtMoney(ads.total_spend, ads.currency)}`} tone="good" />
                </View>
                {ads.campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
              </>
            ) : null}

            {byArtist.length ? (
              <Card>
                <SectionTitle>{t('promo.byArtist')}</SectionTitle>
                {byArtist.map((a) => (
                  <BarRow
                    key={a.artist_id}
                    label={a.artist_name}
                    value={fmtNum(a.total_submissions)}
                    pct={(a.total_submissions / maxSub) * 100}
                    sub={`${fmtNum(a.total_approved)} validés · ${fmtPct(a.approval_rate)} · ${fmtNum(a.total_playlists)} playlists`}
                  />
                ))}
              </Card>
            ) : null}
          </>
        ) : null}
      </State>
    </Screen>
  );
}
