import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { useNavigation } from '@react-navigation/native';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';

type PracticeMode = 'writing' | 'reading';

type PracticeSettings = {
  id?: string;
  writing_enabled: boolean;
  reading_enabled: boolean;
  unlock_rule: 'sequential' | 'free';
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

type LessonRow = { id: string; audio_url: string | null; examples: any };

export default function AdminPracticeScreen() {
  const navigation = useNavigation<any>();
  const { fontFamily } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULTS);

  const [readingEligible, setReadingEligible] = useState(0);
  const [writingEligible, setWritingEligible] = useState(0);

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
      setSettings(s);

      const { data: lessons, error: lErr } = await supabase
        .from('phonics_lessons')
        .select('id,audio_url,examples');

      if (lErr) {
        console.warn('practice content stats error:', lErr.message);
        setReadingEligible(0);
        setWritingEligible(0);
      } else {
        const min = Math.max(0, Number(s.min_examples_required ?? 0));
        const rows = (lessons as LessonRow[]) || [];

        const exCount = (r: LessonRow) =>
          (Array.isArray(r.examples) ? r.examples : [])
            .filter((e: any) => e && e.label && e.image_url).length;

        const reading = rows.filter((r) => exCount(r) >= min).length;
        const writing = rows.filter((r) => !!r.audio_url && exCount(r) >= min).length;

        setReadingEligible(reading);
        setWritingEligible(writing);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleMode = async (mode: PracticeMode, value: boolean) => {
    try {
      setSaving(true);
      const s = settings?.id ? settings : await ensureSettings();

      const patch =
        mode === 'writing' ? { writing_enabled: value } : { reading_enabled: value };

      const { data, error } = await supabase
        .from('practice_settings')
        .update(patch)
        .eq('id', s.id)
        .select('*')
        .single();

      if (error) throw error;
      setSettings(data as PracticeSettings);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update setting.');
    } finally {
      setSaving(false);
    }
  };

  const goSettings = () => navigation.navigate('AdminPracticeSettings');

  const Tile = ({
    title, subtitle, icon, mode, enabled, eligibleCount,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    mode: PracticeMode;
    enabled: boolean;
    eligibleCount: number;
  }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontFamily }]}>{title}</Text>
          <Text style={[styles.subtitle, { fontFamily }]}>{subtitle}</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(v) => toggleMode(mode, v)}
          thumbColor={enabled ? '#222' : '#fff'}
          trackColor={{ false: '#dfe6ee', true: '#dfe6ee' }}
        />
      </View>

      <View style={styles.metricsRow}>
        <Text style={[styles.metric, { fontFamily }]}>
          Eligible lessons: <Text style={styles.bold}>{eligibleCount}</Text>
        </Text>
        {!enabled && (
          <Text style={[styles.flag, { fontFamily }]}>Disabled</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.ghostBtn} onPress={goSettings}>
          <Ionicons name="settings-outline" size={18} color="#222" />
          <Text style={[styles.ghostTxt, { fontFamily }]}>Edit Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <BaseScreen title="Manage Practice" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <>
          <Tile
            title="Writing Practice"
            subtitle="Spell the word you hear"
            icon={<Ionicons name="create-outline" size={22} color="#000" />}
            mode="writing"
            enabled={!!settings.writing_enabled}
            eligibleCount={writingEligible}
          />
          <Tile
            title="Reading Practice"
            subtitle="Hear choices & pick the correct"
            icon={<Ionicons name="book-outline" size={22} color="#000" />}
            mode="reading"
            enabled={!!settings.reading_enabled}
            eligibleCount={readingEligible}
          />

          <View style={styles.metaBox}>
            <Text style={[styles.metaTitle, { fontFamily }]}>Global Rules</Text>
            <Text style={[styles.metaLine, { fontFamily }]}>
              Unlock rule: <Text style={styles.bold}>{settings.unlock_rule}</Text>
            </Text>
            <Text style={[styles.metaLine, { fontFamily }]}>
              Min examples required: <Text style={styles.bold}>{settings.min_examples_required}</Text>
            </Text>
            <Text style={[styles.metaLine, { fontFamily }]}>
              Per round count: <Text style={styles.bold}>{settings.per_round_count}</Text>
            </Text>

            <TouchableOpacity style={styles.ghostBtn} onPress={goSettings} disabled={saving}>
              <Ionicons name="settings-outline" size={18} color="#222" />
              <Text style={[styles.ghostTxt, { fontFamily }]}>Edit Global Settings</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    borderWidth: 1, borderColor: '#e9eef3', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 12,
  },
  iconWrap: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9eef3',
    padding: 8, borderRadius: 10,
  },
  title: { fontWeight: '800', color: '#1c1c1c' },
  subtitle: { color: '#555', marginTop: 2 },

  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  metric: { color: '#333' },
  flag: { color: '#b00020', fontWeight: '800' },

  actions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#e6ebf1', backgroundColor: '#fff'
  },
  ghostTxt: { fontWeight: '700', color: '#222' },

  metaBox: {
    borderWidth: 1, borderColor: '#e9eef3', backgroundColor: '#fff',
    padding: 12, borderRadius: 12, marginTop: 6,
  },
  metaTitle: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6 },
  metaLine: { color: '#333', marginBottom: 2 },
  bold: { fontWeight: '800', color: '#1c1c1c' },
});
