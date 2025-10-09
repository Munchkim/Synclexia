
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

export type Example = { label: string; image_url: string };

export type PhonicsLesson = {
  id: string;
  label: string;
  phoneme: string;
  video_url?: string | null;
  video_urls?: string[] | null;
  audio_url: string | null;
  examples: Example[];
  blending?: string[] | null;
  alternatives?: Record<string, string[]> | null;
  group_name?: string | null;
  order_index?: number | null;
  tracing_urls?: string[] | null;  
};

export const PHONEME_ORDER = [
  'S','A','T','I','P','N',
  'CK','E','H','R','M','D',
  'G','O','U','L','F','B',
  'AI','J','OA','IE','EE','OR',
  'Z','W','NG','V','OO (SHORT)','OO (LONG)',
  'Y','X','CH','SH','TH (VOICED)','TH (SILENT)',
  'QU','OU','OI','UE','ER','AR',
];

export const ALIASES: Record<string, string[]> = {
  'OO SHORT': ['OO (SHORT)'], 'OO LONG': ['OO (LONG)'],
  'OOS': ['OO (SHORT)'], 'OOL': ['OO (LONG)'],
  'THS': ['TH (SILENT)','TH VOICELESS'],
  'THV': ['TH (VOICED)','TH FATHER'],
  'TH (TOOTH)': ['TH (SILENT)'],
  'TH (FATHER)': ['TH (VOICED)'],
};

export const upper = (s: string) => (s || '').toUpperCase();

export function safeJsonArray<T=any>(v: any, fb: T[] = []): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return fb;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === 'null' || s === 'undefined') return fb;
    if (s.startsWith('[')) { try { const p = JSON.parse(s); return Array.isArray(p) ? p as T[] : fb; } catch { return fb; } }
    if (s.includes(',')) return s.split(',').map(t=>t.trim()).filter(Boolean) as unknown as T[];
    return fb;
  }
  return fb;
}
export function safeJsonObject<T=any>(v: any, fb: T): T {
  if (!v) return fb;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return (typeof p === 'object' && p) ? p as T : fb; } catch { return fb; } }
  return fb;
}

export function getRecentPhonemes(current: string, count=6) {
  const p = upper(current);
  const i = PHONEME_ORDER.indexOf(p);
  const idx = i !== -1 ? i
    : PHONEME_ORDER.indexOf(Object.keys(ALIASES).find(k => ALIASES[k].includes(p)) || p);
  if (idx === -1) return [];
  return PHONEME_ORDER.slice(Math.max(0, idx - count), idx);
}

export function getMainLetter(phoneme: string): string {
  const p = upper(phoneme).trim();
  const special: Record<string,string> = {
    'OO LONG':'O','OO SHORT':'O','OOS':'O','OOL':'O',
    'TH VOICED':'T','TH SILENT':'T','THV':'T','THS':'T',
     SH:'S', CH:'C', NG:'N', QU:'Q', CK:'C',
     AI:'A', OA:'O', IE:'I', EE:'E', OR:'O', OU:'O', OI:'O', UE:'U', ER:'E', AR:'A',
  } as any;
  return special[p] || p[0];
}

export const TRICKY_WORDS: Record<number, string[]> = {
  1:['I','THE','HE','SHE','ME','WE','BE','WAS','TO','DO','ARE','ALL'],
  2:['YOU','YOUR','COME','SOME','SAID','HERE','THERE','THEY','GO','NO','SO','MY'],
  3:['ONE','BY','ONLY','OLD','LIKE','HAVE','LIVE','GIVE','LITTLE','DOWN','WHAT','WHEN'],
  4:['WHY','WHERE','WHO','WHICH','ANY','MANY','MORE','BEFORE','OTHER','WERE','BECAUSE','WANT'],
  5:['SAW','PUT','COULD','SHOULD','WOULD','RIGHT','TWO','FOUR','GOES','DOES','MADE','THEIR'],
  6:['ONCE','UPON','ALSO','OF','EIGHT','LOVE','COVER','AFTER','EVERY','FATHER','ALWAYS','MOTHER'],
};

export async function playTextOrFile({
  text,
  audioUrl,
  currentSoundRef,
}: {
  text: string;
  audioUrl?: string | null;
  currentSoundRef: React.MutableRefObject<Audio.Sound | null>;
}) {
  try {
    if (currentSoundRef.current) {
      await currentSoundRef.current.stopAsync();
      await currentSoundRef.current.unloadAsync();
      currentSoundRef.current = null;
    }
    Speech.stop();

    if (audioUrl) {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
      currentSoundRef.current = sound;
      await sound.playAsync();
    } else {
      Speech.speak(text, { rate: 0.8, pitch: 1.0, language: 'en-US' });
    }
  } catch {
    Speech.speak(text, { rate: 0.8, pitch: 1.0, language: 'en-US' });
  }
}
