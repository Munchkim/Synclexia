import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';

export default function AboutScreen() {
  const [loading, setLoading] = useState(true);
  const [md, setMd] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('site_pages').select('markdown').eq('key', 'about').maybeSingle();
      setMd((data?.markdown as string) || '');
      setLoading(false);
    })();
  }, []);

  const renderLine = (line: string, i: number) => {
    if (line.startsWith('# ')) return <Text key={i} style={[styles.h1]}>{line.replace(/^# /, '')}</Text>;
    if (line.startsWith('## ')) return <Text key={i} style={[styles.h2]}>{line.replace(/^## /, '')}</Text>;
    if (line.startsWith('- ')) return <Text key={i} style={styles.li}>• {line.replace(/^- /, '')}</Text>;
    if (/https?:\/\//.test(line)) {
      return (
        <Text key={i} style={styles.p} onPress={() => Linking.openURL(line.trim())}>{line.trim()}</Text>
      );
    }
    return <Text key={i} style={styles.p}>{line}</Text>;
  };

  return (
    <BaseScreen title="About">
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {md.split('\n').map(renderLine)}
        </ScrollView>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  p: { fontSize: 14, color: '#1c1c1c', marginBottom: 6 },
  li: { fontSize: 14, color: '#1c1c1c', marginBottom: 4, paddingLeft: 8 },
});
