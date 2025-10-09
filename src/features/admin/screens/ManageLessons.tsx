import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, FlatList, Alert,
  ActivityIndicator, Modal, PanResponder, Dimensions, ScrollView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import BaseScreen from '../../../components/BaseScreen';
import { supabase } from '../../../../src/lib/supabaseClient';
import { uploadPublicFile, uploadStringAsFile } from '../../../../src/lib/storage/upload';
import { useAppSettings } from '../../../../src/context/AppSettings';

type TabKey = 'media' | 'examples';
type ExampleItem = { label: string; image_url: string; audio_url?: string };

type LessonRow = {
  label: string;
  video_url: string | null;
  video_urls?: any;            
  audio_url: string | null;
  tracing_url: string | null;  
  examples: any;
};

export default function AdminPhonicsLessonScreen() {
  const route = useRoute<any>();
  const { lessonId, label: incomingLabel } = route.params;

  const { fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [activeTab, setActiveTab] = useState<TabKey>('media');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState(incomingLabel || '');

  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [tracingUrl, setTracingUrl] = useState('');
  const [examples, setExamples] = useState<ExampleItem[]>([]);

  const [exModal, setExModal] = useState(false);
  const [exIndex, setExIndex] = useState<number | null>(null);
  const [exLabel, setExLabel] = useState('');
  const [exImage, setExImage] = useState<string | null>(null);
  const [exAudio, setExAudio] = useState<string>('');

  const [canvasOpen, setCanvasOpen] = useState(false);
  const CANVAS_W = Dimensions.get('window').width - 32;
  const CANVAS_H = 300;
  type Point = { x: number; y: number };
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const currentStroke = useRef<Point[]>([]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStroke.current = [{ x: locationX, y: locationY }];
          setStrokes((prev) => [...prev, currentStroke.current]);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentStroke.current = [...currentStroke.current, { x: locationX, y: locationY }];
          setStrokes((prev) => {
            const next = [...prev];
            next[next.length - 1] = currentStroke.current;
            return next;
          });
        },
        onPanResponderRelease: () => { currentStroke.current = []; },
        onPanResponderTerminate: () => { currentStroke.current = []; },
      }),
    []
  );

  const pathFromStroke = (pts: Point[]) => {
    if (!pts.length) return '';
    const [h, ...rest] = pts;
    const move = `M ${h.x.toFixed(1)} ${h.y.toFixed(1)}`;
    const lines = rest.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `${move} ${lines}`;
  };

  const svgString = useMemo(() => {
    const paths = strokes
      .map((s) => `<path d="${pathFromStroke(s)}" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />`)
      .join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white" />
  ${paths}
</svg>`;
  }, [strokes]);

  function coerceFirstVideo(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') {
      const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
      return parts[0] || '';
    }
    if (Array.isArray(v) && v.length > 0) return String(v[0] || '');
    return '';
  }

  const fetchLesson = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('phonics_lessons')
      .select('label, video_url, video_urls, audio_url, tracing_url, examples')
      .eq('id', lessonId)
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    const row = data as LessonRow;

    setLabel(row.label || incomingLabel || '');
    setVideoUrl(row.video_url || coerceFirstVideo(row.video_urls) || '');
    setAudioUrl(row.audio_url || '');
    setTracingUrl(row.tracing_url || '');

    const ex = Array.isArray(row.examples) ? row.examples : [];
    setExamples(ex);

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
    if (!videoUrl && !audioUrl && !tracingUrl && examples.length === 0) {
      Alert.alert('Nothing to save', 'Please change at least one field.'); return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('phonics_lessons')
      .update({
        video_url: videoUrl || null,
        audio_url: audioUrl || null,
        tracing_url: tracingUrl || null,
        examples: examples as any,
      })
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
            <Text style={[styles.label, { fontFamily }]}>Video URL</Text>
            <TextInput value={videoUrl} onChangeText={setVideoUrl} placeholder="https://..." style={styles.input} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => pickVideoTo(setVideoUrl)}>
                <Ionicons name="cloud-upload" size={18} color="#222" /><Text style={styles.btnTxt}>Upload video</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { fontFamily }]}>Audio URL</Text>
            <TextInput value={audioUrl} onChangeText={setAudioUrl} placeholder="https://..." style={styles.input} />
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => pickAudioTo(setAudioUrl)}>
                <Ionicons name="musical-notes" size={18} color="#222" /><Text style={styles.btnTxt}>Upload audio</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { fontFamily }]}>Tracing Image/SVG URL</Text>
            <TextInput value={tracingUrl} onChangeText={setTracingUrl} placeholder="https://..." style={styles.input} />
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              <TouchableOpacity style={styles.btn} onPress={() => pickImageTo(setTracingUrl, 'tracing')}>
                <Ionicons name="cloud-upload" size={18} color="#222" /><Text style={styles.btnTxt}>Upload image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => setCanvasOpen(true)}>
                <Ionicons name="create" size={18} color="#222" /><Text style={styles.btnTxt}>Open tracing canvas</Text>
              </TouchableOpacity>
            </View>
            {!!tracingUrl && (
              <Text style={{ color: '#666', marginTop: 6, fontSize: 12 }}>Current: {tracingUrl}</Text>
            )}
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

      <Modal visible={canvasOpen} transparent animationType="fade" onRequestClose={() => setCanvasOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.canvasCard}>
            <Text style={[styles.modalTitle, { fontFamily }]}>Tracing Canvas</Text>

            <View style={[styles.canvasBox, { width: CANVAS_W, height: CANVAS_H }]} {...panResponder.panHandlers}>
              <Svg width={CANVAS_W} height={CANVAS_H}>
                <Path d={`M 0 0`} fill="none" />
                {strokes.map((s, i) => (
                  <Path key={i} d={pathFromStroke(s)} fill="none" stroke="#111" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Svg>
            </View>

            <View style={[styles.row, { justifyContent: 'space-between', marginTop: 10 }]}>
              <TouchableOpacity style={styles.btnLite} onPress={() => setStrokes([])}>
                <Ionicons name="refresh" size={18} color="#222" /><Text style={styles.btnTxt}>Clear</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={async () => {
                    try {
                      const url = await uploadStringAsFile('phonics', `tracing/${Date.now()}_trace.svg`, svgString, 'image/svg+xml');
                      setTracingUrl(url);
                      setCanvasOpen(false);
                      setStrokes([]);
                      Alert.alert('Saved', 'Tracing SVG uploaded.');
                    } catch (e: any) {
                      Alert.alert('Upload error', e.message);
                    }
                  }}
                >
                  <Ionicons name="save" size={18} color="#222" /><Text style={styles.btnTxt}>Save SVG</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnLite} onPress={() => setCanvasOpen(false)}>
                  <Text style={{ fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>
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

  canvasCard: { width: '100%', maxWidth: 700, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e6ebf1' },
  canvasBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e6ebf1', overflow: 'hidden' },
});
