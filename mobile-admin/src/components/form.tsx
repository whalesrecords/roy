import React, { ReactNode } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePalette } from '@/theme/ThemeProvider';

export function FormScreen({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Field({
  label, value, onChangeText, ...rest
}: { label: string; value: string; onChangeText: (v: string) => void } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const p = usePalette();
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={p.text3}
        style={{
          backgroundColor: p.surface2, borderColor: p.border, borderWidth: 1, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10, color: p.text, fontSize: 14.5, marginTop: 6,
        }}
        {...rest}
      />
    </View>
  );
}

/** Single-select chip group from a list of {value,label} options. */
export function Chips<T extends string>({
  label, options, value, onChange,
}: { label?: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ marginTop: 12 }}>
      {label ? <Text style={{ color: p.text2, fontSize: 12.5, fontWeight: '600', marginBottom: 8 }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? p.accent : p.surface2, borderColor: active ? p.accent : p.border, borderWidth: 1 }}
            >
              <Text style={{ color: active ? p.accentInk : p.text2, fontSize: 12.5, fontWeight: '700' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({ label, value, onValueChange, children }: { label: string; value: boolean; onValueChange: (v: boolean) => void; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}
