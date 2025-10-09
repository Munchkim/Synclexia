import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { supabase } from '../../../../../src/lib/supabaseClient';
import { styles } from '../../../../features/phonics/ui/PhonicsStyles';
import { PhonicsLesson, safeJsonObject, upper, playTextOrFile } from '../../../../features/phonics/data/phonics';

type Params = { phoneme: string };
type R = RouteProp<{ AlternativesLesson: Params }, 'AlternativesLesson'>;

const ALT_SETS: Record<string, string[]> = {
  AI: ['ai','ay','a_e'],
  UE: ['u_e','ew','ue'],
  OA: ['o_e','oa','ow'],
  OI: ['oi','oy'],
  IE: ['i_e','igh','ie'],
  OR: ['or','al','aw','au'],
  S:  ['cy','ci','ce'],
  OU: ['ou','ow'],
  J:  ['ge','j','gy','gi'],
  EE: ['y','ea','e_e','ee'],
  ER: ['ir','er','ur'],
  F:  ['ph','f'],
};

const ALT_DEFAULT_WORDS: Record<string, Record<string, string[]>> = {
  AI: {
    ai: ['AID','SAINT','AIM','BAIT','FAIL','FAINT','LAID','MAID','MAIN','PAIN','PAID','PLAIN','RAIL','STRAIN','BRAIN','DRAIN','MAIL','NAIL','PAINT','RAIN','SAIL','SNAIL','TAIL','TRAIN'],
    ay: ['BIRTHDAY','DAY','HAY','LAY','PAY','MAY','SAY','WAY','PLAY','TRAY','CLAY','STAY','PRAY','SPRAY'],
    a_e: ['ATE','APE','GAME','LANE','GATE','SAVE','GAVE','MADE','NAME','CAKE','HATE','SAFE','RAKE','TALE','WAVE','CAME'],
  },
  UE: {
    u_e: ['MULE','CUBE','TUNE','TUBE','CUTE','COSTUME','USE'],
    ew:  ['FEW','NEW','DEW','STEW','BLEW','GREW','CHEW','DREW','FLEW','VIEW','THREW','SCREW'],
    ue:  ['CONTINUE','DUE','VALUE','FUEL','RESCUE','STATUE','TISSUE'],
  },
  OA: {
    o_e: ['BONE','HOME','ROPE','HOPE','JOKE','MOLE','HOLE','POLE','WOKE','NOTE','DOZE','POKE','STONE','STOLE','DROVE','SMOKE','SLOPE'],
    oa:  ['UNLOAD','BOAST','COAL','CROAK','FOAM','GROAN','LOAD','MOAN','ROAST','SOAK','BOAT','COAT','FLOAT','GOAL','GOAT','LOAF','OAK','OATS','ROAD','SOAP','TOAD','TOAST'],
    ow:  ['LOW','OWN','MOW','SLOW','SNOW','BLOW','SHOW','GROW','THROW','WINDOW','YELLOW','BORROW','PILLOW','SHADOW'],
  },
  OI: {
    oi: ['OIL','BOIL','COIL','COIN','FOIL','VOID','SOIL','TOIL','JOIN','JOINT','MOIST','AVOID','POINT','SPOIL','OILCAN','TOILET','POISON','BOILING','TINFOIL','OINTMENT','SPOILSPORT'],
    oy: ['BOY','TOY','JOY','EMPLOY','DESTROY','ENJOY','ANNOY','LOYAL','OYSTER','ROYAL'],
  },
  IE: {
    i_e: ['RIDE','HIDE','NINE','RIPE','LIFE','FIVE','LINE','PIPE','MILE','PILE','TIME','SIDE','WIPE','LIKE','BIKE','BITE','HIVE','KITE'],
    igh: ['HIGH','NIGHT','LIGHT','RIGHT','SIGHT','BRIGHT','FIGHT','TIGHT'],
    ie:  ['DIED','LIES','CRIES','TRIES','FLIES','DRIES','DRIED','FRIED','LIE','LIED','SPIED','TRIED','CRIED','DIE','MAGPIE','PIE','TIE'],
  },
  OR: {
    or: ['OR','SNORT','BORN','FOR','FORM','LORD','SORT','SPORT','CORN','FORK','POPCORN','STORM'],
    al: ['ALL','HALL','FALL','BALL','WALL','CALL','TALL','TALK','WALK','CHALK','SMALL'],
    aw: ['SAW','PAW','JAW','THAW','LAWN','DRAW','STRAW','PRAWN','CRAWL','YAWN','CLAW'],
    au: ['FAULT','HAUNT','HAUNTED','CAUSE','PAUSE'],
  },
  S: {
    cy: ['CYCLE','BOUNCY','FANCY','MERCY'],
    ci: ['CITY','PENCIL','CIRCUS','CIRCLE','CITIZEN','ACID','CINDER','STENCIL'],
    ce: ['MICE','RICE','NICE','FACE','ACE','LACE','CELL','SPACE','PRINCESS','CANCEL','CENT','TWICE','RECENT','SINCE'],
  },
  OU: {
    ou: ['ABOUT','AROUND','FOUND','GROUND','LOUD','NOUN','OUT','ROUND','SOUND','CLOUD','COUNT','MOUTH','SHOUT','SOUTH'],
    ow: ['OWL','HOW','NOW','DOWN','TOWN','COW','HOWL','BROWN','DROWN','CROWN','CLOWN'],
  },
  J: {
    ge: ['GEN','GERM','CAGE','PAGE','STAGE','LEGEND','AGE','GENT'],
    j:  ['OBJECT','JAIL','JIG','JOG','JOB','JUG','JOT','JUST','JAB','JACKET','JAM','JET','JUNK','JUMP'],
    gy: ['GYM','ENERGY','GYMNASTICS','ALLERGY'],
    gi: ['MARGIN','GINGER','MAGIC','GIANT','GIRAFFE','ENGINE','IMAGINE','DIGIT','RIGID'],
  },
  EE: {
    y:   ['MUMMY','SUNNY','FLOPPY','BODY','BUDDY','BUGGY','GRANNY','SPOTTY','STORY','DIZZY','UGLY','FAMILY','VERY','GREEDY','HAPPY','GRUBBY','GRUMPY'],
    ea:  ['EAT','TEA','SEA','PEA','MEAT','READ','EACH','BEAT','HEAP','LEAF','BEAK','HEAT','MEAN'],
    e_e: ['THEME','EVEN','THESE','EVE','METER'],
    ee:  ['BEEN','BEEF','DEEP','FEED','FEEL','KEEN','HEEL','SCREEN','BEEP','FREE','GREED','INDEED','KEEP','MEET','NEED','SEE','SEEM','SEEN','SPEED','BEE','BLEED','COFFEE','EEL','FEET','GREEN','PEEL','SEED','SLEEP','TREE'],
  },
  ER: {
    ir: ['BIRD','GIRL','DIRT','STIR','FIRM','FIRST','SHIRT','THIRD','SKIRT','THIRTEEN','THIRSTY','DIRTY'],
    er: ['HERB','LONGER','COOKER','ADVERB','DEEPER','HER','JUMPER','VERB','CORNER','DINNER','DUSTER','LADDER','PAINTER','RUNNER','SINGER','SILVER','SUMMER','UNDER','WINTER'],
    ur: ['TURN','BURN','FUR','HURT','CURL','BURNT','BURST','CHURCH','BURGER'],
  },
  F: {
    ph: ['DOLPHIN','PHONE','NEPHEW','PHONICS','ALPHABET','ELEPHANT','ORPHAN','PHOTO','SPHERE'],
    f:  ['FAT','FED','FIT','FLAT','FUN','IF','FAN','FIN','FIG','FLAG'],
  },
};

