import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Modal, Alert, useWindowDimensions, StyleSheet
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { supabase } from '../../../../../src/lib/supabaseClient';
import TracingCanvas, { TracingCanvasRef } from '../../../../components/TracingCanvas';
import { styles as phonicsStyles } from '../../../../features/phonics/ui/PhonicsStyles';
import {
  PhonicsLesson,
  safeJsonArray,
  safeJsonObject,
  getRecentPhonemes,
  getMainLetter,
  playTextOrFile,
} from '../../../../features/phonics/data/phonics';
import { getLetterStrokes } from '../../../../features/phonics/tracing/letterStrokes';

const MAX_VIDEO_SIZE = 280;
const HORIZONTAL_PADDING_SAFETY = 48;
const VIDEO_GAP = 10;

function getSingleVideoSize(width: number): number {
  return Math.min(MAX_VIDEO_SIZE, width - HORIZONTAL_PADDING_SAFETY);
}
function getTwoColumnVideoSize(width: number): number {
  const usableWidth = width - HORIZONTAL_PADDING_SAFETY;
  const calculatedSize = (usableWidth - VIDEO_GAP) / 2;
  return Math.min(MAX_VIDEO_SIZE, calculatedSize);
}

const CANONICAL: Record<string, string> = {
  'TH - SILENT': 'THS', 'TH SILENT': 'THS', 'TH(S)': 'THS', 'THS': 'THS', 'TH S': 'THS', 'THSILENT': 'THS',
  'TH - VOICED': 'THV', 'TH VOICED': 'THV', 'TH(V)': 'THV', 'THV': 'THV', 'TH V': 'THV', 'THVOICED': 'THV',
  'TH': 'THS',
  'OO (SHORT)': 'OOS', 'OO SHORT': 'OOS', 'OO SHORT)': 'OOS', 'OOS': 'OOS',
  'OO (LONG)': 'OOL',  'OO LONG': 'OOL',  'OOL': 'OOL',
  'OO': 'OOL',
};
const normalizePhoneme = (p?: string) => {
  const s = (p || '').toUpperCase().trim();
  const compact = s.replace(/[^A-Z]/g, '');
  if (compact === 'THS' || compact === 'THSILENT') return 'THS';
  if (compact === 'THV' || compact === 'THVOICED') return 'THV';
  if (compact === 'TH') return 'THS';
  if (compact === 'OO' || compact === 'OOLONG') return 'OOL';
  if (compact === 'OOSHORT') return 'OOS';
  return compact;
};

const DISPLAY_LABEL: Record<string, string> = { THS: 'TH', THV: 'TH', OOS: 'OO', OOL: 'OO' };

function buildLessonCandidates(input: string) {
  const raw = (input || '').toUpperCase().trim();
  const canon = normalizePhoneme(raw);
  const compact = raw.replace(/[^A-Z]/g, '');
  const base = [canon, compact, raw];
  if (compact === 'TH') base.push('THS', 'THV');

  const phonemeKeys = Array.from(new Set([
    ...base,
    ...base.map((k) => k.toLowerCase()),
    ...base.map((k) => k.toUpperCase()),
  ]));

  const labelKeys = Array.from(new Set([
    raw, canon, compact,
    'TH (VOICED)', 'TH (SILENT)',
    'TH VOICED', 'TH SILENT',
  ]));

  return { phonemeKeys, labelKeys };
}

