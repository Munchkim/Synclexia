import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, Modal, Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av'; 
import * as Speech from 'expo-speech';
import { useRoute, RouteProp } from '@react-navigation/native';
import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { RootStackParamList } from '../../../../../types';
import { supabase } from '../../../../../src/lib/supabaseClient';
import TracingCanvas, { TracingCanvasRef } from '../../../../components/TracingCanvas';
import { letterStrokes } from '../../../phonics/tracing/letterStrokes';


type LessonRouteProp = RouteProp<RootStackParamList, 'PhonicsLessonScreen'> & {
    params: {
        phoneme: string;
        mode?: 'phonics' | 'alternative' | 'tricky'; 
    }
};

type Example = { label: string; image_url: string };

type PhonicsLesson = {
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
};

const PHONEME_ORDER = [
  'S', 'A', 'T', 'I', 'P', 'N',
  'CK', 'E', 'H', 'R', 'M', 'D',
  'G', 'O', 'U', 'L', 'F', 'B',
  'AI', 'J', 'OA', 'IE', 'EE', 'OR',
  'Z', 'W', 'NG', 'V', 'OO (SHORT)', 'OO (LONG)',
  'Y', 'X', 'CH', 'SH', 'TH (VOICED)', 'TH (SILENT)',
  'QU', 'OU', 'OI', 'UE', 'ER', 'AR',
];

const MULTI = ['CK','CH','SH','TH','NG','AI','OA','IE','EE','OR','OO','OU','OI','UE','ER','AR','QU','TH (VOICED)','TH (SILENT)','OO (SHORT)','OO (LONG)'];

const ALIASES: Record<string,string[]> = {
  'OO SHORT': ['OO (SHORT)'], 'OO LONG': ['OO (LONG)'], 'OOS': ['OO (SHORT)'], 'OOL': ['OO (LONG)'],
  'THS': ['TH (SILENT)','TH VOICELESS'], 'THV': ['TH (VOICED)','TH FATHER'],
  'TH (TOOTH)': ['TH (SILENT)'], 'TH (FATHER)': ['TH (VOICED)'],
};

const upper = (s: string) => (s || '').toUpperCase();

const hex = (c: string) => c.replace('#','');
function lighten(hexColor: string, amt = 0.85) {
  const h = hex(hexColor);
  const n = h.length === 3 ? h.split('').map(ch=>ch+ch).join('') : h;
  const r = parseInt(n.slice(0,2),16), g = parseInt(n.slice(2,4),16), b = parseInt(n.slice(4,6),16);
  const lr = Math.round(r + (255 - r)*amt);
  const lg = Math.round(g + (255 - g)*amt);
  const lb = Math.round(b + (255 - b)*amt);
  const toHex = (v:number)=>v.toString(16).padStart(2,'0');
  return `#${toHex(lr)}${toHex(lg)}${toHex(lb)}`;
}

function getMainLetter(phoneme: string): string {
  const p = upper(phoneme).trim();
  const special: Record<string,string> = {
    'OO LONG':'O','OO SHORT':'O','OOS':'O','OOL':'O',
    'TH VOICED':'T','TH SILENT':'T','THV':'T','THS':'T',
    SH:'S',CH:'C',NG:'N',QU:'Q',CK:'C',
    AI:'A',OA:'O',IE:'I',EE:'E',OR:'O',OU:'O',OI:'O',UE:'U',ER:'E',AR:'A',
  };
  return special[p] || p[0];
}