const dedupeUpper = (arr: string[]) =>
  Array.from(new Set((arr || []).map(s => (s || '').toUpperCase().trim()).filter(Boolean)));

export default function AlternativesLesson() {
  const route = useRoute<R>();
  const { phoneme } = route.params;
  const { accentColor, fontFamily } = useAppSettings();

  const [lesson, setLesson] = useState<PhonicsLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAlt, setActiveAlt] = useState<string>('');
  const currentSoundRef = useRef(null as any);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('phonics_lessons')
          .select('*')
          .eq('phoneme', phoneme)
          .maybeSingle();

        if (error) throw error;

        const parsed: PhonicsLesson = {
          ...(data || { id: 'alt_dummy', label: `Alternatives: ${upper(phoneme)}`, phoneme, audio_url: null, examples: [] }),
          alternatives: safeJsonObject<Record<string, string[]>>(data?.alternatives, {}) || {},
        };
        if (live) setLesson(parsed);
      } catch (e) {
        console.warn('Alt fetch warning', e);
        setLesson({ id: 'alt_dummy', label: `Alternatives: ${upper(phoneme)}`, phoneme, audio_url: null, examples: [], alternatives: {} });
      } finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [phoneme]);

  const altBase = upper(lesson?.phoneme || '');
  const altVariants = ALT_SETS[altBase] || [];
  useEffect(() => { setActiveAlt(altVariants[0] || ''); }, [altBase]);

  const mergedAltData: Record<string, string[]> = useMemo(() => {
    if (!lesson) return {};
    const fromDb = lesson.alternatives || {};
    const defaults = ALT_DEFAULT_WORDS[altBase] || {};
    const out: Record<string, string[]> = {};
    for (const v of altVariants) {
      const dbWords = dedupeUpper(fromDb[v] || []);
      const defWords = dedupeUpper(defaults[v] || []);
      out[v] = dedupeUpper([...dbWords, ...defWords]).slice(0, 60); 
    }
    return out;
  }, [lesson?.alternatives, altBase]);

  if (loading) {
    return (
      <BaseScreen title="Loading Alternatives...">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#999" />
          <Text style={[styles.loadingText, { fontFamily, color: '#999' }]}>Loading {phoneme}...</Text>
        </View>
      </BaseScreen>
    );
  }
  if (!lesson) {
    return (
      <BaseScreen title="Alternatives">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No data for "{phoneme}"</Text>
        </View>
      </BaseScreen>
    );
  }

  const altBg = '#f3f6ff';

  return (
    <BaseScreen title="Alternatives">
      <ScrollView contentContainerStyle={styles.container}>

        <View style={[styles.altSection, { backgroundColor: altBg }]}>
          <Text style={[styles.altBigPhoneme, { fontFamily, color: accentColor }]}>{altBase.toLowerCase()}</Text>

          <View style={styles.altChipsRow}>
            {altVariants.map(v => {
              const active = v === activeAlt;
              return (
                <TouchableOpacity
                  key={v}
                  onPress={() => setActiveAlt(v)}
                  style={[
                    styles.altChip,
                    { backgroundColor: active ? accentColor : '#fff', borderColor: active ? accentColor : '#e5e7eb', borderWidth: active ? 0 : 2 },
                  ]}
                >
                  <Text style={[styles.altChipText, { fontFamily, color: active ? '#fff' : '#333' }]}>{v}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {(mergedAltData[activeAlt] || []).map((w, i) => (
            <TouchableOpacity
              key={`${activeAlt}-${w}-${i}`}
              onPress={() => playTextOrFile({ text: w, currentSoundRef })}
              activeOpacity={0.9}
              style={styles.altWordCard}
            >
              <Text style={[styles.altWordText, { fontFamily, color: '#333' }]}>{w.toLowerCase()}</Text>
              <View style={styles.altDotsRow}>
                {Array.from({ length: Math.min(6, Math.max(2, w.replace(/[^a-z]/gi,'').length)) }).map((_, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: accentColor, opacity: 0.8 }]} />
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </BaseScreen>
  );
}
