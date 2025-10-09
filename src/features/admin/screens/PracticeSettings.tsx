import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';

type UnlockRule = 'sequential' | 'free';

type PracticeSettings = {
  id?: string;
  writing_enabled: boolean;
  reading_enabled: boolean;
  unlock_rule: UnlockRule;
  min_examples_required: number;
  per_round_count: number;
  updated_at?: string;
};

const DEFAULTS: PracticeSettings = {
  writing_enabled: true,
  reading_enabled: true,
  unlock_rule: 'sequential',
  min_examples_required: 1,
  per_round_count: 8,
};

export default function AdminPracticeSettingsScreen() {
  const { fontFamily } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PracticeSettings>(DEFAULTS);

  const ensureSettings = async (): Promise<PracticeSettings> => {
    const { data, error } = await supabase
      .from('practice_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) return data as PracticeSettings;

    const { data: created, error: insErr } = await supabase
      .from('practice_settings')
      .insert([DEFAULTS])
      .select('*')
      .single();

    if (insErr || !created) throw insErr || new Error('Failed to create practice settings');
    return created as PracticeSettings;
  };

  const load = async () => {
    try {
      setLoading(true);
      const s = await ensureSettings();
      setForm(s);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const id = form.id || (await ensureSettings()).id;

      const payload = {
        unlock_rule: form.unlock_rule,
        min_examples_required: Math.max(0, Number(form.min_examples_required) || 0),
        per_round_count: Math.max(1, Math.min(50, Number(form.per_round_count) || 1)),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('practice_settings')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      setForm(data as PracticeSettings);
      Alert.alert('Saved', 'Practice settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const Pill = ({ value, label }: { value: UnlockRule; label: string }) => {
    const active = form.unlock_rule === value;
    return (
      <TouchableOpacity
        onPress={() => setForm(f => ({ ...f, unlock_rule: value }))}
        style={[styles.pill, { backgroundColor: active ? '#fff' : 'transparent', borderColor: active ? '#dfe6ee' : '#e6ebf1' }]}
      >
        <Text style={[styles.pillTxt, { fontFamily }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <BaseScreen title="Practice Settings" showBack>
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="Practice Settings" showBack>
      <View style={styles.group}>
        <Text style={[styles.label, { fontFamily }]}>Unlock rule</Text>
        <View style={styles.row}>
          <Pill value="sequential" label="Sequential (unlock next on complete)" />
          <Pill value="free" label="Free (all visible if enabled)" />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={[styles.label, { fontFamily }]}>Minimum examples required</Text>
        <TextInput
          keyboardType="number-pad"
          value={String(form.min_examples_required ?? 0)}
          onChangeText={(t) => setForm(f => ({ ...f, min_examples_required: Number((t || '0').replace(/\D/g, '')) }))}
          style={styles.input}
        />
        <Text style={[styles.help, { fontFamily }]}>
          Lessons with fewer than this number of example words will be hidden from the learner’s Practice list.
        </Text>
      </View>

      <View style={styles.group}>
        <Text style={[styles.label, { fontFamily }]}>Rounds per session (hint)</Text>
        <TextInput
          keyboardType="number-pad"
          value={String(form.per_round_count ?? 8)}
          onChangeText={(t) => setForm(f => ({ ...f, per_round_count: Number((t || '1').replace(/\D/g, '')) }))}
          style={styles.input}
        />
        <Text style={[styles.help, { fontFamily }]}>
          Used as a target length for sessions (you can wire this into the learner UI later).
        </Text>
      </View>

      <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}>
        <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Settings'}</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  group: {
    borderWidth: 1, borderColor: '#e9eef3', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  label: { fontWeight: '800', color: '#1c1c1c', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },

  pill: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10 },
  pillTxt: { fontWeight: '700', color: '#1c1c1c' },

  input: { borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  help: { color: '#555', fontSize: 12, marginTop: 6, lineHeight: 18 },

  saveBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontWeight: '800', color: '#1c1c1c' },
});