function safeJsonArray<T=any>(v: any, fb: T[] = []): T[] {
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
function safeJsonObject<T=any>(v: any, fb: T): T {
  if (!v) return fb;
  if (typeof v === 'object') return v as T;
  if (typeof v === 'string') { try { const p = JSON.parse(v); return (typeof p === 'object' && p) ? p as T : fb; } catch { return fb; } }
  return fb;
}

const getRecentPhonemes = (current: string, count=6) => {
  const p = upper(current);
  const i = PHONEME_ORDER.indexOf(p);
  const primaryIndex = i === -1 
    ? PHONEME_ORDER.indexOf(Object.keys(ALIASES).find(key => ALIASES[key].includes(p)) || p)
    : i;

  if (primaryIndex === -1) return [];
  return PHONEME_ORDER.slice(Math.max(0, primaryIndex - count), primaryIndex);
};

const ALT_SETS: Record<string, string[]> = {
  AI: ['ai','ay','a_e'],
  UE: ['u_e','ew','ue'],
  OA: ['o_e','oa','ow'],
  OI: ['oi','oy'],
  IE: ['i_e','igh','ie'],
  OR: ['or','al','aw','au'],
  S:  ['cy','ci','ce'],
  OU: ['ou','ow'],
  J:  ['ge','j','gy','gi'],
  EE: ['y','ea','e_e','ee'],
  ER: ['ir','er','ur'],
  F:  ['ph','f'],
};

const ALT_DEFAULT_WORDS: Record<string, Record<string, string[]>> = {
  AI: {
    ai: ['AID','AIM','BAIT','FAIL','PAIN','PAIL','SAIL','MAIL','GAIN','RAIL','RAIN','LAID','HAIL','TAIL','NAIL','MAID','PAID','MAIN','BRAIN','TRAIN','STAIN','SAINT','PLAIN','PAINT'],
    ay: ['BIRTHDAY','DAY','HAY','LAY','PAY','MAY','SAY','WAY','PLAY','TRAY','CLAY','STAY','PRAY','SPRAY'],
    a_e: ['ATE','APE','GAME','LANE','GATE','SAVE','GAVE','MADE','NAME','CAKE','HATE','SAFE','RAKE','TALE','WAVE','CAME'],
  },
  UE: {
    u_e: ['MULE','CUBE','TUNE','TUBE','CUTE','COSTUME','USE'],
    ew:  ['FEW','NEW','DEW','STEW','BLEW','GREW','CHEW','DREW','FLEW','VIEW','THREW','SCREW'],
    ue:  ['CONTINUE','DUE','VALUE','FUEL','RESCUE','STATUE','TISSUE'],
  },
  OA: {
    o_e: ['BONE','HOME','ROPE','HOPE','JOKE','MOLE','HOLE','POLE','WOKE','NOTE','DOZE','POKE','STONE','STOLE','DROVE','SMOKE','SLOPE'],
    oa:  ['UNLOAD','BOAST','COAL','CROAK','FOAM','GROAN','LOAD','MOAN','ROAST','SOAK','BOAT','COAT','FLOAT','GOAL','GOAT','LOAF','OAK','OATS','ROAD','SOAP','TOAD','TOAST'],
    ow:  ['LOW','OWN','MOW','SLOW','SNOW','BLOW','SHOW','GROW','THROW','WINDOW','YELLOW','BORROW','PILLOW','SHADOW'],
  },
  OI: {
    oi: ['OIL','BOIL','COIL','COIN','FOIL','VOID','SOIL','TOIL','JOIN','JOINT','MOIST','AVOID','POINT','SPOIL','OILCAN','TOILET','POISON','BOILING','TINFOIL','OINTMENT','SPOILSPORT'], 
    oy: ['BOY','TOY','JOY','EMPLOY','DESTROY','ENJOY','ANNOY','LOYAL','OYSTER','ROYAL'],
  },
  IE: {
    i_e: ['RIDE','HIDE','NINE','RIPE','LIFE','FIVE','LINE','PIPE','MILE','PILE','TIME','SIDE','WIPE','LIKE','BIKE','BITE','HIVE','KITE'],
    igh: ['HIGH','NIGHT','LIGHT','RIGHT','SIGHT','BRIGHT','FIGHT','TIGHT'],
    ie:  ['DIED','LIES','CRIES','TRIES','FLIES','DRIES','DRIED','FRIED','LIE','LIED','SPIED','TRIED','CRIED','DIE','MAGPIE','PIE','TIE'],
  },
  OR: {
    or: ['OR','SNORT','BORN','FOR','FORM','LORD','SORT','SPORT','CORN','FORK','POPCORN','STORM'],
    al: ['ALL','HALL','FALL','BALL','WALL','CALL','TALL','TALK','WALK','CHALK','SMALL'],
    aw: ['SAW','PAW','JAW','THAW','LAWN','DRAW','STRAW','PRAWN','CRAWL','YAWN','CLAW'],
    au: ['FAULT','HAUNT','HAUNTED','CAUSE','PAUSE'],
  },
  S:  {
    cy: ['CYCLE','BOUNCY','FANCY','MERCY'],
    ci: ['CITY','PENCIL','CIRCUS','CIRCLE','CITIZEN','ACID','CINDER','STENCIL'],
    ce: ['MICE','RICE','NICE','FACE','ACE','LACE','CELL','SPACE','PRINCESS','CANCEL','CENT','TWICE','RECENT','SINCE'],
  },
  OU: {
    ou: ['ABOUT','AROUND','FOUND','GROUND','LOUD','NOUN','OUT','ROUND','SOUND','CLOUD','COUNT','MOUTH','SHOUT','SOUTH'],
    ow: ['OWL','HOW','NOW','DOWN','TOWN','COW','HOWL','BROWN','DROWN','CROWN','CLOWN'],
  },
  J:  {
    ge: ['GEN','GERM','CAGE','PAGE','STAGE','LEGEND','AGE','GENT'],
    j:  ['OBJECT','JAIL','JIG','JOG','JOB','JUG','JOT','JUST','JAB','JACKET','JAM','JET','JUNK','JUMP'],
    gy: ['GYM','ENERGY','GYMNASTICS','ALLERGY'],
    gi: ['GIANT','GIRAFFE','GINGER','MAGIC','ENGINE','IMAGINE','DIGIT','RIGID'],
  },
  EE: {
    y:   ['MUMMY','SUNNY','FLOPPY','BODY','BUDDY','BUGGY','GRANNY','SPOTTY','STORY','DIZZY','UGLY','FAMILY','VERY','GREEDY','HAPPY','GRUBBY','GRUMPY'],
    ea:  ['EAT','TEA','SEA','PEA','MEAT','READ','EACH','BEAT','HEAP','LEAF','BEAK','HEAT','MEAN'],
    e_e: ['THEME','EVEN','THESE','EVE','METER'],
    ee:  ['BEEN','BEEF','DEEP','FEED','FEEL','KEEN','HEEL','SCREEN','BEEP','FREE','GREED','INDEED','KEEP','MEET','NEED','SEE','SEEM','SEEN','SPEED','BEE','BLEED','COFFEE','EEL','FEET','GREEN','PEEL','SEED','SLEEP','TREE'],
  },
  ER: {
    ir: ['BIRD','GIRL','DIRT','STIR','FIRM','FIRST','SHIRT','THIRD','SKIRT','THIRTEEN','THIRSTY','DIRTY'],
    er: ['HERB','LONGER','COOKER','ADVERB','DEEPER','HER','JUMPER','VERB','CORNER','DINNER','DUSTER','LADDER','PAINTER','RUNNER','SINGER','SILVER','SUMMER','UNDER','WINTER'],
    ur: ['TURN','BURN','FUR','HURT','CURL','BURNT','BURST','CHURCH','BURGER'],
  },
  F:  {
    ph: ['DOLPHIN','PHONE','NEPHEW','PHONICS','ALPHABET','ELEPHANT','ORPHAN','PHOTO','SPHERE'],
    f:  ['FAT','FED','FIT','FLAT','FUN','IF','FAN','FIN','FIG','FLAG'],
  },
};

const isAlternativeBase = (p: string) => !!ALT_SETS[upper(p)];

function simpleStem(w: string) {
  let s = w.toLowerCase();
  if (s.endsWith('ies')) s = s.slice(0,-3)+'y';
  else if (s.endsWith('es')) s = s.slice(0,-2);
  else if (s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0,-1);
  if (s.endsWith('ing') && s.length > 4) s = s.slice(0,-3);
  if (s.endsWith('ed') && s.length > 3) s = s.slice(0,-2);
  return s;
}
function dedupeMorph(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of arr) {
    const stem = simpleStem(String(w));
    if (!seen.has(stem)) { seen.add(stem); out.push(String(w)); }
  }
  return out;
}

