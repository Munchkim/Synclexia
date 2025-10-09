import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import { useRoute } from '@react-navigation/native';

type GameKey = 'sound_match' | 'name_picture' | 'rhyme_time' | 'fill_blank';

type GameSettings = {
  game_key: GameKey;
  enabled: boolean;
  rounds: number;
  restrict_to_current_group: boolean;
  require_audio_only?: boolean; 
  created_at?: string;
  updated_at?: string;
};

const DEFAULTS: Record<GameKey, GameSettings> = {
  sound_match: { game_key: 'sound_match', enabled: true, rounds: 8, restrict_to_current_group: false, require_audio_only: true },
  name_picture: { game_key: 'name_picture', enabled: true, rounds: 8, restrict_to_current_group: false },
  rhyme_time: { game_key: 'rhyme_time', enabled: true, rounds: 8, restrict_to_current_group: false },
  fill_blank: { game_key: 'fill_blank', enabled: true, rounds: 8, restrict_to_current_group: false },
};

function prettyName(k: GameKey) {
  switch (k) {
    case 'sound_match': return 'Sound Match';
    case 'name_picture': return 'Name the Picture';
    case 'rhyme_time': return 'Rhyme Time';
    case 'fill_blank': return 'Fill the Blank';
  }
}

export default function AdminGameSettingsScreen() {
  const { fontFamily } = useAppSettings();
  const route = useRoute<any>();
  const gameKey: GameKey = route.params?.gameKey;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<GameSettings>(DEFAULTS[gameKey]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('game_settings')
        .select('*')
        .eq('game_key', gameKey)
        .maybeSingle();

      if (!error && data) {
        setCfg({ ...DEFAULTS[gameKey], ...data });
      } else {
        setCfg(DEFAULTS[gameKey]);
      }
      setLoading(false);
    })();
  }, [gameKey]);

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        game_key: cfg.game_key,
        enabled: !!cfg.enabled,
        rounds: Number.isFinite(cfg.rounds) ? Math.max(1, Math.min(50, cfg.rounds)) : 8,
        restrict_to_current_group: !!cfg.restrict_to_current_group,
        updated_at: new Date().toISOString(),
      };
      if (cfg.game_key === 'sound_match') {
        payload.require_audio_only = cfg.require_audio_only ?? true;
      }

      const { error } = await supabase
        .from('game_settings')
        .upsert(payload, { onConflict: 'game_key' });

      if (error) throw error;
      Alert.alert('Saved', 'Game settings updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BaseScreen title="Game Settings" showBack>
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title={`${prettyName(gameKey)} Settings`} showBack>
      <View style={styles.card}>
        <RowSwitch
          label="Enabled"
          value={cfg.enabled}
          onChange={(v) => setCfg(s => ({ ...s, enabled: v }))}
          fontFamily={fontFamily}
        />

        <RowText
          label="Rounds per session"
          value={String(cfg.rounds)}
          onChange={(txt) => {
            const n = parseInt((txt || '0').replace(/[^\d]/g, ''), 10);
            const clamped = Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 8;
            setCfg(s => ({ ...s, rounds: clamped }));
          }}
          keyboardType="numeric"
          fontFamily={fontFamily}
        />

        <RowSwitch
          label="Restrict pool to current group"
          help="If on, options are drawn from the same phonics group as the current lesson (falls back to global pool if too small)."
          value={cfg.restrict_to_current_group}
          onChange={(v) => setCfg(s => ({ ...s, restrict_to_current_group: v }))}
          fontFamily={fontFamily}
        />

        {cfg.game_key === 'sound_match' && (
          <RowSwitch
            label="Require audio only"
            help="Only include lessons that have an audio_url."
            value={cfg.require_audio_only ?? true}
            onChange={(v) => setCfg(s => ({ ...s, require_audio_only: v }))}
            fontFamily={fontFamily}
          />
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Settings'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.noteBox}>
        <Text style={[styles.note, { fontFamily }]}>
          These games read from <Text style={{ fontWeight: '800' }}>phonics_lessons</Text>.
          {'\n'}• Sound Match → <Text style={{ fontWeight: '800' }}>audio_url</Text>
          {'\n'}• Others → <Text style={{ fontWeight: '800' }}>examples</Text> (image + label)
          {'\n'}Manage content in <Text style={{ fontWeight: '800' }}>Manage Phonics → Lesson editor</Text>.
        </Text>
      </View>
    </BaseScreen>
  );
}


function RowSwitch({
  label, help, value, onChange, fontFamily,
}: { label: string; help?: string; value: boolean; onChange: (v: boolean) => void; fontFamily?: string }) {
  return (
    <View style={styles.rowStack}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { fontFamily }]}>{label}</Text>
        {!!help && <Text style={[styles.help, { fontFamily }]}>{help}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function RowText({
  label, value, onChange, keyboardType, fontFamily,
}: { label: string; value: string; onChange: (t: string) => void; keyboardType?: any; fontFamily?: string }) {
  return (
    <View style={styles.rowStack}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { fontFamily }]}>{label}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9eef3', borderRadius: 12, padding: 14 },

  rowStack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingTop: 2,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 12,
    flexShrink: 1,   
  },
  rowLabel: { fontWeight: '800', color: '#1c1c1c', marginBottom: 4 },
  help: { color: '#666', fontSize: 12, lineHeight: 18 },

  input: {
    width: 110,
    borderWidth: 1, borderColor: '#e6ebf1',
    borderRadius: 10, height: 42,
    paddingHorizontal: 10, backgroundColor: '#fff',
    textAlign: 'center', fontWeight: '700',
  },

  saveBtn: { marginTop: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontWeight: '800', color: '#1c1c1c' },

  noteBox: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#eef2f7', backgroundColor: '#fff' },
  note: { color: '#333' },
});
