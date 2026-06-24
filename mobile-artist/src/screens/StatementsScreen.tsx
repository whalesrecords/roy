import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getStatements, getStatementDetail, requestPayment, invalidateCache,
  Statement, StatementDetail,
} from '@/lib/api';
import { Card, Eyebrow, Money, Loader, AccentButton } from '@/components/ui';
import { IconChevronRight } from '@/components/icons';
import { fmtMoney, fmtDateLong } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  paid: 'Payé', approved: 'Approuvé', ready: 'Prêt', pending_payment: 'En attente',
  pending: 'En validation', draft: 'Brouillon',
};

function Row({ s }: { s: Statement }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<StatementDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setLoadingDetail(true);
      try { setDetail(await getStatementDetail(s.id)); } catch { /* ignore */ } finally { setLoadingDetail(false); }
    }
  };

  const unpaid = s.status !== 'paid';

  return (
    <Card style={{ padding: 0 }}>
      <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>{s.period_label}</Text>
          <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{STATUS_LABEL[s.status] || s.status} · {fmtDateLong(s.created_at)}</Text>
        </View>
        <Money style={{ fontSize: 15, fontWeight: '800' }}>{fmtMoney(s.net_payable, s.currency)}</Money>
        <IconChevronRight size={16} color={p.text3} />
      </Pressable>

      {open ? (
        <View style={{ borderTopColor: p.border, borderTopWidth: 1, padding: 16, gap: 10 }}>
          {loadingDetail ? <ActivityIndicator color={p.accent} /> : detail ? (
            <>
              <DetailLine label="Revenus bruts" value={fmtMoney(detail.gross_revenue, detail.currency)} pal={p} />
              <DetailLine label="Royalties artiste" value={fmtMoney(detail.artist_royalties, detail.currency)} pal={p} />
              <DetailLine label="Recoupé (avances)" value={`− ${fmtMoney(detail.recouped, detail.currency)}`} pal={p} />
              <View style={{ height: 1, backgroundColor: p.border, marginVertical: 2 }} />
              <DetailLine label="Net à payer" value={fmtMoney(detail.net_payable, detail.currency)} pal={p} strong />

              {detail.releases?.length ? (
                <>
                  <Eyebrow style={{ marginTop: 8 }}>Par sortie</Eyebrow>
                  {detail.releases.map((r) => (
                    <View key={r.upc} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: p.text2, fontSize: 12.5, flex: 1 }} numberOfLines={1}>{r.title}</Text>
                      <Money style={{ fontSize: 12.5 }}>{fmtMoney(r.artist_royalties, detail.currency)}</Money>
                    </View>
                  ))}
                </>
              ) : null}

              {detail.sources?.length ? (
                <>
                  <Eyebrow style={{ marginTop: 8 }}>Par source</Eyebrow>
                  {detail.sources.map((src) => (
                    <View key={src.source} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ color: p.text2, fontSize: 12.5, flex: 1 }} numberOfLines={1}>{src.source_label}</Text>
                      <Money style={{ fontSize: 12.5 }}>{fmtMoney(src.artist_royalties, detail.currency)}</Money>
                    </View>
                  ))}
                </>
              ) : null}

              {unpaid ? (
                <View style={{ marginTop: 12 }}>
                  <AccentButton
                    label={requested ? 'Demande envoyée ✓' : 'Demander un versement'}
                    loading={requesting}
                    disabled={requested}
                    onClick={async () => {
                      setRequesting(true);
                      try { await requestPayment(s.id); setRequested(true); } finally { setRequesting(false); }
                    }}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={{ color: p.text3, fontSize: 12.5 }}>Détail indisponible.</Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function DetailLine({ label, value, pal, strong }: { label: string; value: string; pal: ReturnType<typeof usePalette>; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: strong ? pal.text : pal.text2, fontSize: 13, fontWeight: strong ? '700' : '400' }}>{label}</Text>
      <Money style={{ fontSize: 13, fontWeight: strong ? '800' : '600', color: strong ? pal.accent : pal.text }}>{value}</Money>
    </View>
  );
}

export default function StatementsScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setStatements(await getStatements()); }, []);
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); invalidateCache('/artist-portal/statements'); try { await load(); } finally { setRefreshing(false); } };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('statements.title')}</Text>
        {statements.length === 0 ? (
          <Text style={{ color: p.text3, textAlign: 'center', paddingVertical: 40 }}>Aucun relevé</Text>
        ) : statements.map((s) => <Row key={s.id} s={s} />)}
      </ScrollView>
    </SafeAreaView>
  );
}