const EXTENSIVE_WORD_BANK: Record<string, string[]> = {
  S: [], A: [], T: ['AT', 'SAT'],
  I: ['IT', 'IS', 'ITS', 'SIT', 'SITS'],
  P: ['PIT', 'PAT', 'TIP', 'TAP', 'SAP', 'SIP', 'PIP', 'TAPS', 'SPIT', 'PIPS', 'PATS', 'SPAT', 'TIPS', 'SIPS', 'SPITS'],
  N: ['AN', 'IN', 'TIN', 'NIP', 'NIT', 'TAN', 'PIN', 'ANT', 'NAP', 'PAN', 'SPAN', 'SPIN', 'SNIP', 'SNAP', 'PANT', 'SPINS', 'PANTS', 'INSIST'],
  CK: ['CAT', 'CAN', 'CAP', 'KIN', 'SACK', 'PACK', 'SICK', 'PICK', 'TICK', 'SNACK', 'STICK', 'STACK', 'PICKS'],
  E: ['SET', 'TEN', 'PEN', 'NET', 'PECK', 'NECK', 'PET', 'SPECK', 'NEST', 'STEP', 'TENT', 'KEPT', 'SENT', 'PEST', 'TEST', 'TENNIS', 'SPENT', 'INSECT'],
  H: ['HAT', 'HIT', 'HIP', 'HAD', 'HEN', 'HAS', 'HISS', 'HIS', 'HINT', 'HAPPEN', 'HECTIC'],
  R: ['RAT', 'RAN', 'RIP', 'REST', 'RACK', 'RAP', 'CRESS', 'TRIP', 'PRESS', 'RENT', 'RISK', 'CRACK', 'TRICK', 'TRAP', 'PRICK', 'TRACK', 'SCRAP', 'CRISP', 'STRIP', 'STRESS', 'RACKET', 'STRAP', 'PRINT', 'CREPT', 'CREST', 'STRICT', 'CRICKET', 'SPRINT'],
  M: ['MAN', 'MAT', 'MAP', 'MEN', 'AM', 'IMP', 'MESS', 'RIM', 'MISS', 'HEM', 'RAM', 'HIM', 'MET', 'MASS', 'STEM', 'CAMP', 'MINT', 'MIST', 'TRAM', 'TRIM', 'RAMP', 'SMACK', 'TRAMP', 'STAMP', 'MATTRESS'],
  D: ['DAD', 'DID', 'HID', 'KID', 'MID', 'HAD', 'MAD', 'DIP', 'DIM', 'END', 'DIN', 'RED', 'DAMP', 'PAD', 'DEN', 'SAD', 'DECK', 'RID', 'AND', 'SEND', 'DISK', 'DESK', 'SAND', 'MEND', 'HAND', 'DENT', 'DRIP', 'DRESS', 'SKID', 'SPEND', 'STAND', 'DENTIST'],
  G: ['GET', 'GAP', 'PEG', 'DIG', 'SAG', 'TAG', 'RIG', 'RAG', 'GAS', 'NAG', 'GRAM', 'GRIM', 'GETS', 'SNAG', 'GRIP', 'DRAG', 'DIGS', 'GRID', 'STAG', 'DRAGS', 'GRAND', 'MAGNET', 'GYMNAST'],
  O: ['ON', 'ODD', 'OFF', 'HOP', 'POD', 'POP', 'POT', 'ROCK', 'COG', 'NOD', 'DOG', 'ROT', 'MOSS', 'MOP', 'ROD', 'HOT', 'GOT', 'DOT', 'DOCK', 'SOCK', 'COD', 'COT', 'TOP', 'NOT', 'MOCK', 'COST', 'STOP', 'TROD', 'TROT', 'CROSS', 'DROP', 'POND', 'MOPS', 'HOPS', 'SPOT', 'POTS', 'STOPS', 'COTTON', 'CANNOT', 'POCKET', 'SPOTS', 'ROCKET', 'COMIS', 'ACROSS', 'TOPIC'],
  U: ['UP', 'US', 'SUN', 'RUN', 'NUN', 'CUT', 'GUM', 'RUG', 'CUP', 'SUCK', 'RUT', 'PUP', 'DUCK', 'SUM', 'HUT', 'HUM', 'TUCK', 'HUG', 'NUT', 'MUCK', 'DUG', 'MUG', 'PUN', 'TUG', 'MUD', 'HUGS', 'SNUG', 'GUST', 'NUTS', 'DUMP', 'MUST', 'RUNS', 'DUSK', 'HUMP', 'TUSK', 'PUMP', 'DRUM', 'STUCK', 'TRUCK', 'DUST', 'HUNT', 'RUST', 'DRUNK', 'CRUST', 'GRUNT', 'UNPACK', 'TRUST', 'SKINK', 'STUMP', 'PUPPET', 'TRUNK', 'HICCUP', 'SUNTAN', 'UNDRESS', 'TRUMPET', 'PUMPKIN'],
  L: ['LEG', 'LET', 'LIP', 'LOT', 'LAP', 'LIT', 'LUCK', 'LOSS', 'LAD', 'LESS', 'LASS', 'LOG', 'LICK', 'OLD', 'PAL', 'LOCK', 'LED', 'LID', 'TILT', 'PLUG', 'LEGS', 'SULK', 'CLOCK', 'LAND', 'CLAP', 'CLOG', 'LOTS', 'SLAM', 'LENT', 'LIMP', 'LIPS', 'SLICK', 'LICKS', 'HELD', 'SLAP', 'MELT', 'LUMP', 'PLOT', 'GULP', 'HELP', 'GLUM', 'SLUG', 'SILK', 'CLIP', 'LAMP', 'PLUM', 'GLAD', 'SLIP', 'PLUS', 'LEND', 'CLUCK', 'LIST', 'SLIT', 'SLOT', 'MILK', 'SLIM', 'SLID', 'LOST', 'PLAN', 'CLICK', 'CAROL', 'SOLID', 'TUNNEL', 'SPLIT', 'LESSON', 'MELON', 'LEMON', 'SLEPT', 'CLAPS', 'LANDS', 'CALMP', 'PLUMP', 'UNLOCK', 'ADULT', 'UNTIL', 'CLUMP', 'HELPS', 'UNLESS', 'UNPLUG', 'ANIMAL', 'SPLATS', 'TINSEL', 'LIPSTICK', 'PLASTIC', 'ELASTIC', 'ELECTRIC', 'SPLENDID'],
  F: ['IF', 'FAT', 'FIT', 'FUN', 'FELL', 'FOG', 'FED', 'FIN', 'ELF', 'FILL', 'FIG', 'FUSS', 'FAN', 'FLAG', 'FUND', 'SOFT', 'TUFT', 'FROM', 'FELT', 'GOLF', 'FACT', 'FLAP', 'FRILL', 'FROG', 'LOFT', 'FLOCK', 'FLAT', 'LEFT', 'GIFT', 'SELF', 'FOND', 'FILM', 'FLOP', 'FIST', 'LIFT', 'FROST', 'FLAPS', 'FLOPS', 'FLICKS', 'LIFTS', 'FOSSIL', 'FOREST', 'INFANT', 'FANTASTIC'],
  B: ['BAG', 'BAD', 'BAT', 'BED', 'BUN', 'TUB', 'BOG', 'BUG', 'BILL', 'CAB', 'HOB', 'BAN', 'HUB', 'BIB', 'BUS', 'ROB', 'BUD', 'BIG', 'BOB', 'SOB', 'BET', 'BELL', 'BIN', 'BEG', 'RIB', 'BACK', 'CUB', 'BUT', 'RUB', 'BOSS', 'BIT', 'BELT', 'CRIB', 'BLOT', 'BLACK', 'GRUB', 'CLUB', 'BEND', 'BUNK', 'CRAB', 'BENT', 'BLOCK', 'BAND', 'BRICK', 'RUBS', 'BULB', 'BEST', 'SCAB', 'GRAB', 'BUMP', 'ROBIN', 'BOTTOM', 'BUTTON', 'BUCKET', 'BLINK', 'HABIT', 'BLOND', 'BLEND', 'GRABS', 'BLOSSOM', 'UMBRELLA', 'BLANKET', 'PROBLEM'],
  AI: ['AID', 'AIM', 'BAIT', 'FAIL', 'PAIN', 'PAIL', 'SAIL', 'MAIL', 'GAIN', 'RAIL', 'RAIN', 'LAID', 'HAIL', 'TAIL', 'NAIL', 'RAID', 'MAID', 'PAID', 'MAIN', 'BRAIN', 'TRAIN', 'STAIN', 'SAINT', 'CLAIM', 'SNAIL', 'FAINT', 'GRAIN', 'DRAIN', 'PLAIN', 'PAINT', 'TRAIL', 'AFRAID', 'STRAIN', 'SPRAIN', 'AGAINST', 'RAINDROPS'],
  J: ['JET', 'JOB', 'JAB', 'JUG', 'JAIL', 'JOT', 'JAM', 'JIG', 'JUST', 'JUMP', 'JUNK', 'JEST', 'JACKET', 'INJECT', 'OBJECT'],
  OA: ['OAK', 'OATS', 'BOAT', 'COAL', 'LOAF', 'COAT', 'GOAT', 'LOAD', 'SOAP', 'TOAD', 'FOAM', 'SOAK', 'FOAL', 'MOAT', 'ROAD', 'MOAN', 'GOAL', 'FLOAT', 'COAST', 'CLOAK', 'TOAST', 'ROAST', 'GROAN', 'BOAST', 'CROAK', 'UNLOAD', 'AFLOAT', 'RAINCOAT'],
  IE: ['TIE', 'DIE', 'LIE', 'PIE', 'DIED', 'LIES', 'LIED', 'TIED', 'FRIED', 'FLIES', 'CRIES', 'DRIED', 'SPIED', 'DRIES', 'TRIED', 'CRIED', 'UNTIE', 'TRIES', 'UNTIED', 'MAGPIE'],
  EE: ['EEL', 'SEE', 'BEE', 'BEEF', 'JEEP', 'SEEN', 'BEEP', 'NEED', 'PEEL', 'MEET', 'TREE', 'DEEP', 'KEEP', 'HEEL', 'REEF', 'BEEN', 'SEEK', 'SEED', 'SEEM', 'PEEP', 'FREE', 'FEED', 'LEEK', 'FEEL', 'FEET', 'KEEN', 'SPEED', 'STEEP', 'COFFEE', 'AGREE', 'SLEEP', 'BLEED', 'CREEP', 'GREED', 'SETTEE', 'GREEN', 'TOFFEE', 'STREET', 'SCREEN', 'INDEED', 'ASLEEP'],
  OR: ['OR', 'FOR', 'LORD', 'FORK', 'CORK', 'CORN', 'SORT', 'FORM', 'CORD', 'PORT', 'FORT', 'HORN', 'BORN', 'TORN', 'STORK', 'SPORT', 'SNORT', 'STORM', 'STORMY', 'FOGHORN', 'POPCORN'],
  Z: ['ZIP', 'BUZZ', 'JAZZ', 'ZIGZAG', 'ZAP', 'ZIT', 'ZEST'],
  W: ['WEB', 'WIG', 'WIN', 'SWIM', 'WET', 'WILL', 'WAIT', 'WELL', 'WEED', 'WAG', 'WORN', 'WAIL', 'WEEK', 'WENT', 'TWIG', 'WAIST', 'SWEEP', 'WINK', 'WEST', 'WIND', 'TWIN', 'SWEET', 'SWAM', 'SWEPT', 'UNWELL', 'TWINS', 'TWIST', 'WOMBAT', 'WEEKEND', 'COBWEB', 'BETWEEN', 'WIGWAM', 'WINDMILL', 'SWEETCORN'],
  NG: ['SANG', 'KING', 'LONG', 'LUNG', 'PING', 'HUNG', 'SING', 'BANG', 'SONG', 'WING', 'RANG', 'GANG', 'HANG', 'SUNG', 'RING', 'RUNG', 'CLING', 'FLING', 'ALONG', 'CLANG', 'BRING', 'STING', 'SLING', 'CLUNG', 'SWUNG', 'SWING', 'STUNG', 'SEEING', 'SNORING', 'MORNING', 'SOAKING', 'STRONG', 'BELONG', 'FEELING', 'WILLING', 'SINGING', 'WAGGING', 'WEEPING', 'WEDDING', 'STRING', 'SPRING', 'BUZZING', 'SITTING', 'PAINTING', 'PADDLING', 'TRICKING', 'CROSSING', 'FREEZING', 'DUCKLING', 'KINGDOM', 'STICKING', 'CRACKING', 'SPELLING', 'SLEEPING', 'CREEPING', 'DRIFTING'],
  V: ['VAN', 'VAT', 'VET', 'VENT', 'VAIN', 'EVEN', 'VEST', 'VISIT', 'VIVID', 'SEVEN', 'VELVET', 'INVENT', 'TRAVEL', 'VANILLA', 'DEVELOP', 'CARAVAN', 'SEVENTEEN'],
  'OO (SHORT)': ['LOOK', 'FOOT', 'SOOT', 'WOOL', 'COOK', 'BOOK', 'WOOD', 'HOOK', 'ROOK', 'GOOD', 'WOOF', 'HOOD', 'TOOK', 'BROOK', 'STOOD', 'LOOKING', 'COOKING', 'WOODLAND', 'SCRAPBOOK', 'FOOTSTEPS'],
  'OO (LONG)': ['TOO', 'ZOO', 'HOOP', 'MOON', 'BOO', 'MOO', 'POOL', 'ROOM', 'SOON', 'FOOL', 'COOL', 'ROOT', 'TOOL', 'MOOD', 'LOOP', 'ZOOM', 'NOON', 'HOOT', 'ROOF', 'BOOM', 'TOOT', 'HOOF', 'FOOD', 'BOOT', 'BLOOM', 'GLOOM', 'STOOP', 'STOOL', 'SPOOK', 'SPOON', 'BOOTS', 'SCOOP', 'BROOM', 'IGLOO', 'BEDROOM', 'TOADSTOOL', 'BROOMSTICK'],
  Y: ['YES', 'YELL', 'YELP', 'YET', 'YAP', 'YAM', 'YUCK', 'YAK', 'YANK'],
  X: ['FOX', 'BOX', 'SIX', 'TAX', 'FIX', 'FAX', 'MIX', 'WAX', 'SAX', 'EXIT', 'FLEX', 'NEXT', 'BOXING', 'FIXING', 'MIXING', 'EXPECT', 'SIXTEEN', 'TOOLBOX', 'MAILBOX', 'PAINTBOX'],
  CH: ['CHAT', 'CHEST', 'CHESS', 'CHECK', 'CHEEK', 'CHICK', 'CHAIN', 'SUCH', 'CHIN', 'TORCH', 'CHAP', 'CHIP', 'CHUM', 'CHOP', 'CHECK', 'RICH', 'MUCH', 'COACH', 'POACH', 'CHUG', 'CHILL', 'CHOPS', 'BUNCH', 'SPEECH', 'PINCH', 'PUNCH', 'HUNCH', 'CHAMP', 'CHIPS', 'CHUMP', 'FINCH', 'CHIMP', 'CHICKS', 'BENCH', 'LUNCH', 'MUNCH', 'SKETCH', 'CRUCH', 'CHICKEN', 'TRENNCH', 'DRENCH', 'OSTRITCH', 'LUNCHBOX', 'SANDWICH', 'CHILDREN', 'CHOPSTICKS', 'CHICKENPOX'],
  SH: ['FISH', 'WISH', 'DISH', 'SHOP', 'ASH', 'CASH', 'SHEET', 'SHOOK', 'SHALL', 'SHIN', 'SHED', 'DASHH', 'RUSH', 'BASH', 'SHEEP', 'HUSH', 'SHIP', 'SHUT', 'SHORT', 'SHOT', 'SHOCK', 'SHELL', 'RASH', 'SHOOT', 'MASH', 'BLUSH', 'SHIFT', 'BRUSH', 'FLEXH', 'FLASH', 'SHIPS', 'FRESH', 'SHELF', 'CRASH', 'FLUSH', 'SMASH', 'SHRUG', 'FISHING', 'EGGSHELL', 'SHAMPOO', 'SHRINK', 'FINISH', 'SHERIFF', 'SHRIMP', 'SHOCKING', 'SHOPPING', 'SPLASH', 'PUNISH', 'VANSIH', 'MUSHROOM', 'BLUSHING', 'BOOKSHOP', 'BOOKSHELF', 'PAINTBRUSH'],
  'TH (VOICED)': ['THAN', 'THEM', 'THIS', 'THAT', 'WITH', 'THEN', 'SMOOTH'],
  'TH (SILENT)': ['THIN', 'THANKS', 'THEFT', 'THING', 'THICK', 'THREE', 'MOTH', 'THORN', 'THUD', 'TOOTH', 'THROW', 'NORTH', 'TEETH', 'TENTH', 'SIXTH', 'FROTH', 'THUMP', 'THRUSH', 'THINK', 'THROB', 'THROAT', 'CLOTH', 'SEVENTH', 'THINKING', 'TOOTHBRUSH'],
  QU: ['QUIT', 'QUIZ', 'QUICK', 'LIQUID', 'QUACK', 'QUEEN', 'QUAIL', 'QUILL', 'QUILT', 'QUEST', 'QUENCH', 'SQUID', 'SQUINT', 'QUACKING', 'REQUEST', 'SQUIRREL', 'QUICKSAND'],
  OU: ['OUT', 'LOUD', 'NOUN', 'CLOUD', 'OUR', 'SOUTH', 'SOUR', 'COUCH', 'MOUTH', 'SHOUT', 'POUCH', 'FOUND', 'OUTING', 'FLOUR', 'ABOUT', 'ROUND', 'CROUCH', 'SCOUT', 'SOUND', 'HOUND', 'POUND', 'SPOUT', 'JOUST', 'TROUT', 'ALOUD', 'COUNT', 'SNOUT', 'PROUD', 'OUTFIT', 'WITHOUT', 'SHOUTING', 'GROUND', 'AROUND', 'ROUNDABOUT'],
  OI: ['OIL', 'BOIL', 'COIL', 'COIN', 'FOIL', 'VOID', 'SOIL', 'TOIL', 'JOIN', 'JOINT', 'MOIST', 'AVOID', 'POINT', 'SPOIL', 'OILCAN', 'TOILET', 'POISON', 'BOILING', 'TINFOIL', 'OINTMENT', 'SPOILSPORT'],
  UE: ['FUEL', 'DUE', 'VALUE', 'RESCUE', 'CUE', 'DUEL', 'ISSUE', 'TISSUE', 'STATUE', 'CONTINUE'],
  ER: ['HER', 'VERB', 'HERB', 'ADVERB', 'OFFER', 'EVER', 'HERD', 'PERCH', 'FERN', 'COOKER', 'SUFFER', 'SHATTER', 'PEPPER', 'SUPPER', 'HAMMER', 'DINNER', 'RIVER', 'MIXER', 'CORNER', 'SUMMER', 'RUNNER', 'BOTHER', 'SHIVER', 'HOTTER', 'DEEPER', 'LITTER', 'LETTER', 'BUTTER', 'WINNER', 'FATTER', 'BETTER', 'CHATTER', 'LADDER', 'SINGER', 'UNDER', 'NEVER', 'WAITER', 'MISTER', 'TODDLER', 'CLEVER', 'DUSTER', 'SWIMMER', 'SILVER', 'SCOOTER', 'LONGER', 'THUNDER', 'PAINTER', 'CRACKER', 'TEMPER', 'MERMAID', 'STICKER', 'SLITHER', 'SMOOTHER', 'SISTER', 'TOASTER', 'WINTER', 'NUMBER', 'JESTER', 'BUMPER', 'JUMPER', 'SLIPPER', 'TWEEZERS', 'MONSTER', 'BLISTER', 'SLIPPERS', 'SMUGGLER', 'BLENDER', 'PRINTER', 'PERFECT', 'HERSELF', 'CHATTERBOX', 'BUTTERCUP', 'SPRINTER', 'WOODPECKER', 'SPLINTER', 'UNDERSTAND', 'THUNDERSTORM', 'HELICOPTER'],
  AR: ['ARK', 'ART', 'BAR', 'CAR', 'JAR', 'FAR', 'ARM', 'ARCH', 'PARK', 'TART', 'DARK', 'MARCH', 'ARGUE', 'HARD', 'SHARP', 'SCAR', 'MARSH', 'DART', 'BARK', 'YARD', 'STAR', 'MARK', 'PART', 'HARP', 'CHART', 'CHARM', 'CART', 'CARD', 'BARN', 'HARM', 'FARM', 'SHARK', 'HARDER', 'START', 'SCARF', 'SPARK', 'FARMER', 'SMARTER', 'CARTOON', 'STARTS', 'GARLIC', 'CARPET', 'TARGET', 'STARFISH', 'DARKROOM', 'ARMBAND', 'STARLING', 'BARBECUE', 'FARMYARD', 'CATERPILLAR'],
};

