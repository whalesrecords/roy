import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import SignatureScreen from 'react-native-signature-canvas';
import { usePalette } from '@/theme/ThemeProvider';
import { useLanguage } from '@/i18n';
import { Card, Eyebrow } from '@/components/ui';
import { IconCheck } from '@/components/icons';
import { signContract, Contract } from '@/lib/api';
import { fmtDateShort, fmtDateLong } from '@/lib/format';

const SCOPE_LABEL: Record<string, string> = { catalog: 'Catalogue', release: 'Release', track: 'Titre' };

export default function ContractSignScreen() {
  const p = usePalette();
  const { t } = useLanguage();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const contract: Contract = route.params?.contract;

  const sigRef = useRef<any>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [signed, setSigned] = useState(!!contract?.signed);
  const [signedAt, setSignedAt] = useState<string | undefined>(contract?.signed_at);

  React.useEffect(() => {
    nav.setOptions?.({ title: contract?.scope_title || SCOPE_LABEL[contract?.scope] || 'Contrat' });
  }, [nav, contract]);

  const handleOK = async (signature: string) => {
    if (!signature || signature.length < 50) { Alert.alert('', t('contracts.signError')); return; }
    setBusy(true);
    try {
      const r = await signContract(contract.id, signature);
      setSigned(true);
      setSignedAt(r.signed_at);
    } catch (e: any) {
      Alert.alert('', e?.message || t('contracts.signError'));
    } finally {
      setBusy(false);
    }
  };

  const onPressSign = () => {
    if (!consent) { Alert.alert('', t('contracts.consent')); return; }
    sigRef.current?.readSignature();
  };

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: 1px solid #e6e6e6; border-radius: 12px; }
    .m-signature-pad--footer { display: none; margin: 0; }
    body, html { width: 100%; height: 100%; margin: 0; }
  `;

  if (!contract) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }} scrollEnabled={scrollEnabled}>
        {/* Contract summary */}
        <Card>
          <Eyebrow>{t('contracts.period')}</Eyebrow>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 4 }}>
            {fmtDateShort(contract.start_date)} – {contract.end_date ? fmtDateShort(contract.end_date) : t('contracts.noEnd')}
          </Text>
          <Text style={{ color: p.text2, fontSize: 13, marginTop: 8 }}>
            {t('contracts.artistShare')} : <Text style={{ fontWeight: '800', color: p.text }}>{Math.round((contract.artist_share || 0) * 100)} %</Text>
          </Text>
          {contract.description ? <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 8, lineHeight: 18 }}>{contract.description}</Text> : null}
        </Card>

        {signed ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <IconCheck size={20} color={p.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '800' }}>{t('contracts.signed')}</Text>
                {signedAt ? <Text style={{ color: p.text3, fontSize: 12.5, marginTop: 2 }}>{t('contracts.signedOn')} {fmtDateLong(signedAt)}</Text> : null}
              </View>
            </View>
            <Text style={{ color: p.text3, fontSize: 11.5, marginTop: 12, lineHeight: 16 }}>{t('contracts.sealed')}</Text>
          </Card>
        ) : (
          <>
            <Card>
              <Pressable onPress={() => setConsent((v) => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Switch value={consent} onValueChange={setConsent} trackColor={{ true: p.accent, false: p.track }} />
                <Text style={{ color: p.text2, fontSize: 12.5, flex: 1, lineHeight: 17 }}>{t('contracts.consent')}</Text>
              </Pressable>
            </Card>

            <Card>
              <Text style={{ color: p.text3, fontSize: 12, marginBottom: 8 }}>{t('contracts.signHint')}</Text>
              <View style={{ height: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' }}>
                <SignatureScreen
                  ref={sigRef}
                  onOK={handleOK}
                  onEmpty={() => Alert.alert('', t('contracts.signError'))}
                  onBegin={() => setScrollEnabled(false)}
                  onEnd={() => setScrollEnabled(true)}
                  webStyle={webStyle}
                  autoClear={false}
                  penColor="#111111"
                  backgroundColor="#ffffff"
                  imageType="image/png"
                  descriptionText=""
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Pressable onPress={() => sigRef.current?.clearSignature()} style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12, borderColor: p.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ color: p.text2, fontWeight: '700', fontSize: 14 }}>{t('contracts.clear')}</Text>
                </Pressable>
                <Pressable onPress={onPressSign} disabled={busy} style={({ pressed }) => ({ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, backgroundColor: p.accent, opacity: busy ? 0.6 : pressed ? 0.85 : 1 })}>
                  {busy ? <ActivityIndicator color={p.accentInk} /> : <IconCheck size={17} color={p.accentInk} />}
                  <Text style={{ color: p.accentInk, fontWeight: '800', fontSize: 14 }}>{t('contracts.sign')}</Text>
                </Pressable>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
