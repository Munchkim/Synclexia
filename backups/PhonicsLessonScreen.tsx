// PhonicsLessonScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useRoute, RouteProp } from '@react-navigation/native';
import BaseScreen from '../../components/BaseScreen';
import { useAppSettings } from '../../context/AppSettingsContext';
import { RootStackParamList } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import TracingCanvas, { TracingCanvasRef } from '../../components/TracingCanvas';
import { letterPaths } from '../../utils/letterPaths';

const PUBLIC_BASE_URL = 'https://ewviyxhfayxnwjurinew.supabase.co/storage/v1/object/public';

const phonemeToFilename: Record<string, string> = {
  'OO LONG': 'OOL',
  'OO SHORT': 'OOS',
  'TH VOICED': 'THV',
  'TH SILENT': 'THS',
};

const PHONEME_ORDER = [
  'S', 'A', 'T', 'I', 'P', 'N', 'CK', 'E', 'H', 'R', 'M', 'D', 'G', 'O', 'U', 'L', 'F', 'B', 'AI', 'J',
  'OA', 'IE', 'EE', 'OR', 'Z', 'W', 'NG', 'V', 'OO SHORT', 'OO LONG', 'Y', 'X', 'CH', 'SH',
  'TH SILENT', 'TH VOICED', 'QU', 'OU', 'OI', 'UE', 'ER', 'AR'
];

function getRecapPhonemes(currentPhoneme: string): string[] {
  const normalized = currentPhoneme.toUpperCase();
  const index = PHONEME_ORDER.indexOf(normalized);
  if (index === -1) return [];
  return PHONEME_ORDER.slice(Math.max(0, index - 6), index);
}

function getTracingLetters(phoneme: string): string[] {
  const map: Record<string, string[]> = {
    EE: ['E'],
    OO: ['O'],
    OOL: ['O'],
    OOS: ['O'],
    TH: ['T', 'H'],
    THV: ['T', 'H'],
    THS: ['T', 'H'],
  };
  const upper = phoneme.toUpperCase();
  return map[upper] || (upper.length === 2 ? [upper[0], upper[1]] : [upper]);
}

type Example = {
  label: string;
  image_url: string;
};

type PhonicsLesson = {
  id: string;
  label: string;
  phoneme: string;
  video_url?: string;
  video_urls?: string[] | null;
  audio_url: string;
  tracing_url: string;
  examples: Example[];
  blending?: string[] | null;
  group_name: string;
  order_index: number;
};

type LessonRouteProp = RouteProp<RootStackParamList, 'PhonicsLessonScreen'>;

