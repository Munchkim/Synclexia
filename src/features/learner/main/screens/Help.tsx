// src/features/learner/main/screens/Help.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';

type FAQ = { id: string; question: string; answer: string; tags: string[]; order_index: number };

export default function HelpScreen() {
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('faqs')
        .select('id,question,answer,tags,order_index')
        .eq('is_published', true)
        .order('order_index', { ascending: true });
      setFaqs((data as FAQ[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return faqs;
    return faqs.filter(f =>
      f.question.toLowerCase().includes(s) ||
      f.answer.toLowerCase().includes(s) ||
      f.tags.join(' ').toLowerCase().includes(s)
    );
  }, [faqs, q]);

  return (
    <BaseScreen title="Help">
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Search FAQs…"
              value={q}
              onChangeText={setQ}
              style={styles.search}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.q}>{item.question}</Text>
                <Text style={styles.a}>{item.answer}</Text>
                {item.tags?.length ? <Text style={styles.tags}>#{item.tags.join(' #')}</Text> : null}
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: '#666' }}>No FAQs yet.</Text>}
          />
        </>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: { marginBottom: 10 },
  search: { borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingHorizontal: 10, height: 42, backgroundColor: '#fff' },
  card: { borderWidth: 1, borderColor: '#e9eef3', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  q: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6 },
  a: { color: '#1c1c1c' },
  tags: { color: '#777', fontSize: 12, marginTop: 6 },
});
