// src/features/admin/screens/Help.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { supabase } from '../../../lib/supabaseClient';
import { useAppSettings } from '../../../context/AppSettings';

type FAQ = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  order_index: number;
  is_published: boolean;
};

export default function AdminHelpEditorScreen() {
  const { fontFamily } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [query, setQuery] = useState('');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('is_published', { ascending: false })
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) { Alert.alert('Error', error.message); setLoading(false); return; }
    setFaqs((data || []) as FAQ[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return faqs;
    const ql = query.toLowerCase();
    return faqs.filter(f =>
      f.question.toLowerCase().includes(ql) ||
      f.answer.toLowerCase().includes(ql) ||
      f.tags.join(' ').toLowerCase().includes(ql)
    );
  }, [faqs, query]);

  const openAdd = () => {
    setEditing(null);
    setQ(''); setA(''); setTags(''); setPublished(true);
    setOpen(true);
  };
  const openEdit = (row: FAQ) => {
    setEditing(row);
    setQ(row.question);
    setA(row.answer);
    setTags(row.tags.join(', '));
    setPublished(row.is_published);
    setOpen(true);
  };

  const save = async () => {
    if (!q.trim() || !a.trim()) {
      Alert.alert('Missing info', 'Please fill Question and Answer.');
      return;
    }
    setSaving(true);
    const payload = {
      question: q.trim(),
      answer: a.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      is_published: !!published,
      order_index: editing?.order_index ?? (faqs.length ? Math.max(...faqs.map(f => f.order_index)) + 1 : 0),
    };
    const { error } = editing
      ? await supabase.from('faqs').update(payload).eq('id', editing.id)
      : await supabase.from('faqs').insert([payload]);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setOpen(false);
    load();
  };

  const del = (row: FAQ) => {
    Alert.alert('Delete FAQ?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('faqs').delete().eq('id', row.id);
          if (error) Alert.alert('Error', error.message);
          else load();
        }
      }
    ]);
  };

  const move = async (row: FAQ, dir: -1 | 1) => {
  const idx = faqs.findIndex(f => f.id === row.id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= faqs.length) return;

  const aRow = faqs[idx];
  const bRow = faqs[swapIdx];

  setFaqs(prev => {
    const copy = [...prev];
    [copy[idx], copy[swapIdx]] = [copy[swapIdx], copy[idx]];
    return copy;
  });

  const [r1, r2] = await Promise.all([
    supabase.from('faqs').update({ order_index: bRow.order_index }).eq('id', aRow.id),
    supabase.from('faqs').update({ order_index: aRow.order_index }).eq('id', bRow.id),
  ]);

  if (r1.error || r2.error) {
    await load();
    Alert.alert('Error', (r1.error || r2.error)?.message ?? 'Failed to reorder FAQ.');
  } else {
    await load();
  }
};


  return (
    <BaseScreen title="Edit Help / FAQs" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              placeholder="Search FAQs…"
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
            <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
              <Ionicons name="add" size={18} color="#111" />
              <Text style={[styles.addTxt, { fontFamily }]}>Add FAQ</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item, index }) => (
              <View style={[styles.card, !item.is_published && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.q, { fontFamily }]} numberOfLines={2}>{item.question}</Text>
                  {item.tags.length > 0 && (
                    <Text style={styles.tags}>#{item.tags.join(' #')}</Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity onPress={() => move(item, -1)} disabled={index === 0}>
                    <Ionicons name="arrow-up" size={20} color={index === 0 ? '#aaa' : '#1c1c1c'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => move(item, +1)} disabled={index === filtered.length - 1}>
                    <Ionicons name="arrow-down" size={20} color={index === filtered.length - 1 ? '#aaa' : '#1c1c1c'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Ionicons name="pencil" size={20} color="#1c1c1c" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => del(item)}>
                    <Ionicons name="trash" size={20} color="#b00020" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: '#666' }}>No FAQs yet.</Text>}
          />
        </>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { fontFamily }]}>{editing ? 'Edit FAQ' : 'Add FAQ'}</Text>

            <Text style={[styles.label, { fontFamily }]}>Question</Text>
            <TextInput value={q} onChangeText={setQ} style={styles.input} placeholder="e.g., How do I start a lesson?" />

            <Text style={[styles.label, { fontFamily }]}>Answer (markdown supported)</Text>
            <TextInput value={a} onChangeText={setA} style={[styles.input, { height: 140 }]} multiline placeholder="Type the answer..." />

            <Text style={[styles.label, { fontFamily }]}>Tags (comma separated)</Text>
            <TextInput value={tags} onChangeText={setTags} style={styles.input} placeholder="e.g., account, progress" />

            <View style={styles.row}>
              <TouchableOpacity onPress={() => setPublished(p => !p)} style={[styles.toggle, published ? styles.tOn : styles.tOff]}>
                <Text style={{ fontWeight: '700' }}>{published ? 'Published' : 'Hidden'}</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={save} disabled={saving}>
                <Text style={{ fontWeight: '800', color: saving ? '#aaa' : '#111' }}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  search: { flex: 1, borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingHorizontal: 10, height: 42, backgroundColor: '#fff' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#fff' },
  addTxt: { fontWeight: '800', color: '#111' },

  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e9eef3', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10 },
  q: { fontWeight: '700', color: '#1c1c1c' },
  tags: { color: '#777', fontSize: 12, marginTop: 4 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  modalCard: { width: '100%', maxWidth: 720, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e6ebf1' },

  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1c1c1c', marginBottom: 12 },

  label: { fontWeight: '800', color: '#1c1c1c', marginTop: 8, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },

  toggle: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  tOn: { backgroundColor: '#e8fbe7', borderColor: '#c8e7c5' },
  tOff: { backgroundColor: '#f8f8f8', borderColor: '#e6ebf1' },
});