const WORD_BANK = EXTENSIVE_WORD_BANK;

function computeBlends(currentPhoneme: string, dbWords: string[] | null): string[] {
  const cur = upper(currentPhoneme);
  
  if (cur === 'S' || cur === 'A') return [];
  if (cur === 'T') return ['AT','SAT'];

  const fromBank = (WORD_BANK[cur] || []).map(upper);
  const fromDB = (dbWords || []).map(w => upper(String(w)).trim()).filter(Boolean);
  const merged = Array.from(new Set([...fromDB, ...fromBank]));

  const filtered = merged.filter(w => w.includes(cur));
  
  return filtered.slice(0, 30); 
}

const TRICKY_WORDS: Record<number, string[]> = {
  1: ['I','THE','HE','SHE','ME','WE','BE','WAS','TO','DO','ARE','ALL'], 
  2: ['YOU','YOUR','COME','SOME','SAID','HERE','THERE','THEY','GO','NO','SO','MY'], 
  3: ['ONE','BY','ONLY','OLD','LIKE','HAVE','LIVE','GIVE','LITTLE','DOWN','WHAT','WHEN'], 
  4: ['WHY','WHERE','WHO','WHICH','ANY','MANY','MORE','BEFORE','OTHER','WERE','BECAUSE','WANT'], 
  5: ['SAW','PUT','COULD','SHOULD','WOULD','RIGHT','TWO','FOUR','GOES','DOES','MADE','THEIR'], 
  6: ['ONCE','UPON','ALSO','OF','EIGHT','LOVE','COVER','AFTER','EVERY','FATHER','ALWAYS','MOTHER'],
};

