import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow } from '@/components/ui';
import { State, SectionTitle, StatusBadge, Divider } from '@/components/kit';
import { IconChevronRight } from '@/components/icons';
import { useFetch } from '@/lib/useFetch';
import { getTicketStats, getTickets, TicketListItem } from '@/lib/api';
import { fmtDateShort } from '@/lib/format';

function ticketTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' {
  if (status === 'resolved' || status === 'closed') return 'good';
  if (status === 'in_progress') return 'warn';
  return 'neutral';
}

export default function SupportScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const nav = useNavigation<any>();
  const statsQ = useFetch(getTicketStats);
  const listQ = useFetch(() => getTickets());

  React.useEffect(() => { nav.setOptions?.({ title: t('support.title') }); }, [nav, t]);

  const s = statsQ.data;
  const tickets = listQ.data || [];

  const StatBox = ({ label, value }: { label: string; value: number }) => (
    <View style={{ flex: 1, minWidth: 70, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ color: p.text, fontSize: 19, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: p.text3, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 14 }}>
        {s ? (
          <Card>
            <Eyebrow>{t('support.tickets')}</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              <StatBox label={t('support.open')} value={s.open} />
              <StatBox label={t('support.inProgress')} value={s.in_progress} />
              <StatBox label={t('support.resolved')} value={s.resolved} />
              <StatBox label={t('support.closed')} value={s.closed} />
            </View>
          </Card>
        ) : null}

        <Card>
          <SectionTitle>{t('support.tickets')}</SectionTitle>
          <State loading={listQ.loading} error={listQ.error} onRetry={listQ.reload} empty={!!listQ.data && tickets.length === 0}>
            <View style={{ marginTop: 4 }}>
              {tickets.map((tk: TicketListItem, i) => (
                <View key={tk.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => nav.navigate('TicketDetail', { id: tk.id, subject: tk.subject })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: p.text, fontSize: 14, fontWeight: '700', flex: 1 }} numberOfLines={1}>{tk.subject}</Text>
                        {tk.unread_count > 0 ? (
                          <View style={{ backgroundColor: p.accent, borderRadius: 999, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                            <Text style={{ color: p.accentInk, fontSize: 10.5, fontWeight: '800' }}>{tk.unread_count}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 3 }} numberOfLines={1}>
                        #{tk.ticket_number} · {tk.category_label}
                        {tk.artist_names?.length ? `  ·  ${tk.artist_names.join(', ')}` : ''}
                        {`  ·  ${fmtDateShort(tk.last_message_at)}`}
                      </Text>
                      <View style={{ marginTop: 6 }}>
                        <StatusBadge label={tk.status_label} tone={ticketTone(tk.status)} />
                      </View>
                    </View>
                    <IconChevronRight size={18} color={p.text3} />
                  </Pressable>
                </View>
              ))}
            </View>
          </State>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
