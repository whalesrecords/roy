import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Loader } from '@/components/ui';
import { State, StatusBadge } from '@/components/kit';
import { useFetch } from '@/lib/useFetch';
import { getTicket, replyToTicket, TicketMessage } from '@/lib/api';
import { fmtDateLong } from '@/lib/format';

function Bubble({ m }: { m: TicketMessage }) {
  const p = usePalette();
  const mine = m.sender_type === 'admin';
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', marginVertical: 5 }}>
      <View style={{
        backgroundColor: mine ? p.accentSoft : p.surface, borderColor: p.border, borderWidth: 1,
        borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10,
      }}>
        {m.is_internal ? <Text style={{ color: '#C9982B', fontSize: 10, fontWeight: '800', marginBottom: 3 }}>NOTE INTERNE</Text> : null}
        <Text style={{ color: p.text, fontSize: 14, lineHeight: 19 }}>{m.message}</Text>
      </View>
      <Text style={{ color: p.text3, fontSize: 10.5, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
        {m.sender_name || m.sender_type} · {fmtDateLong(m.created_at)}
      </Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { id, subject } = route.params || {};
  const { data: tk, loading, error, reload } = useFetch(() => getTicket(id), [id]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  React.useEffect(() => { nav.setOptions?.({ title: subject || 'Ticket' }); }, [nav, subject]);

  const send = async () => {
    const msg = draft.trim();
    if (!msg || sending) return;
    setSending(true);
    try {
      await replyToTicket(id, msg);
      setDraft('');
      reload();
    } catch {
      // surfaced by the next reload attempt; keep the draft so nothing is lost
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 12, gap: 2 }}>
          <State loading={loading} error={error} onRetry={reload}>
            {tk ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text style={{ color: p.text3, fontSize: 12 }}>#{tk.ticket_number} · {tk.category_label}</Text>
                  <StatusBadge label={tk.status_label} tone={tk.status === 'resolved' || tk.status === 'closed' ? 'good' : tk.status === 'in_progress' ? 'warn' : 'neutral'} />
                </View>
                {tk.messages.map((m) => <Bubble key={m.id} m={m} />)}
              </>
            ) : null}
          </State>
        </ScrollView>

        {tk ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8, borderTopColor: p.border, borderTopWidth: 1, backgroundColor: p.surface }}>
            <TextInput
              value={draft} onChangeText={setDraft} placeholder={t('support.reply')} placeholderTextColor={p.text3}
              multiline
              style={{ flex: 1, color: p.text, fontSize: 15, backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120 }}
            />
            <Pressable
              onPress={send} disabled={!draft.trim() || sending}
              style={({ pressed }) => ({ backgroundColor: p.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, opacity: !draft.trim() || sending ? 0.5 : pressed ? 0.85 : 1 })}
            >
              {sending ? <ActivityIndicator color={p.accentInk} /> : <Text style={{ color: p.accentInk, fontWeight: '800', fontSize: 13.5 }}>{t('support.send')}</Text>}
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