export default function PhonicsLessonScreen() {
  const { accentColor, fontSize, fontFamily } = useAppSettings();
  const route = useRoute<LessonRouteProp>();
  const { phoneme } = route.params;
  const [lesson, setLesson] = useState<PhonicsLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const videoRefs = useRef<(Video | null)[]>([]);
  const canvasRefs = useRef<Record<string, TracingCanvasRef>>({});
  const canvasData = useRef<Record<string, string[]>>({}); // Store paths
  const currentCanvasPath = useRef<Record<string, string>>({}); // Ongoing stroke
  const [expandedLetter, setExpandedLetter] = useState<string | null>(null);

  const normalize = (label: string) =>
    label.normalize('NFKD').replace(/[–—]/g, '-').replace(/[^A-Z0-9\- ]/gi, '').trim().toUpperCase();

  const playAudio = async (label: string, isPhoneme = false) => {
    try {
      if (currentSound) {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
        setCurrentSound(null);
      }
      Speech.stop();
      const sanitized = normalize(label);
      const resolved = phonemeToFilename[sanitized] || sanitized;
      if (isPhoneme) {
        const uri = `${PUBLIC_BASE_URL}/phonics/audios/${resolved}.mp3`;
        const { sound } = await Audio.Sound.createAsync({ uri });
        setCurrentSound(sound);
        await sound.playAsync();
      } else {
        Speech.speak(label, {
          rate: 0.75,
          pitch: 1.1,
          language: 'en-US',
        });
      }
    } catch (e) {
      console.warn(`🔁 Audio failed for '${label}', falling back to TTS`, e);
      Speech.speak(label, {
        rate: 0.75,
        pitch: 1.1,
        language: 'en-US',
      });
    }
  };

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const { data, error } = await supabase
          .from('phonics_lessons')
          .select('*')
          .eq('phoneme', phoneme)
          .maybeSingle();

        if (error) {
          console.error('Error fetching lesson:', error.message);
          setLoading(false);
          return;
        }
        if (!data) {
          console.warn(`No lesson data found for phoneme: ${phoneme}`);
          setLoading(false);
          return;
        }

        const parsedData = {
          ...data,
          examples: typeof data.examples === 'string'
            ? JSON.parse(data.examples).map((ex: any) => ({ ...ex, image_url: ex.image_url.trim() }))
            : data.examples.map((ex: Example) => ({ ...ex, image_url: ex.image_url.trim() })),
          blending: data.blending
            ? typeof data.blending === 'string'
              ? JSON.parse(data.blending)
              : data.blending
            : [],
          video_urls: data.video_urls && Array.isArray(data.video_urls) && data.video_urls.length > 0
            ? data.video_urls
            : null,
        };

        setLesson(parsedData as PhonicsLesson);
        setLoading(false);
      } catch (e) {
        console.error('Unexpected error fetching lesson:', e);
        setLoading(false);
      }
    };
    fetchLesson();

    return () => {
      if (currentSound) currentSound.unloadAsync();
      Speech.stop();
    };
  }, [phoneme]);

  // Initialize canvas data
  useEffect(() => {
    if (!lesson) return;
    const letters = getTracingLetters(lesson.phoneme);
    letters.forEach((letter) => {
      const key = letter.toUpperCase();
      if (!canvasData.current[key]) {
        canvasData.current[key] = [];
        currentCanvasPath.current[key] = '';
      }
    });
  }, [lesson]);

  if (loading) {
    return (
      <BaseScreen title="Phonics Lesson">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </BaseScreen>
    );
  }

  if (!lesson) {
    return (
      <BaseScreen title="Phonics Lesson">
        <Text style={{ textAlign: 'center', marginTop: 50 }}>
          Lesson not found for {phoneme}
        </Text>
      </BaseScreen>
    );
  }

  const recapPhonemes = getRecapPhonemes(lesson.phoneme || phoneme);
  const hasMultipleVideos = lesson.video_urls && lesson.video_urls.length > 1;

  const handlePathChange = (letter: string, paths: string[]) => {
    canvasData.current[letter] = paths;
  };

  const handleCurrentPathChange = (letter: string, path: string) => {
    currentCanvasPath.current[letter] = path;
  };

  return (
    <BaseScreen title={`Phonics Lesson - ${lesson.label}`}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* RECAP */}
        {recapPhonemes.length > 0 && (
          <View style={styles.recapContainer}>
            <Text style={[styles.sectionTitle, { fontFamily }]}>RECAP</Text>
            <View style={styles.recapWords}>
              {recapPhonemes.map((word, index) => (
                <TouchableOpacity key={index} onPress={() => playAudio(word, true)} style={styles.wordBox}>
                  <Text style={[{ fontSize: Number(fontSize), fontFamily }]}>{word}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* VIDEO */}
        <View style={styles.videoContainer}>
          {hasMultipleVideos ? (
            (lesson.video_urls ?? []).map((url, idx) => (
              <TouchableOpacity key={idx} onPress={() => videoRefs.current[idx]?.replayAsync()} style={styles.singleVideoWrapper}>
                <Video
                  ref={(ref) => {
                    videoRefs.current[idx] = ref;
                  }}
                  source={{ uri: url }}
                  resizeMode={ResizeMode.CONTAIN}
                  style={styles.singleVideo}
                  isLooping
                  shouldPlay={false}
                />
              </TouchableOpacity>
            ))
          ) : lesson.video_url ? (
            <TouchableOpacity onPress={() => videoRefs.current[0]?.replayAsync()}>
              <Video
                ref={(ref) => {
                  videoRefs.current[0] = ref;
                }}
                source={{ uri: lesson.video_url }}
                resizeMode={ResizeMode.CONTAIN}
                style={styles.video}
                isLooping
                shouldPlay={false}
              />
            </TouchableOpacity>
          ) : (
            <Text style={{ color: 'red' }}>⚠️ No video available for {lesson.label}</Text>
          )}
        </View>

        {/* TRACING */}
        <View style={styles.tracingSection}>
          <Text style={[styles.sectionTitle, { fontFamily }]}>TRACE THE LETTER</Text>
          <View style={styles.tracingRow}>
            {getTracingLetters(lesson.phoneme).map((letter, index) => {
              const upperLetter = letter.toUpperCase();
              const canvasKey = `${upperLetter}-${index}`;
              const guidePath = letterPaths[upperLetter];

              return (
                <View key={canvasKey} style={styles.tracingContainer}>
                  <TouchableOpacity onPress={() => setExpandedLetter(upperLetter)}>
                    <View style={styles.canvasWrapper}>
                      <TracingCanvas
                        ref={(ref) => {
                          if (ref) canvasRefs.current[canvasKey] = ref;
                        }}
                        guidePath={guidePath}
                        strokeColor={accentColor}
                        containerStyle={styles.canvasInner}
                        initialPaths={canvasData.current[upperLetter] || []}
                        currentPath={currentCanvasPath.current[upperLetter] || ''}
                        onPathChange={(paths) => handlePathChange(upperLetter, paths)}
                        onCurrentPathChange={(path) => handleCurrentPathChange(upperLetter, path)}
                      />
                    </View>
                    <MaterialIcons name="zoom-out-map" size={20} color={accentColor} style={styles.expandIcon} />
                  </TouchableOpacity>
                  <Text style={[styles.tracingLabel, { fontFamily, fontSize: 16 }]}>{upperLetter}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      canvasRefs.current[canvasKey]?.clear();
                      canvasData.current[upperLetter] = [];
                      currentCanvasPath.current[upperLetter] = '';
                    }}
                    style={styles.clearButton}
                  >
                    <Text style={[styles.clearButtonText, { color: accentColor }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => {
              Object.keys(canvasData.current).forEach((key) => {
                const refKey = `${key}-0`;
                if (canvasRefs.current[refKey]) {
                  canvasRefs.current[refKey]?.clear();
                }
                canvasData.current[key] = [];
                currentCanvasPath.current[key] = '';
              });
            }}
            style={styles.clearAllButton}
          >
            <Text style={[styles.clearAllText, { color: accentColor }]}>Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* AUDIO BUTTON */}
        <TouchableOpacity onPress={() => playAudio(lesson.label, true)}>
          <Ionicons name="volume-high" size={40} color={accentColor} style={styles.icon} />
        </TouchableOpacity>

        {/* BLENDING */}
        {lesson.blending && lesson.blending.length > 0 && (
          <View style={styles.recapContainer}>
            <Text style={[styles.sectionTitle, { fontFamily }]}>BLENDING</Text>
            <View style={styles.recapWords}>
              {lesson.blending.map((word, index) => (
                <TouchableOpacity key={index} onPress={() => playAudio(word)} style={styles.wordBox}>
                  <Text style={[{ fontSize: Number(fontSize), fontFamily }]}>{word}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* EXAMPLES */}
        <Text style={[styles.sectionTitle, { fontFamily }]}>EXAMPLES</Text>
        <View style={styles.examplesContainer}>
          {lesson.examples.map((ex, index) => (
            <TouchableOpacity key={index} onPress={() => playAudio(ex.label)} style={styles.exampleItem}>
              {ex.image_url ? (
                <Image source={{ uri: ex.image_url }} style={styles.exampleImage} resizeMode="contain" />
              ) : (
                <Text style={{ color: 'red' }}>⚠️ Missing image for {ex.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* MODAL - EXPANDED TRACING */}
        <Modal
          visible={!!expandedLetter}
          transparent
          animationType="fade"
          onRequestClose={() => setExpandedLetter(null)}
        >
          {expandedLetter && letterPaths[expandedLetter] ? (
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Trace: {expandedLetter}</Text>
                <View style={styles.expandedCanvasContainer}>
                  <TracingCanvas
                    ref={(ref) => {
                      if (ref) canvasRefs.current[`${expandedLetter}-0`] = ref;
                    }}
                    guidePath={letterPaths[expandedLetter]}
                    strokeColor={accentColor}
                    containerStyle={{ flex: 1 }}
                    initialPaths={canvasData.current[expandedLetter] || []}
                    currentPath={currentCanvasPath.current[expandedLetter] || ''}
                    onPathChange={(paths) => handlePathChange(expandedLetter, paths)}
                    onCurrentPathChange={(path) => handleCurrentPathChange(expandedLetter, path)}
                  />
                </View>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    onPress={() => {
                      canvasRefs.current[`${expandedLetter}-0`]?.clear();
                      canvasData.current[expandedLetter] = [];
                      currentCanvasPath.current[expandedLetter] = '';
                    }}
                    style={[styles.modalButton, { backgroundColor: '#ff6b6b' }]}
                  >
                    <Text style={{ color: '#fff' }}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setExpandedLetter(null)}
                    style={[styles.modalButton, { backgroundColor: accentColor }]}
                  >
                    <Text style={{ color: '#fff' }}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}
        </Modal>

      </ScrollView>
    </BaseScreen>
  );
}

const screenWidth = Dimensions.get('window').width;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  videoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  video: {
    width: screenWidth * 0.8,
    aspectRatio: 1,
    backgroundColor: '#FF6F59',
    borderRadius: 20,
  },
  singleVideoWrapper: {
    marginHorizontal: 5,
  },
  singleVideo: {
    width: 120,
    height: 120,
    backgroundColor: '#FF6F59',
    borderRadius: 20,
  },
  icon: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  recapContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  recapWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  wordBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    margin: 5,
  },
  examplesContainer: {
    width: '100%',
    alignItems: 'center',
  },
  exampleItem: {
    backgroundColor: '#FF6F59',
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
  },
  exampleImage: {
    width: 100,
    height: 100,
  },
  tracingSection: {
    width: '100%',
    marginBottom: 20,
    alignItems: 'center',
  },
  tracingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 10,
  },
  tracingContainer: {
    alignItems: 'center',
    width: 160,
    height: 180,
  },
  canvasWrapper: {
    width: 160,
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  canvasInner: {
    flex: 1,
    borderRadius: 12,
  },
  tracingLabel: {
    marginTop: 6,
    fontWeight: 'bold',
  },
  clearButton: {
    marginTop: 4,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearAllButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  expandIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '90%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  expandedCanvasContainer: {
    width: '100%',
    aspectRatio: 1, // Ensures it's a square area
    maxWidth: 400,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});