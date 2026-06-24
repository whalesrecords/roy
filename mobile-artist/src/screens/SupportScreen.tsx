import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import {
  getMyTickets, getMyTicketDetail, addMyTicketMessage, invalidateCache,
  Ticket, TicketDetail,
} from '@/lib/api';
import { Card, Loader } from '@/components/ui';
import { IconChevronRight } from '@/components/icons';
import { fmtDateShort } from '@/lib/format';

function TicketRow({ tk }: { tk: Ticket }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setBusy(true);
      try { setDetail(await getMyTicketDetail(tk.id)); } catch { /* ignore */ } finally { setBusy(false); }
    }
  };

  const send = async () => {
    if (!reply.trim() || !detail) return;
    setSending(true);
    try {
      const msg = await addMyTicketMessage(tk.id, reply.trim());
      setDetail({ ...detail, messages: [...detail.messages, msg] });
      setReply('');
    } finally { setSending(false); }
  };

  return (
    <Card style={{ padding: 0 }}>
      <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 13.5, fontWeight: '700' }} numberOfLines={1}>{tk.subject}</Text>
          <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 2 }}>{tk.category_label} · {tk.status_label}</Text>
        </View>
        {tk.unread_count > 0 ? (
          <View style={{ backgroundColor: p.accent, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
            <Text style={{ color: p.accentInk, fontSize: 10.5, fontWeight: '700' }}>{tk.unread_count}</Text>
          </View>
        ) : null}
        <IconChevronRight size={16} color={p.text3} />
      </Pressable>

      {open ? (
        <View style={{ borderTopColor: p.border, borderTopWidth: 1, padding: 16, gap: 10 }}>
          {busy ? <ActivityIndicator color={p.accent} /> : detail ? (
            <>
              {detail.messages.map((m) => {
                const mine = m.sender_type === 'artist';
                return (
                  <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: mine ? p.accentSoft : p.surface2, borderRadius: 12, padding: 10 }}>
                    <Text style={{ color: p.text3, fontSize: 10, marginBottom: 2 }}>{m.sender_name || (mine ? 'Vous' : 'Support')} · {fmtDateShort(m.created_at)}</Text>
                    <Text style={{ color: p.text, fontSize: 13 }}>{m.message}</Text>
                  </View>
                );
              })}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 4 }}>
                <TextInput
                  value={reply} onChangeText={setReply} placeholder="Votre message…" placeholderTextColor={p.text3} multiline
                  style={{ flex: 1, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, color: p.text, fontSize: 14, maxHeight: 100 }}
                />
                <Pressable onPress={send} disabled={sending || !reply.trim()} style={{ backgroundColor: p.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, opacity: !reply.trim() ? 0.5 : 1 }}>
                  {sending ? <ActivityIndicator color={p.accentInk} /> : <Text style={{ color: p.accentInk, fontWeight: '700', fontSize: 13 }}>Envoyer</Text>}
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={{ color: p.text3, fontSize: 12.5 }}>Conversation indisponible.</Text>
          )}
        </View>
      ) : null}
    </Card>
  );
}

export default function SupportScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => setTickets(await getMyTickets());
  useEffect(() => { (async () => { try { await load(); } finally { setLoading(false); } })(); }, []);
  const onRefresh = async () => { setRefreshing(true); invalidateCache('/artist-portal/tickets'); try { await load(); } finally { setRefreshing(false); } };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}><Loader /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.accent} />}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{t('support.title')}</Text>
        {tickets.length === 0 ? (
          <Text style={{ color: p.text3, textAlign: 'center', paddingVertical: 40 }}>Aucun ticket</Text>
        ) : tickets.map((tk) => <TicketRow key={tk.id} tk={tk} />)}
      </ScrollView>
    </SafeAreaView>
  );
}