const HARD_CODED_BLENDS: Record<string, string[]> = {
  I: ['IT', 'IS', 'ITS', 'SIT', 'SITS'],
  P: ['PIT', 'PAT', 'TIP', 'TAP', 'SAP', 'SIP', 'PIP', 'TAPS', 'SPIT', 'PIPS', 'PATS', 'SPAT', 'TIPS', 'SIPS', 'SPITS'],
  N: ['AN', 'IN', 'TIN', 'NIP', 'NIT', 'TAN', 'PIN', 'ANT', 'NAP', 'PAN', 'SPAN', 'SPIN', 'SNIP', 'SNAP', 'PANT', 'SPINS', 'PANTS', 'INSIST'],
  R: ['RAT', 'RAN', 'RIP', 'REST', 'RACK', 'RAP', 'CRESS', 'TRIP', 'PRESS', 'RENT', 'RISK', 'CRACK', 'TRICK', 'TRAP', 'PRICK', 'TRACK', 'SCRAP', 'CRISP', 'STRIP', 'STRESS', 'RACKET', 'STRAP', 'PRINT', 'CREPT', 'CREST', 'STRICT', 'CRICKET', 'SPRINT'],
  M: ['MAN', 'MAT', 'MAP', 'MEN', 'AM', 'IMP', 'MESS', 'RIM', 'MISS', 'HEM', 'RAM', 'HIM', 'MET', 'MASS', 'STEM', 'CAMP', 'MINT', 'MIST', 'TRAM', 'TRIM', 'RAMP', 'SMACK', 'TRAMP', 'STAMP', 'MATTRESS'],
  D: ['DAD', 'DID', 'HID', 'KID', 'MID', 'HAD', 'MAD', 'DIP', 'DIM', 'END', 'DIN', 'RED', 'DAMP', 'PAD', 'DEN', 'SAD', 'DECK', 'RID', 'AND', 'SEND', 'DISK', 'DESK', 'SAND', 'MEND', 'HAND', 'DENT', 'DRIP', 'DRESS', 'SKID', 'SPEND', 'STAND', 'DENTIST'],
  L: ['LEG', 'LET', 'LIP', 'LOT', 'LAP', 'LIT', 'LUCK', 'LOSS', 'LAD', 'LESS', 'LASS', 'LOG', 'LICK', 'OLD', 'PAL', 'LOCK', 'LED', 'LID', 'TILT', 'PLUG', 'LEGS', 'SULK', 'CLOCK', 'LAND', 'CLAP', 'CLOG', 'LOTS', 'SLAM', 'LENT', 'LIMP', 'LIPS', 'SLICK', 'LICKS', 'HELD', 'SLAP', 'MELT', 'LUMP', 'PLOT', 'GULP', 'HELP', 'GLUM', 'SLUG', 'SILK', 'CLIP', 'LAMP', 'PLUM', 'GLAD', 'SLIP', 'PLUS', 'LEND', 'CLUCK', 'LIST', 'SLIT', 'SLOT', 'MILK', 'SLIM', 'SLID', 'LOST', 'PLAN', 'CLICK', 'CAROL', 'SOLID', 'TUNNEL', 'SPLIT', 'LESSON', 'MELON', 'LEMON', 'SLEPT', 'CLAPS', 'LANDS', 'CALMP', 'PLUMP', 'UNLOCK', 'ADULT', 'UNTIL', 'CLUMP', 'HELPS', 'UNLESS', 'UNPLUG', 'ANIMAL', 'SPLATS', 'TINSEL', 'LIPSTICK', 'PLASTIC', 'ELASTIC', 'ELECTRIC', 'SPLENDID'],
  F: ['IF', 'FAT', 'FIT', 'FUN', 'FELL', 'FOG', 'FED', 'FIN', 'ELF', 'FILL', 'FIG', 'FUSS', 'FAN', 'FLAG', 'FUND', 'SOFT', 'TUFT', 'FROM', 'FELT', 'GOLF', 'FACT', 'FLAP', 'FRILL', 'FROG', 'LOFT', 'FLOCK', 'FLAT', 'LEFT', 'GIFT', 'SELF', 'FOND', 'FILM', 'FLOP', 'FIST', 'LIFT', 'FROST', 'FLAPS', 'FLOPS', 'FLICKS', 'LIFTS', 'FOSSIL', 'FOREST', 'INFANT', 'FANTASTIC'],
  B: ['BAG', 'BAD', 'BAT', 'BED', 'BUN', 'TUB', 'BOG', 'BUG', 'BILL', 'CAB', 'HOB', 'BAN', 'HUB', 'BIB', 'BUS', 'ROB', 'BUD', 'BIG', 'BOB', 'SOB', 'BET', 'BELL', 'BIN', 'BEG', 'RIB', 'BACK', 'CUB', 'BUT', 'RUB', 'BOSS', 'BIT', 'BELT', 'CRIB', 'BLOT', 'BLACK', 'GRUB', 'CLUB', 'BEND', 'BUNK', 'CRAB', 'BENT', 'BLOCK', 'BAND', 'BRICK', 'RUBS', 'BULB', 'BEST', 'SCAB', 'GEAB', 'BUMP', 'ROBIN', 'BOTTOM', 'BUTTON', 'BUCKET', 'BLINK', 'HABIT', 'BLOND', 'BLEND', 'GRABS', 'BLOSSOM', 'UMBRELLA', 'BLANKET', 'PROBLEM'],
  IE: ['TIE', 'DIE', 'LIE', 'PIE', 'DIED', 'LIES', 'LIED', 'TIED', 'FRIED', 'FLIES', 'CRIES', 'DRIED', 'SPIED', 'DRIES', 'TRIED', 'CRIED', 'UNTIE', 'TRIES', 'UNTIED', 'MAGPIE'],
  EE: ['EEL', 'SEE', 'BEE', 'BEEF', 'JEEP', 'SEEN', 'BEEP', 'NEED', 'PEEL', 'MEET', 'TREE', 'DEEP', 'KEEP', 'HEEL', 'REEF', 'BEEN', 'SEEK', 'SEED', 'SEEM', 'PEEP', 'FREE', 'FEED', 'LEEK', 'FEEL', 'FEET', 'KEEN', 'SPEED', 'STEEP', 'COFFEE', 'AGREE', 'SLEEP', 'BLEED', 'CREEP', 'GREED', 'SETTEE', 'GREEN', 'TOFFEE', 'STREET', 'SCREEN', 'INDEED', 'ASLEEP'],
  OR: ['OR', 'FOR', 'LORD', 'FORK', 'CORK', 'CORN', 'SORT', 'FORM', 'CORD', 'PORT', 'FORT', 'HORN', 'BORN', 'TORN', 'STORK', 'SPORT', 'SNORT', 'STORM', 'TORMY', 'FOGHORN', 'POPCORD'],
  V: ['VAN', 'VAT', 'VET', 'VENT', 'VAIN', 'EVEN', 'VEST', 'VISIT', 'VIVID', 'SEVEN', 'VELVET', 'INVENT', 'TRAVEL', 'VANILLA', 'DEVELOP', 'CARAVAN', 'SEVENTEEN'],
  OOS: ['LOOK', 'FOOT', 'SOOT', 'WOOL', 'COOK', 'BOOK', 'WOOD', 'HOOK', 'ROOK', 'GOOD', 'WOOF', 'HOOD', 'TOOK', 'BROOK', 'STOOD', 'LOOKING', 'COOKING', 'WOODLAND', 'SCRAPBOOK', 'FOOTSTEPS'],
  OOL: ['TOO', 'ZOO', 'HOOP', 'MOON', 'BOO', 'MOO', 'POOL', 'ROOM', 'SOON', 'FOOL', 'COOL', 'ROOT', 'TOOL', 'MOOD', 'LOOP', 'ZOOM', 'NOON', 'HOOT', 'ROOF', 'BOOM', 'TOOT', 'HOOF', 'FOOD', 'BOOT', 'BLOOM', 'GLOOM', 'STOOP', 'STOOL', 'SPOOK', 'SPOON', 'BOOTS', 'SCOOP', 'BROOM', 'IGLOO', 'BEDROOM', 'TOADSTOOL', 'BROOMSTICK'],
  SH: ['FISH', 'WISH', 'DISH', 'SHOP', 'ASH', 'CASH', 'SHEET', 'SHOOK', 'SHALL', 'SHIN', 'SHED', 'RUSH', 'BASH', 'SHEEP', 'HUSH', 'SHIP', 'SHUT', 'SHORT', 'SHOT', 'SHOCK', 'SHELL', 'RASH', 'SHOOT', 'MASH', 'BLUSH', 'SHIFT', 'BRUSH', 'FLASH', 'SHIPS', 'FRESH', 'SHELF', 'CRASH', 'FLUSH', 'SMASH', 'SHRUG', 'EGGSHELL', 'SHAMPOO', 'SHRINK', 'FINISH', 'SHERIFF', 'SHRIMP', 'SHOCKING', 'SHOPPING', 'SPLASH', 'PUNISH', 'MUSHROOM', 'BLUSHING', 'BOOKSHOP', 'BOOKSHELF', 'PAINTBRUSH'],
  THV: ['THAN', 'THEM', 'THIS', 'THAT', 'WITH', 'THEN', 'SMOOTH'],
  THS: ['THIN', 'THANKS', 'THEFT', 'THING', 'THICK', 'THREE', 'MOTH', 'THORN', 'THUD', 'TOOTH', 'THROW', 'NORTH', 'TEETH', 'TENTH', 'SIXTH', 'FROTH', 'THUMP', 'THRUSH', 'THINK', 'THROB', 'THROAT', 'CLOTH', 'SEVENTH', 'THINKING', 'TOOTHBRUSH'],
   UE: [
    'FUEL','DUE','VALUE','RESCUE','CUE','DUEL','ISSUE','TISSUE','STATUE','CONTINUE'
  ],

  ER: [
    'HER','VERB','HERB','ADVERB','OFFER','EVER','HERD','PERCH','FERN','COOKER','SUFFER','SHATTER','PEPPER',
    'SUPPER','HAMMER','DINNER','RIVER','MIXER','CORNER','SUMMER','RUNNER','BOTHER','SHIVER','HOTTER','DEEPER',
    'LITTER','LETTER','BUTTER','WINNER','FATTER','BETTER','CHATTER','LADDER','SINGER','UNDER','NEVER','WAITER',
    'MISTER','TODDLER','CLEVERDUSTER','SWIMMER','SILVER','SCOOTER','LONGER','THUNDER','PAINTER','CRACKER','TEMPER',
    'MERMAID','STICKER','SLITHER','SMOOTHER','SISTER','TOASTER','WINTER','NUMBER','JESTER','BUMPER','JUMPER',
    'SLIPPER','TWEEZERS','MONSTER','BLISTER','SLIPPERS','SMUGGLER','BLENDER','PRINTER','PERFECT','HERSELF',
    'CHATTERBOX','BUTTERCUP','SPRINTER','WOODPECKER','SPLINTER','UNDERSTAND','THUNDERSTORM','HELICOPTER','FARMER','SMARTER'
  ],

  AR: [
    'ARK','ART','BAR','CAR','JAR','FAR','ARM','ARCH','PARK','TART','DARK','MARCH','ARGUE','HARD','SHARP','SCAR',
    'MARSH','DART','BARK','YARD','STAR','MARK','PART','HARP','CHART','CHARM','CART','CARD','BARN','HARM','FARM',
    'SHARK','HARDER','START','SCARF','SPARK','FARMER','SMARTER','CARTOON','STARTS','GARLIC','CARPET','TARGET',
    'STARFISH','DARKROOM','ARMBAND','STARLING','BARBECUE','FARMYARD','CATERPILLAR'
  ],
};