export default function PhonicsLessonScreen() {
  const { accentColor, fontSize, fontFamily } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const route = useRoute<LessonRouteProp>();
  const { phoneme, mode } = route.params; 

  const [lesson, setLesson] = useState<PhonicsLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [showExpandedCanvas, setShowExpandedCanvas] = useState(false);

  const videoRef = useRef<Video | null>(null);
  const canvasRef = useRef<TracingCanvasRef>(null);
  const expandedCanvasRef = useRef<TracingCanvasRef>(null);

  const isTargettingTrickyWords = mode === 'tricky' || upper(phoneme).includes('TRICKY WORD');
  const isTargettingAlternative = mode === 'alternative' || isAlternativeBase(phoneme);

  useEffect(() => () => { if (currentSound) currentSound.unloadAsync(); Speech.stop(); }, [currentSound]);

  const playAudio = async (text: string, isPhoneme = false) => {
    try {
      if (currentSound) { await currentSound.stopAsync(); await currentSound.unloadAsync(); setCurrentSound(null); }
      Speech.stop();
      if (isPhoneme && lesson?.audio_url) {
        const { sound } = await Audio.Sound.createAsync({ uri: lesson.audio_url });
        setCurrentSound(sound);
        await sound.playAsync();
      } else {
        Speech.speak(text, { rate: 0.8, pitch: 1.0, language: 'en-US' });
      }
    } catch {
      Speech.speak(text, { rate: 0.8, pitch: 1.0, language: 'en-US' });
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        
        if (isTargettingTrickyWords) {
            const groupMatch = phoneme.match(/\d/);
            const initialGroup = groupMatch ? parseInt(groupMatch[0]) : 1;
            const parsed: PhonicsLesson = {
              id: 'tricky_dummy', 
              label: `Tricky Words Group ${initialGroup}`, 
              phoneme: phoneme, 
              audio_url: null, examples: [], blending: [], alternatives: {},
              group_name: `TRICKY WORDS GROUP ${initialGroup}`,
            };
            if (live) setLesson(parsed);
            setLoading(false);
            return;
        }

        if (isTargettingAlternative) {
            const parsed: PhonicsLesson = {
              id: 'alt_dummy', 
              label: `Alternatives: ${upper(phoneme)}`, 
              phoneme: phoneme, 
              audio_url: null, examples: [], blending: [], alternatives: {},
              group_name: `ALTERNATIVES`,
            };
            if (live) setLesson(parsed);
            setLoading(false);
            return;
        }

        let { data, error } = await supabase
          .from('phonics_lessons')
          .select('*')
          .eq('phoneme', phoneme)
          .maybeSingle();

        if (!error && !data) {
          const tries = ALIASES[upper(phoneme)] || [];
          if (tries.length) {
            const q = await supabase
              .from('phonics_lessons')
              .select('*')
              .in('phoneme', tries)
              .order('order_index', { ascending: true })
              .limit(1);
            if (!q.error && q.data?.length) data = q.data[0];
          }
        }

        if (error) { console.error('Fetch error:', error); Alert.alert('Error', 'Failed to load lesson'); return; }
        if (!data) { Alert.alert('Not Found', `No lesson found for ${phoneme}`); return; }

        const parsed: PhonicsLesson = {
          ...data,
          examples: safeJsonArray<Example>(data.examples, []),
          blending: safeJsonArray<string>(data.blending, []),
          video_urls: safeJsonArray<string>(data.video_urls, undefined) || null,
          audio_url: data.audio_url ?? null,
          alternatives: safeJsonObject<Record<string,string[]>>(data.alternatives, {}) || {},
        };
        if (live) setLesson(parsed);
      } catch (e) {
        console.error('Parse error:', e);
        Alert.alert('Error', 'Failed to parse lesson data');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [phoneme, mode]); 

  const clearCanvas = () => canvasRef.current?.clear();
  const clearExpandedCanvas = () => expandedCanvasRef.current?.clear();

  const fullBlendPool = useMemo(
    () => computeBlends(lesson?.phoneme || '', lesson?.blending || []),
    [lesson?.phoneme, lesson?.blending]
  );

  const initialCount = useMemo(() => {
    const cur = upper(phoneme);
    if (cur === 'S' || cur === 'A') return 0;
    if (cur === 'T') return 2;
    return Math.min(3, fullBlendPool.length);
  }, [phoneme, fullBlendPool.length]);

  const MAX_SHOW = Math.min(15, fullBlendPool.length);

  const [visibleBlendCount, setVisibleBlendCount] = useState<number>(initialCount);
  useEffect(() => setVisibleBlendCount(initialCount), [initialCount]);

  const canShowMore = visibleBlendCount < MAX_SHOW;
  const isExpanded = visibleBlendCount >= MAX_SHOW && initialCount > 0;
  const visibleBlends = fullBlendPool.slice(0, visibleBlendCount);

  const isAltMode = isTargettingAlternative || isAlternativeBase(lesson?.phoneme || '');
  const altBase = upper(lesson?.phoneme || '');
  const altVariants = ALT_SETS[altBase] || [];
  const altWordsFromDB = lesson?.alternatives || {};
  const altDefault = ALT_DEFAULT_WORDS[altBase] || {};
  
  const altData: Record<string,string[]> = useMemo(() => {
    if (!isAltMode) return {};
    const out: Record<string,string[]> = {};
    for (const v of altVariants) {
      const fromDb = (altWordsFromDB?.[v] || []).map(upper);
      const fallback = (altDefault[v] || []).map(upper);
      
      const merged = Array.from(new Set([...fromDb, ...fallback]));
      out[v] = dedupeMorph(merged).slice(0, 30);
    }
    return out;
  }, [isAltMode, altBase, JSON.stringify(altWordsFromDB)]);

  const [activeAlt, setActiveAlt] = useState<string>(altVariants[0] || '');
  useEffect(() => { setActiveAlt(altVariants[0] || ''); }, [altBase]);

  const isTrickyMode = isTargettingTrickyWords;
  const trickyWordsGroupName = (lesson?.group_name || '').toUpperCase();
  
  const initialTrickyLevel = trickyWordsGroupName.match(/GROUP\s*(\d)/)?.[1] 
    ? parseInt(trickyWordsGroupName.match(/GROUP\s*(\d)/)![1]) 
    : 1;

  const [trickyLevel, setTrickyLevel] = useState<number>(initialTrickyLevel);
  useEffect(() => { setTrickyLevel(initialTrickyLevel) }, [isTrickyMode, initialTrickyLevel]);
  
  const screenTitle = isTrickyMode
    ? `Tricky Words Group ${trickyLevel}`
    : isAltMode
      ? 'Alternatives'
      : `Learn: ${lesson?.label || ''}`;

  if (loading) {
    return (
      <BaseScreen title="Loading Lesson...">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#999" />
          <Text style={[styles.loadingText, { color: '#999', fontFamily }]}>
            Loading {phoneme} lesson...
          </Text>
        </View>
      </BaseScreen>
    );
  }
  if (!lesson) {
    return (
      <BaseScreen title="Lesson Not Found">
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ff6b6b" />
          <Text style={styles.errorText}>Lesson not found for "{phoneme}"</Text>
        </View>
      </BaseScreen>
    );
  }

  const altBg = lighten(accentColor, 0.88);
  const trickyBg = lighten('#78b1d9', 0.82); 
  
  const trickyWordSize = fontSize === 'small' ? 36 : fontSize === 'large' ? 48 : 40;

  return (
    <BaseScreen title={screenTitle}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {isTrickyMode && (
          <View style={[styles.trickyWrapper, { backgroundColor: trickyBg }]}>
            <View style={[styles.section, { borderColor: 'transparent', backgroundColor: 'transparent', marginBottom: 8, padding: 0 }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trickyChipsRow}>
                {Object.keys(TRICKY_WORDS).map(nStr => {
                  const n = parseInt(nStr);
                  const active = trickyLevel === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setTrickyLevel(n)}
                      style={[
                        styles.altChip,
                        { 
                          backgroundColor: active ? '#4aa3ff' : '#fff',
                          borderColor: active ? '#4aa3ff' : '#e5e7eb',
                          borderWidth: 2,
                          minWidth: 60,
                        },
                      ]}
                    >
                      <Text style={[styles.altChipText, { fontFamily, color: active ? '#fff' : '#111' }]}>Set {n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {(TRICKY_WORDS[trickyLevel] || []).map((w, i) => (
              <TouchableOpacity
                key={`${trickyLevel}-${w}-${i}`}
                onPress={() => playAudio(w)}
                activeOpacity={0.9}
                style={[styles.trickyCard, { borderColor: lighten('#78b1d9', 0.5) }]}
              >
                <Text style={[styles.trickyWord, { fontFamily, fontSize: trickyWordSize }]}>{w.toLowerCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isAltMode && (
          <View style={[styles.altSection, { borderColor: 'transparent', backgroundColor: altBg }]}>
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
                      { 
                        backgroundColor: active ? accentColor : '#fff', 
                        borderColor: active ? accentColor : '#e5e7eb',
                        borderWidth: active ? 0 : 2, 
                      },
                    ]}
                  >
                    <Text style={[styles.altChipText, { fontFamily, color: active ? '#fff' : '#333' }]}>{v}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(altData[activeAlt] || []).map((w, i) => (
              <TouchableOpacity 
                key={`${activeAlt}-${w}-${i}`} 
                onPress={() => playAudio(w)}
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
        )}
        {!isTrickyMode && !isAltMode && (
          <>
            {(() => {
              const recentPhonemes = getRecentPhonemes(lesson.phoneme, 6);
              const shouldShowRecap = recentPhonemes.length >= 3 && upper(lesson.phoneme) !== 'S';
              if (!shouldShowRecap) return null;
              return (
                <View style={[styles.section, { borderColor: accentColor }]}>
                  <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>📚 RECAP</Text>
                  <View style={styles.recapGrid}>
                    {recentPhonemes.map((ph, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => playAudio(ph, true)}
                        style={[styles.recapButton, { borderColor: accentColor }]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.recapButtonText, { fontFamily, fontSize: fontSizeValue }]}>{ph}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })()}

            {!!lesson.video_url && (
              <View style={[styles.section, { borderColor: accentColor }]}>
                <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>🎥 WATCH & LEARN</Text>
                <TouchableOpacity
                  onPress={() => videoRef.current?.replayAsync()}
                  style={[styles.videoContainer, { borderColor: accentColor }]}
                  activeOpacity={0.8}
                >
                  <Video
                    ref={videoRef}
                    source={{ uri: lesson.video_url }}
                    resizeMode={ResizeMode.CONTAIN}
                    style={styles.video}
                    isLooping={false}
                    shouldPlay={false}
                  />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={50} color={accentColor} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.section, { borderColor: accentColor }]}>
              <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>🔊 LISTEN</Text>
              <TouchableOpacity
                onPress={() => playAudio(lesson.label, true)}
                style={[styles.audioButton, { backgroundColor: accentColor }]}
                activeOpacity={0.8}
              >
                <Ionicons name="volume-high" size={32} color="#fff" />
                <Text style={[styles.audioButtonText, { fontFamily }]}>Play "{lesson.label}" Sound</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { borderColor: accentColor }]}>
              <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>✏️ TRACE THE LETTER</Text>
              <Text style={[styles.tracingInstructions, { fontFamily }]}>
                Trace the letter: <Text style={{ fontWeight: 'bold', color: accentColor }}>{getMainLetter(lesson.phoneme)}</Text>
              </Text>

              {(() => {
                const letter = getMainLetter(lesson.phoneme);
                const rawGuides = letterStrokes[letter] ?? [];
                const safeGuides = (Array.isArray(rawGuides) ? rawGuides : []).filter(
                  (stroke: any) =>
                    Array.isArray(stroke) &&
                    stroke.length >= 2 &&
                    stroke.every((p: any) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
                );
                if (safeGuides.length === 0) {
                  return (
                    <View style={[styles.tracingContainer, { borderColor: accentColor, padding: 16 }]}>
                      <Text style={{ textAlign: 'center', color: '#666', fontFamily }}>
                        Tracing guide for “{letter}” isn’t available yet.
                      </Text>
                    </View>
                  );
                }
                return (
                  <View style={[styles.tracingContainer, { borderColor: accentColor }]}>
                    <View style={{ width: 300, height: 300, alignSelf: 'center' }}>
                      <TracingCanvas
                        ref={canvasRef}
                        guidePaths={safeGuides}
                        strokeColor={accentColor}
                        containerStyle={styles.canvas}
                        strokeWidth={5}
                      />
                    </View>
                    <View style={styles.canvasControls}>
                      <TouchableOpacity onPress={clearCanvas} style={[styles.controlButton, styles.clearButton]} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={16} color="#fff" />
                        <Text style={styles.controlButtonText}>Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowExpandedCanvas(true)} style={[styles.controlButton, { backgroundColor: accentColor }]} activeOpacity={0.7}>
                        <Ionicons name="expand" size={16} color="#fff" />
                        <Text style={styles.controlButtonText}>Expand</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
            </View>

            {lesson.examples?.length > 0 && (
              <View style={[styles.section, { borderColor: accentColor }]}>
                <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>🖼️ EXAMPLES</Text>
                <View style={styles.examplesGrid}>
                  {lesson.examples.map((ex, i) => (
                    <TouchableOpacity
                      key={`${ex.label}-${i}`}
                      onPress={() => playAudio(ex.label)}
                      style={[styles.exampleCard, { borderColor: accentColor }]}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: ex.image_url }} style={styles.exampleImage} resizeMode="contain" />
                      <Text style={[styles.exampleLabel, { fontFamily }]}>{ex.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {fullBlendPool.length > 0 && (
              <View style={[styles.section, { borderColor: accentColor }]}>
                <Text style={[styles.sectionTitle, { fontFamily, color: accentColor }]}>🔤 BLENDING WORDS</Text>

                <View style={styles.blendingGrid}>
                  {visibleBlends.map((word, i) => (
                    <TouchableOpacity
                      key={`${word}-${i}`}
                      onPress={() => playAudio(word)}
                      style={[styles.blendingButton, { borderColor: accentColor }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.blendingText, { fontFamily, fontSize: fontSizeValue }]}>{word}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {(canShowMore || isExpanded) && (
                  <View style={{ marginTop: 12, alignItems: 'center' }}>
                    {canShowMore ? (
                      <TouchableOpacity
                        onPress={() => setVisibleBlendCount(MAX_SHOW)}
                        style={[styles.loadMoreBtn, { borderColor: accentColor }]}
                      >
                        <Text style={[styles.loadMoreTxt, { fontFamily, color: accentColor }]}>Show More</Text>
                      </TouchableOpacity>
                    ) : isExpanded && (
                      <TouchableOpacity
                        onPress={() => setVisibleBlendCount(initialCount)}
                        style={[styles.loadMoreBtn, { borderColor: accentColor }]}
                      >
                        <Text style={[styles.loadMoreTxt, { fontFamily, color: accentColor }]}>Show Less</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {!isTrickyMode && !isAltMode && (
        <Modal
          visible={showExpandedCanvas}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowExpandedCanvas(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily, color: accentColor }]}>
                Trace: {getMainLetter(lesson.phoneme)}
              </Text>
              <TouchableOpacity onPress={() => setShowExpandedCanvas(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={accentColor} />
              </TouchableOpacity>
            </View>

            <View style={[styles.expandedTracingContainer, { borderColor: accentColor }]}>
              <TracingCanvas
                ref={expandedCanvasRef}
                guidePaths={letterStrokes[getMainLetter(lesson.phoneme)] ?? []}
                strokeColor={accentColor}
                containerStyle={styles.expandedCanvas}
              />
            </View>

            <View style={styles.modalControls}>
              <TouchableOpacity onPress={clearExpandedCanvas} style={[styles.modalButton, styles.clearButton]} activeOpacity={0.8}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowExpandedCanvas(false)} style={[styles.modalButton, { backgroundColor: accentColor }]} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </BaseScreen>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { padding: 16 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 18, textAlign: 'center', marginTop: 16, color: '#666' },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },

  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  recapButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 2, backgroundColor: '#f8f9fa', minWidth: 60 },
  recapButtonText: { textAlign: 'center', fontWeight: 'bold' },

  videoContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, position: 'relative' },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },

  audioButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 25, gap: 12, backgroundColor: '#111' },
  audioButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  tracingInstructions: { textAlign: 'center', fontSize: 16, marginBottom: 12, color: '#666' },
  tracingContainer: { borderRadius: 12, borderWidth: 2, overflow: 'hidden', backgroundColor: '#fff' },
  canvas: { backgroundColor: '#fff' },

  canvasControls: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#f8f9fa', gap: 10 },
  controlButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  clearButton: { backgroundColor: '#ff6b6b' },
  controlButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  examplesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  exampleCard: { width: (screenWidth - 80) / 2, borderRadius: 12, borderWidth: 2, padding: 12, backgroundColor: '#f8f9fa', alignItems: 'center' },
  exampleImage: { width: 80, height: 80, marginBottom: 8 },
  exampleLabel: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },

  blendingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  blendingButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 2, backgroundColor: '#f8f9fa' },
  blendingText: { fontWeight: 'bold', textAlign: 'center' },

  loadMoreBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 2 },
  loadMoreTxt: { fontWeight: '700' },

  altSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  altBigPhoneme: {
    fontSize: 64,
    textAlign: 'center',
    marginVertical: 6,
    fontWeight: '800',
  },
  altChipsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  altChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altChipText: { fontSize: 18, fontWeight: '700' },

  altWordCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  altWordText: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  altDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, opacity: 0.8 },

  trickyWrapper: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trickyChipsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 10,
    justifyContent: 'flex-start',
  },
  trickyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  trickyWord: {
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    color: '#333',
    textTransform: 'lowercase',
  },

  modalContainer: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  modalTitle: { fontSize: 24, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  expandedTracingContainer: { flex: 1, margin: 20, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  expandedCanvas: { flex: 1, aspectRatio: 1, backgroundColor: '#fff' },
  modalControls: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, gap: 20 },
  modalButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 25, gap: 8 },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});