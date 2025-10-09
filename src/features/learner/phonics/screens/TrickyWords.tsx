import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { styles } from '../../../../features/phonics/ui/PhonicsStyles';
import { playTextOrFile } from '../../../../features/phonics/data/phonics';

type Params = { group: number };
type R = RouteProp<{ TrickyWordsLesson: Params }, 'TrickyWordsLesson'>;

const TRICKY_WORDS: Record<number, string[]> = {
  1: ['I','THE','HE','SHE','ME','WE','BE','WAS','TO','DO','ARE','ALL'],
  2: ['YOU','YOUR','COME','SOME','SAID','HERE','THERE','THEY','GO','NO','SO','MY'],
  3: ['ONE','BY','ONLY','OLD','LIKE','HAVE','LIVE','GIVE','LITTLE','DOWN','WHAT','WHEN'],
  4: ['WHY','WHERE','WHO','WHICH','ANY','MANY','MORE','BEFORE','OTHER','WERE','BECAUSE','WANT'],
  5: ['SAW','PUT','COULD','SHOULD','WOULD','RIGHT','TWO','FOUR','GOES','DOES','MADE','THEIR'],
  6: ['ONCE','UPON','ALSO','OF','EIGHT','LOVE','COVER','AFTER','EVERY','FATHER','ALWAYS','MOTHER'],
};

export default function TrickyWordsLesson() {
  const route = useRoute<R>();
  const { group } = route.params;
  const { accentColor, fontSize, fontFamily } = useAppSettings();
  const trickyWordSize = fontSize === 'small' ? 36 : fontSize === 'large' ? 48 : 40;
  const currentSoundRef = useRef(null as any);

  const level = Math.min(6, Math.max(1, group || 1));

  const lighten = (hex: string, amt=0.82) => {
    const h = hex.replace('#','');
    const n = h.length === 3 ? h.split('').map(ch=>ch+ch).join('') : h;
    const r = parseInt(n.slice(0,2),16), g = parseInt(n.slice(2,4),16), b = parseInt(n.slice(4,6),16);
    const toHex = (v:number)=>Math.round(v).toString(16).padStart(2,'0');
    return `#${toHex(r+(255-r)*amt)}${toHex(g+(255-g)*amt)}${toHex(b+(255-b)*amt)}`;
  };
  const trickyBg = lighten('#78b1d9', 0.82);

  useEffect(() => () => { if (currentSoundRef.current) currentSoundRef.current.unloadAsync?.() }, []);

  return (
    <BaseScreen title="Tricky Words">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.trickyWrapper, { backgroundColor: trickyBg }]}>
          {(TRICKY_WORDS[level] || []).map((w, i) => (
            <TouchableOpacity
              key={`${level}-${w}-${i}`}
              onPress={() => playTextOrFile({ text: w, currentSoundRef })}
              activeOpacity={0.9}
              style={[styles.trickyCard, { borderColor: '#cfe5f7' }]}
            >
              <Text style={[styles.trickyWord, { fontFamily, fontSize: trickyWordSize }]}>{w.toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </BaseScreen>
  );
}