const NO_BLEND: Record<string, true> = { S: true, A: true };
const T_TWO_ONLY = ['AT', 'SAT'];
const DOUBLE_SAME_SET = new Set(['OO', 'EE']);

type Params = { phoneme: string };
type R = RouteProp<{ GroupLesson: Params }, 'GroupLesson'>;

function SquareVideo({ uri }: { uri: string }) {
  const ref = useRef<Video | null>(null);
  const { width } = useWindowDimensions();
  const size = getSingleVideoSize(width);

  const onToggle = useCallback(async () => {
    try {
      const status = await ref.current?.getStatusAsync();
      if (!status?.isLoaded) { await ref.current?.playAsync(); return; }
      if (status.isPlaying) await ref.current?.pauseAsync();
      else await ref.current?.playAsync();
    } catch (e) {
      console.warn('Video toggle failed:', e);
    }
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      style={[local.videoSquare, { width: size, height: size, borderColor: 'transparent' }]}
    >
      <Video
        ref={ref}
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
        shouldPlay={false}
        useNativeControls={false}
      />
    </TouchableOpacity>
  );
}

function SquareVideoSmall({ uri, tile }: { uri: string; tile: number }) {
  const ref = useRef<Video | null>(null);
  const { width } = useWindowDimensions();
  const size = getTwoColumnVideoSize(width);

  const onToggle = useCallback(async () => {
    try {
      const status = await ref.current?.getStatusAsync();
      if (!status?.isLoaded) { await ref.current?.playAsync(); return; }
      if (status.isPlaying) await ref.current?.pauseAsync();
      else await ref.current?.playAsync();
    } catch (e) {
      console.warn(`Video ${tile} toggle failed:`, e);
    }
  }, [tile]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      style={[local.videoSquare, { width: size, height: size, borderColor: 'transparent' }]}
    >
      <Video
        ref={ref}
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
        shouldPlay={false}
        useNativeControls={false}
      />
    </TouchableOpacity>
  );
}

export default function GroupLesson() {
  const route = useRoute<R>();
  const rawPhoneme = (route.params.phoneme || '').toUpperCase().trim();
  const dbPhoneme = normalizePhoneme(rawPhoneme);

  const { accentColor, fontSize, fontFamily } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [lesson, setLesson] = useState<PhonicsLesson | null>(null);
  const [loading, setLoading] = useState(true);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [recentPhonemes, setRecentPhonemes] = useState<Array<{ phoneme: string; audio_url: string | null }>>([]);
  const [recapKeys, setRecapKeys] = useState<string[]>([]);

  const singleCanvasRef = useRef<TracingCanvasRef>(null);
  const expandedCanvasRef = useRef<TracingCanvasRef>(null);
  const traceRefs = useRef<Array<TracingCanvasRef | null>>([]);
  const currentSoundRef = useRef<Audio.Sound | null>(null);

  const prettyLabel = useMemo(
    () => (lesson ? (DISPLAY_LABEL[normalizePhoneme(lesson.phoneme)] || lesson.label || lesson.phoneme) : dbPhoneme),
    [lesson, dbPhoneme]
  );
  const prettyUpper = (prettyLabel || '').toUpperCase();
  const isDoubleSame = DOUBLE_SAME_SET.has(prettyUpper);
  const isDigraph = prettyUpper.length > 1 && !isDoubleSame;

  const getPrettyLabel = (key: string, fallback?: string) =>
    DISPLAY_LABEL[normalizePhoneme(key)] || fallback || key;
  const recapDisplay = (k: string) => (DISPLAY_LABEL[normalizePhoneme(k)] || k);

  useEffect(() => () => { currentSoundRef.current?.unloadAsync?.(); }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const { phonemeKeys, labelKeys } = buildLessonCandidates(rawPhoneme);

        let { data, error } = await supabase
          .from('phonics_lessons')
          .select('*')
          .in('phoneme', phonemeKeys)
          .limit(1);

        if ((!data || data.length === 0) && !error) {
          const res2 = await supabase
            .from('phonics_lessons')
            .select('*')
            .in('label', labelKeys)
            .limit(1);
          data = res2.data || [];
          error = res2.error ?? error;
        }

        if (error) throw error;
        if (!data || data.length === 0) {
          Alert.alert('Not Found', `No lesson found for ${rawPhoneme}`);
          return;
        }

        const row = data[0];
        const parsed: PhonicsLesson = {
          ...row,
          examples: safeJsonArray(row.examples, []),
          blending: safeJsonArray<string>(row.blending, []),
          video_urls: safeJsonArray<string>(row.video_urls, undefined) || null,
          audio_url: row.audio_url ?? null,
          tracing_urls: safeJsonArray<string>(row.tracing_urls, undefined) || null,
          alternatives: safeJsonObject<Record<string, string[]>>(row.alternatives, {}) || {},
        };
        if (live) setLesson(parsed);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to load lesson');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [rawPhoneme]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const curKey = normalizePhoneme(lesson?.phoneme || dbPhoneme);
        if (!lesson) { setRecapKeys([]); return; }

        if (curKey === 'S') { setRecapKeys([]); return; }

        const currentOrder = (lesson as any)?.order_index;
        if (currentOrder == null) { setRecapKeys([]); return; }

        const { data, error } = await supabase
          .from('phonics_lessons')
          .select('phoneme, order_index')
          .lt('order_index', currentOrder)
          .order('order_index', { ascending: false })
          .limit(8); 

        if (error) throw error;
        const prev = (data || []);

        const prevNorm = prev.map(r => ({ k: normalizePhoneme(r.phoneme), oi: r.order_index }));

        let filtered: { k: string; oi: number }[];

        if (curKey === 'THS' || curKey === 'THV') {
          const thEarlierCount = prevNorm.filter(r => r.k === 'THS' || r.k === 'THV').length;

          if (thEarlierCount === 0) {
            filtered = prevNorm.filter(r => r.k !== 'THS' && r.k !== 'THV');
          } else {
            filtered = prevNorm.filter(r => r.k !== curKey);
          }
        } else {
          filtered = prevNorm.filter(r => r.k !== curKey);
        }

        const keys = filtered
          .sort((a, b) => a.oi - b.oi) 
          .map(r => r.k);

        if (live) setRecapKeys(keys);
      } catch (e) {
        console.error('recap compute failed:', e);
        if (live) setRecapKeys([]);
      }
    })();
    return () => { live = false; };
  }, [lesson?.phoneme, (lesson as any)?.order_index, dbPhoneme]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (recapKeys.length === 0) { setRecentPhonemes([]); return; }
      try {
        const { data, error } = await supabase
          .from('phonics_lessons')
          .select('phoneme, audio_url')
          .in('phoneme', recapKeys);
        if (error) throw error;

        const map = new Map<string, string | null>();
        (data || []).forEach((d) => map.set(normalizePhoneme(d.phoneme), d.audio_url ?? null));

        if (live) {
          setRecentPhonemes(
            recapKeys.map((k) => ({ phoneme: k, audio_url: map.get(normalizePhoneme(k)) ?? null }))
          );
        }
      } catch (e) {
        console.error('Failed to fetch recap:', e);
      }
    })();
    return () => { live = false; };
  }, [recapKeys.join('|')]);

  const playPhoneme = async () =>
    playTextOrFile({ text: '', audioUrl: lesson?.audio_url || null, currentSoundRef });

  const computeBlends = (curKey: string, dbWords: string[] | null) => {
    const canon = normalizePhoneme(curKey);
    const visibleUnit = (DISPLAY_LABEL[canon] || canon).toUpperCase().trim();
    const fromDB = (dbWords || []).map((w) => String(w).toUpperCase().trim()).filter(Boolean);

    if (NO_BLEND[canon]) return [];
    if (canon === 'T') return T_TWO_ONLY;

    const base = fromDB.length >= 3 ? fromDB : (HARD_CODED_BLENDS[canon] || fromDB);
    const filtered = visibleUnit ? base.filter((w) => w.includes(visibleUnit)) : base;
    const ensured = filtered.length >= 3 ? filtered : base;
    return Array.from(new Set(ensured)).slice(0, 60);
  };

  const fullBlendPool = useMemo(
    () => computeBlends(lesson?.phoneme || dbPhoneme, lesson?.blending || []),
    [lesson?.phoneme, lesson?.blending, dbPhoneme]
  );

  const displayLetters = useMemo(() => {
    const label = (getPrettyLabel(lesson?.phoneme || dbPhoneme, lesson?.label || dbPhoneme) || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    if (!label) return [];
    if (DOUBLE_SAME_SET.has(label)) return [label[0]];
    return label.split('');
  }, [lesson?.phoneme, lesson?.label, dbPhoneme]);

  const rawVideos: string[] =
    (lesson?.video_urls && lesson.video_urls.length > 0) ? lesson.video_urls :
    (lesson?.video_url ? [lesson.video_url] : []);

  const videos = useMemo(() => {
    if (isDoubleSame) return rawVideos.slice(0, 1);
    if (isDigraph)    return rawVideos.slice(0, 2);
    return rawVideos.slice(0, 1);
  }, [rawVideos, isDoubleSame, isDigraph]);

  const initialCount = useMemo(() => Math.min(3, fullBlendPool.length), [fullBlendPool.length]);
  const MAX_SHOW = Math.min(30, fullBlendPool.length);
  const [visibleBlendCount, setVisibleBlendCount] = useState<number>(initialCount);
  useEffect(() => setVisibleBlendCount(initialCount), [initialCount]);
  const visibleBlends = fullBlendPool.slice(0, visibleBlendCount);

  const clearSingleCanvas = () => singleCanvasRef.current?.clear();
  const clearExpandedCanvas = () => expandedCanvasRef.current?.clear();

  if (loading) {
    return (
      <BaseScreen title="Loading Lesson...">
        <View style={phonicsStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#999" />
          <Text style={[phonicsStyles.loadingText]}>Loading {dbPhoneme} lesson...</Text>
        </View>
      </BaseScreen>
    );
  }
  if (!lesson) {
    return (
      <BaseScreen title="Lesson Not Found">
        <View style={phonicsStyles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
          <Text style={phonicsStyles.errorText}>Lesson not found for "{dbPhoneme}"</Text>
        </View>
      </BaseScreen>
    );
  }

  const showRecap = recapKeys.length > 0;

  return (
    <BaseScreen title={`Learn: ${prettyLabel}`}>
      <ScrollView contentContainerStyle={phonicsStyles.container} showsVerticalScrollIndicator={false}>

        {/* 📚 RECAP */}
        {showRecap && (
          <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
            <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>📚 RECAP</Text>
            <View style={phonicsStyles.recapGrid}>
              {recapKeys.map((ph, i) => {
                const phonemeData = recentPhonemes.find((item) => normalizePhoneme(item.phoneme) === normalizePhoneme(ph));
                const label = recapDisplay(ph);
                return (
                  <TouchableOpacity
                    key={`${ph}-${i}`}
                    onPress={() => playTextOrFile({
                      text: '',
                      audioUrl: phonemeData?.audio_url ?? null,
                      currentSoundRef
                    })}
                    style={[phonicsStyles.recapButton, { borderColor: accentColor }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[phonicsStyles.recapButtonText, { fontFamily, fontSize: fontSizeValue }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {videos.length > 0 && (
          <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
            <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>🎥 WATCH & LEARN</Text>
            {videos.length === 1 ? (
              <View style={local.oneVideoWrap}><SquareVideo uri={videos[0]} /></View>
            ) : (
              <View style={local.multiVideosWrap}>
                {videos.map((u, idx) => (<SquareVideoSmall key={`${u}-${idx}`} uri={u} tile={idx} />))}
              </View>
            )}
          </View>
        )}

        <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
          <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>🔊 LISTEN</Text>
          <TouchableOpacity
            onPress={playPhoneme}
            style={[phonicsStyles.audioButton, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <Ionicons name="volume-high" size={32} color="#fff" />
            <Text style={[phonicsStyles.audioButtonText, { fontFamily }]}>
              Play "{prettyLabel}" Sound
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
          <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>
            ✏️ TRACE THE LETTER{displayLetters.length > 1 ? 'S' : ''}
          </Text>

          {displayLetters.length > 1 ? (
            <View>
              <Text style={[phonicsStyles.tracingInstructions, { fontFamily }]}>
                Trace the letters: <Text style={{ fontWeight: 'bold', color: accentColor }}>{displayLetters.join('')}</Text>
              </Text>

              <View style={local.traceColumn}>
                {displayLetters.map((L, i) => (
                  <View key={`trace-${L}-${i}`} style={[local.traceTile, { borderColor: accentColor }]}>
                    <Text style={[phonicsStyles.tracingInstructions, { fontFamily, marginBottom: 6 }]}>
                      Trace the letter <Text style={{ fontWeight: 'bold', color: accentColor }}>{L}</Text>
                    </Text>

                    <View style={local.tileCanvasBox}>
                      <TracingCanvas
                        ref={(el) => { traceRefs.current[i] = el; }}
                        guidePaths={getLetterStrokes(L)}
                        strokeColor={accentColor}
                        containerStyle={local.canvasFill}
                        strokeWidth={5}
                      />
                    </View>

                    <View style={phonicsStyles.canvasControls}>
                      <TouchableOpacity
                        onPress={() => traceRefs.current[i]?.clear()}
                        style={[phonicsStyles.controlButton, phonicsStyles.clearButton]}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <Text style={phonicsStyles.controlButtonText}>Clear</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setExpandedIndex(i)}
                        style={[phonicsStyles.controlButton, { backgroundColor: accentColor }]}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="expand" size={16} color="#fff" />
                        <Text style={phonicsStyles.controlButtonText}>Expand</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <>
              <Text style={[phonicsStyles.tracingInstructions, { fontFamily }]}>
                Trace the letter:{' '}
                <Text style={{ fontWeight: 'bold', color: accentColor }}>
                  {displayLetters[0] || getMainLetter(lesson.phoneme)}
                </Text>
              </Text>

              <View style={[phonicsStyles.tracingContainer, { borderColor: accentColor }]}>
                <View style={local.canvasBox}>
                  <TracingCanvas
                    ref={singleCanvasRef}
                    guidePaths={getLetterStrokes(displayLetters[0] || getMainLetter(lesson.phoneme))}
                    strokeColor={accentColor}
                    containerStyle={local.canvasFill}
                    strokeWidth={5}
                  />
                </View>

                <View style={phonicsStyles.canvasControls}>
                  <TouchableOpacity
                    onPress={clearSingleCanvas}
                    style={[phonicsStyles.controlButton, phonicsStyles.clearButton]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={phonicsStyles.controlButtonText}>Clear</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setExpandedIndex(0)}
                    style={[phonicsStyles.controlButton, { backgroundColor: accentColor }]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="expand" size={16} color="#fff" />
                    <Text style={phonicsStyles.controlButtonText}>Expand</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>

        {lesson.examples?.length > 0 && (
          <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
            <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>🖼️ EXAMPLES</Text>
            <View style={phonicsStyles.examplesGrid}>
              {lesson.examples.map((ex, i) => (
                <TouchableOpacity
                  key={`${ex.label}-${i}`}
                  onPress={() => playTextOrFile({ text: ex.label, currentSoundRef })}
                  style={[phonicsStyles.exampleCard, { borderColor: accentColor }]}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: ex.image_url }} style={{ width: 80, height: 80, marginBottom: 8 }} resizeMode="contain" />
                  <Text style={{ fontFamily, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>{ex.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {fullBlendPool.length > 0 && (
          <View style={[phonicsStyles.section, { borderColor: accentColor }]}>
            <Text style={[phonicsStyles.sectionTitle, { fontFamily, color: accentColor }]}>🔤 BLENDING WORDS</Text>

            <View style={phonicsStyles.blendingGrid}>
              {visibleBlends.map((w, i) => (
                <TouchableOpacity
                  key={`${w}-${i}`}
                  onPress={() => playTextOrFile({ text: w, currentSoundRef })}
                  style={[phonicsStyles.blendingButton, { borderColor: accentColor }]}
                  activeOpacity={0.75}
                >
                  <Text style={{ fontFamily, fontWeight: 'bold', fontSize: fontSizeValue, textAlign: 'center' }}>{w}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {fullBlendPool.length > initialCount && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                {visibleBlendCount < MAX_SHOW ? (
                  <TouchableOpacity
                    onPress={() => setVisibleBlendCount(MAX_SHOW)}
                    style={[phonicsStyles.loadMoreBtn, { borderColor: accentColor }]}
                  >
                    <Text style={{ fontFamily, fontWeight: '700', color: accentColor }}>Show More</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setVisibleBlendCount(initialCount)}
                    style={[phonicsStyles.loadMoreBtn, { borderColor: accentColor }]}
                  >
                    <Text style={{ fontFamily, fontWeight: '700', color: accentColor }}>Show Less</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={expandedIndex !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setExpandedIndex(null)}
      >
        <View style={phonicsStyles.modalContainer}>
          <View style={phonicsStyles.modalHeader}>
            <Text style={[phonicsStyles.modalTitle, { fontFamily, color: accentColor }]}>
              Trace: {displayLetters[expandedIndex ?? 0] || prettyLabel}
            </Text>
            <TouchableOpacity onPress={() => setExpandedIndex(null)} style={phonicsStyles.closeButton}>
              <Ionicons name="close" size={24} color={accentColor} />
            </TouchableOpacity>
          </View>

          <View style={[local.expandedContainer, { borderColor: accentColor }]}>
            <View style={local.expandedSquare}>
              <TracingCanvas
                ref={expandedCanvasRef}
                guidePaths={getLetterStrokes(displayLetters[expandedIndex ?? 0] || getMainLetter(lesson.phoneme))}
                strokeColor={accentColor}
                containerStyle={local.canvasFill}
                strokeWidth={10}
              />
            </View>
          </View>

          <View style={phonicsStyles.modalControls}>
            <TouchableOpacity
              onPress={clearExpandedCanvas}
              style={[phonicsStyles.modalButton, phonicsStyles.clearButton]}
              activeOpacity={0.85}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={phonicsStyles.modalButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExpandedIndex(null)}
              style={[phonicsStyles.modalButton, { backgroundColor: accentColor }]}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={phonicsStyles.modalButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </BaseScreen>
  );
}

const local = StyleSheet.create({
  videoSquare: {
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F3E08A',
    overflow: 'hidden',
    backgroundColor: '#fff',
    alignSelf: 'center',
  },
  oneVideoWrap: { alignItems: 'center', marginTop: 8 },
  multiVideosWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: VIDEO_GAP,
    justifyContent: 'center',
  },

  canvasBox: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'stretch',
    aspectRatio: 1,
  },
  tileCanvasBox: {
    width: '100%',
    aspectRatio: 1,
    minWidth: 160,
    maxWidth: 260,
    alignSelf: 'stretch',
  },
  canvasFill: { width: '100%', height: '100%' },
  traceColumn: {
    gap: 12,
    justifyContent: 'flex-start',
  },
  traceTile: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
  },

  expandedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  expandedSquare: {
    width: '92%',
    maxWidth: 720,
    aspectRatio: 1,
  },
});