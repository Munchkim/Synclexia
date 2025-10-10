import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList, Alert,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import BaseScreen from '../../../components/BaseScreen';
import { supabase } from '../../../../src/lib/supabaseClient';
import { uploadPublicFile } from '../../../../src/lib/storage/upload';
import { useAppSettings } from '../../../../src/context/AppSettings';

type TabKey = 'media' | 'examples';
type ExampleItem = { label: string; image_url: string; audio_url?: string };

type LessonRow = {
  label: string;
  phoneme: string | null;        // ⬅️ we also fetch phoneme now
  video_url: string | null;
  video_urls?: any;              // legacy can be string/array
  audio_url: string | null;
  examples: any;
};

const DOUBLE_SAME = new Set(['OO', 'EE']);
const mapPhonemeToDisplay = (p?: string | null) => {
  const s = (p || '').toUpperCase().trim();
  if (s === 'THS' || s === 'THV') return 'TH';
  return s;
};

const toKey = (s?: string | null) =>
  (s || '').toUpperCase().replace(/[^A-Z]/g, '');

export default function AdminPhonicsLessonScreen() {
  const route = useRoute<any>();
  const { lessonId, label: incomingLabel } = route.params;

  const { fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [activeTab, setActiveTab] = useState<TabKey>('media');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState(incomingLabel || '');
  const [phoneme, setPhoneme] = useState<string | null>(null);

  // video fields (up to 2)
  const [videoUrl1, setVideoUrl1] = useState('');
  const [videoUrl2, setVideoUrl2] = useState('');

  const [audioUrl, setAudioUrl] = useState('');
  const [examples, setExamples] = useState<ExampleItem[]>([]);

  const [exModal, setExModal] = useState(false);
  const [exIndex, setExIndex] = useState<number | null>(null);
  const [exLabel, setExLabel] = useState('');
  const [exImage, setExImage] = useState<string | null>(null);
  const [exAudio, setExAudio] = useState<string>('');

  // figure out whether this lesson is a digraph (needs two videos)
  const displayKey = useMemo(() => {
    const fromPhoneme = mapPhonemeToDisplay(phoneme);
    const keyFromPhoneme = toKey(fromPhoneme);
    const keyFromLabel  = toKey(label);
    // prefer label if it looks valid, fall back to phoneme
    const k = keyFromLabel || keyFromPhoneme;
    return k;
  }, [label, phoneme]);

  const isDoubleSame = DOUBLE_SAME.has(displayKey);
  const isDigraph = displayKey.length > 1 && !isDoubleSame;

  const coerceVideos = (video_url: any, video_urls: any): string[] => {
    // Accept arrays or comma-separated strings
    if (Array.isArray(video_urls)) return video_urls.map(String).filter(Boolean);
    if (typeof video_urls === 'string' && video_urls.trim()) {
      return video_urls.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof video_url === 'string' && video_url.trim()) return [video_url.trim()];
    return [];
  };

  const fetchLesson = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('phonics_lessons')
      .select('label, phoneme, video_url, video_urls, audio_url, examples')
      .eq('id', lessonId)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    const row = data as LessonRow;
    setLabel(row.label || incomingLabel || '');
    setPhoneme(row.phoneme || null);

    const vids = coerceVideos(row.video_url, row.video_urls);
    setVideoUrl1(vids[0] || '');
    setVideoUrl2(vids[1] || '');

    setAudioUrl(row.audio_url || '');
    setExamples(Array.isArray(row.examples) ? row.examples : []);
    setLoading(false);
  };

  useEffect(() => { fetchLesson(); }, [lessonId]);

  const pickImageTo = async (setter: (url: string) => void, folder: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      try {
        const uploadedUrl = await uploadPublicFile(
          'phonics',
          `${folder}/${Date.now()}_${asset.fileName || 'img'}`,
          asset.uri
        );
        setter(uploadedUrl);
      } catch (e: any) {
        Alert.alert('Upload error', e.message);
      }
    }
  };

  const pickVideoTo = async (setter: (url: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      try {
        const uploadedUrl = await uploadPublicFile(
          'phonics',
          `videos/${Date.now()}_${asset.fileName || 'video'}`,
          asset.uri
        );
        setter(uploadedUrl);
      } catch (e: any) {
        Alert.alert('Upload error', e.message);
      }
    }
  };

  const pickAudioTo = async (setter: (url: string) => void) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a'],
      copyToCacheDirectory: true, multiple: false,
    });
    if (res.canceled || !res.assets || res.assets.length === 0) return;
    const asset = res.assets[0];
    try {
      const uploadedUrl = await uploadPublicFile(
        'phonics',
        `audios/${Date.now()}_${asset.name || 'audio'}`,
        asset.uri
      );
      setter(uploadedUrl);
    } catch (e: any) {
      Alert.alert('Upload error', e.message);
    }
  };

  const openExModal = (index: number | null) => {
    setExIndex(index);
    if (index !== null) {
      const row = examples[index];
      setExLabel(row.label); setExImage(row.image_url); setExAudio(row.audio_url || '');
    } else {
      setExLabel(''); setExImage(null); setExAudio('');
    }
    setExModal(true);
  };

  const pickExampleImage = async () => {
    await pickImageTo((url) => setExImage(url), 'examples');
  };

  const saveExample = () => {
    if (!exLabel.trim() || !exImage) {
      Alert.alert('Missing data', 'Please add both a label and an image.');
      return;
    }
    const next = [...examples];
    const item: ExampleItem = { label: exLabel.trim(), image_url: exImage, audio_url: exAudio?.trim() || undefined };
    if (exIndex === null) next.push(item); else next[exIndex] = item;
    setExamples(next);
    setExModal(false); setExIndex(null); setExLabel(''); setExImage(null); setExAudio('');
  };

  const deleteExample = (index: number) => {
    const next = [...examples]; next.splice(index, 1); setExamples(next);
  };

  const saveLesson = async () => {
    // Build final video array (for digraphs we keep up to 2; otherwise just 1)
    const videos = (isDigraph ? [videoUrl1, videoUrl2] : [videoUrl1])
      .map(v => (v || '').trim())
      .filter(Boolean);

    if (videos.length === 0 && !audioUrl && examples.length === 0) {
      Alert.alert('Nothing to save', 'Please change at least one field.');
      return;
    }

    setSaving(true);
    const payload: any = {
      audio_url: audioUrl || null,
      examples: examples as any,
      // keep both for compatibility
      video_url: videos[0] || null,
      video_urls: videos.length > 0 ? videos : null,
    };

    const { error } = await supabase
      .from('phonics_lessons')
      .update(payload)
      .eq('id', lessonId);

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Saved', 'Lesson updated.');
  };

  if (loading) {
    return (
      <BaseScreen title="Edit Lesson">
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title={`Edit ${label}`} showBack>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['media', 'examples'] as TabKey[]).map((t) => {
          const active = activeTab === t;
          return (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabTxt, { fontFamily, opacity: active ? 1 : 0.7 }]}>
                {t === 'media' ? 'Media' : 'Examples'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'media' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={[styles.label, { fontFamily }]}>
              {isDigraph ? 'Video URL A' : 'Video URL'}
            </Text>
            <TextInput value={videoUrl1} onChangeText={setVideoUrl1} placeholder="https://..." style={styles.input} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => pickVideoTo(setVideoUrl1)}>
                <Ionicons name="cloud-upload" size={18} color="#222" /><Text style={styles.btnTxt}>Upload video</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isDigraph && (
            <View style={styles.section}>
              <Text style={[styles.label, { fontFamily }]}>Video URL B</Text>
              <TextInput value={videoUrl2} onChangeText={setVideoUrl2} placeholder="https://..." style={styles.input} />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => pickVideoTo(setVideoUrl2)}>
                  <Ionicons name="cloud-upload" size={18} color="#222" /><Text style={styles.btnTxt}>Upload video</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
                Optional: leave blank if you only want one video.
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { fontFamily }]}>Audio URL</Text>
            <TextInput value={audioUrl} onChangeText={setAudioUrl} placeholder="https://..." style={styles.input} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => pickAudioTo(setAudioUrl)}>
                <Ionicons name="musical-notes" size={18} color="#222" /><Text style={styles.btnTxt}>Upload audio</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity disabled={saving} style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]} onPress={saveLesson}>
            <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <FlatList
          data={examples}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <View style={styles.exampleRow}>
              <Image source={{ uri: item.image_url }} style={styles.exampleImg} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.exampleLabel, { fontFamily }]}>{item.label}</Text>
                {item.audio_url ? <Text style={{ color: '#666', fontSize: 12 }}>Audio: {item.audio_url}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => openExModal(index)} style={{ marginRight: 10 }}>
                <Ionicons name="pencil" size={20} color="#444" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteExample(index)}>
                <Ionicons name="trash" size={20} color="#b00" />
              </TouchableOpacity>
            </View>
          )}
          ListHeaderComponent={
            <View style={[styles.section, { paddingTop: 4 }]}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={[styles.label, { fontFamily }]}>Examples</Text>
                <TouchableOpacity style={styles.btnLite} onPress={() => openExModal(null)}>
                  <Ionicons name="add" size={18} color="#222" /><Text style={styles.btnTxt}>Add Example</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={{ color: '#666', margin: 10 }}>No examples yet.</Text>}
          ListFooterComponent={
            <TouchableOpacity disabled={saving} style={[styles.saveBtn, { opacity: saving ? 0.6 : 1, marginTop: 8 }]} onPress={saveLesson}>
              <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Example modal */}
      <Modal visible={exModal} transparent animationType="fade" onRequestClose={() => setExModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { fontFamily }]}>{exIndex === null ? 'Add' : 'Edit'} Example</Text>

            <TextInput value={exLabel} onChangeText={setExLabel} placeholder="Label (e.g., SUN)" style={styles.input} />

            <TouchableOpacity style={styles.imageBox} onPress={pickExampleImage}>
              {exImage ? (
                <Image source={{ uri: exImage }} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
              ) : (
                <Text style={{ color: '#777' }}>Pick image</Text>
              )}
            </TouchableOpacity>

            <TextInput value={exAudio} onChangeText={setExAudio} placeholder="(Optional) Example audio URL" style={styles.input} />

            <View style={[styles.row, { justifyContent: 'flex-end', gap: 12 }]}>
              <TouchableOpacity onPress={() => setExModal(false)}>
                <Text style={{ fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveExample}>
                <Text style={{ fontWeight: '700' }}>Save</Text>
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

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' },
  tabActive: { borderColor: '#dfe6ee' },
  tabTxt: { fontWeight: '700', color: '#1c1c1c' },

  section: { marginBottom: 14 },
  label: { fontWeight: '700', color: '#222', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e9eef3', borderRadius: 10, backgroundColor: '#fff'
  },
  btnLite: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#e9eef3', borderRadius: 10, backgroundColor: '#fff'
  },
  btnTxt: { marginLeft: 2, fontWeight: '700', color: '#222' },

  exampleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#eef2f7', borderRadius: 10, padding: 8, marginBottom: 8 },
  exampleImg: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#eee' },
  exampleLabel: { fontWeight: '600', color: '#222' },

  saveBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontWeight: '800', color: '#1c1c1c' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  modalCard: { width: '100%', maxWidth: 600, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e6ebf1' },
  modalTitle: { fontWeight: '800', fontSize: 16, marginBottom: 8, color: '#1c1c1c' },
  imageBox: { width: '100%', height: 160, backgroundColor: '#eee', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
});
