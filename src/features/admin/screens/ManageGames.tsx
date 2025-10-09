import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../../src/lib/supabaseClient';

type GameKey = 'sound_match' | 'name_picture' | 'rhyme_time' | 'fill_blank';

type Stats = {
  soundWithAudio: number;
  totalLessons: number;
  totalExamples: number;
  uniqueExampleWords: number;
};

export default function AdminGamesScreen() {
  const { fontFamily } = useAppSettings();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  const tiles: Array<{
    key: GameKey;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    requires: ('audio' | 'examples')[];
  }> = [
    {
      key: 'sound_match',
      title: 'Sound Match',
      subtitle: 'Hear & choose the sound',
      icon: <Ionicons name="volume-high" size={28} color="#000" />,
      requires: ['audio'],
    },
    {
      key: 'name_picture',
      title: 'Name the Picture',
      subtitle: 'Pick the correct word',
      icon: <Ionicons name="image" size={28} color="#000" />,
      requires: ['examples'],
    },
    {
      key: 'rhyme_time',
      title: 'Rhyme Time',
      subtitle: 'Choose the rhyming word',
      icon: <MaterialCommunityIcons name="music" size={28} color="#000" />,
      requires: ['examples'],
    },
    {
      key: 'fill_blank',
      title: 'Fill the Blank',
      subtitle: 'Missing letter(s) challenge',
      icon: <Ionicons name="text" size={28} color="#000" />,
      requires: ['examples'],
    },
  ];

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { count: audioCount, error: audioErr } = await supabase
        .from('phonics_lessons')
        .select('id', { count: 'exact', head: true })
        .not('audio_url', 'is', null);
      if (audioErr) console.warn('Audio count error', audioErr);

      const { count: totalLessons, error: totalErr } = await supabase
        .from('phonics_lessons')
        .select('id', { count: 'exact', head: true });
      if (totalErr) console.warn('Total lessons count error', totalErr);

      const { data: exRows, error: exErr } = await supabase
        .from('phonics_lessons')
        .select('examples');
      if (exErr) console.warn('Examples fetch error', exErr);

      const flat = (exRows || []).flatMap((r: any) =>
        Array.isArray(r?.examples) ? r.examples : []
      );
      const valid = flat.filter((e: any) => e && e.label && e.image_url);
      const words = new Set(valid.map((e: any) => String(e.label).trim().toLowerCase()));

      setStats({
        soundWithAudio: audioCount ?? 0,
        totalLessons: totalLessons ?? 0,
        totalExamples: valid.length,
        uniqueExampleWords: words.size,
      });

      setLoading(false);
    })();
  }, []);

  const readiness: Record<GameKey, boolean> = useMemo(() => {
    if (!stats) {
      return {
        sound_match: false,
        name_picture: false,
        rhyme_time: false,
        fill_blank: false,
      };
    }
    return {
      sound_match: stats.soundWithAudio > 0,
      name_picture: stats.totalExamples >= 6,
      rhyme_time: stats.totalExamples >= 6,
      fill_blank: stats.totalExamples >= 6,
    };
  }, [stats]);

  const goToSettings = (key: GameKey) => {
    navigation.navigate('AdminGameSettings', { gameKey: key });
  };

  return (
    <BaseScreen title="Manage Games" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { fontFamily }]}>{stats?.soundWithAudio ?? 0}</Text>
              <Text style={[styles.statLbl, { fontFamily }]}>Lessons with audio</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { fontFamily }]}>{stats?.totalExamples ?? 0}</Text>
              <Text style={[styles.statLbl, { fontFamily }]}>Total examples</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { fontFamily }]}>{stats?.uniqueExampleWords ?? 0}</Text>
              <Text style={[styles.statLbl, { fontFamily }]}>Unique words</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {tiles.map((t) => {
              const ready = readiness[t.key];
              const ribbonText = ready ? 'Ready' : (t.requires.includes('audio') ? 'Needs audio' : 'Needs examples');
              const ribbonStyle = ready ? styles.ribbonReady : styles.ribbonWarn;

              return (
                <View key={t.key} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.iconWrap}>{t.icon}</View>
                    <View style={[styles.ribbon, ribbonStyle]}>
                      <Text style={[styles.ribbonTxt, { fontFamily }]}>{ribbonText}</Text>
                    </View>
                  </View>

                  <Text style={[styles.title, { fontFamily }]}>{t.title}</Text>
                  <Text style={[styles.subtitle, { fontFamily }]}>{t.subtitle}</Text>

                  {t.requires.includes('audio') ? (
                    <Text style={[styles.needs, { fontFamily }]}>
                      Requires lessons with <Text style={{ fontWeight: '800' }}>audio_url</Text>.
                    </Text>
                  ) : (
                    <Text style={[styles.needs, { fontFamily }]}>
                      Requires <Text style={{ fontWeight: '800' }}>examples</Text> (image + label).
                    </Text>
                  )}

                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.btn} onPress={() => goToSettings(t.key)}>
                      <Text style={[styles.btnTxt, { fontFamily }]}>Edit Settings</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e9eef3',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  statNum: { fontWeight: '800', fontSize: 18, color: '#1c1c1c' },
  statLbl: { color: '#666', fontSize: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e9eef3',
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 12,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: { alignSelf: 'flex-start', padding: 10, borderRadius: 12, marginBottom: 10, backgroundColor: '#fff6d6' },

  ribbon: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ribbonReady: { backgroundColor: '#d9fdd3' },
  ribbonWarn: { backgroundColor: '#ffe7cc' },
  ribbonTxt: { fontSize: 11, fontWeight: '800', color: '#111' },

  title: { fontSize: 16, fontWeight: '800', color: '#1c1c1c' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#555' },
  needs: { marginTop: 6, fontSize: 12, color: '#777' },

  actions: { marginTop: 10, flexDirection: 'row' },
  btn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  btnTxt: { fontWeight: '800', color: '#1c1c1c' },
});
