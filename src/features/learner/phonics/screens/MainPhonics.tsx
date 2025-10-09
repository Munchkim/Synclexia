import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import tinycolor from 'tinycolor2';

import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { RootStackParamList } from '../../../../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Phonics'>;

const phonicsGroups = [
  { title: 'GROUP 1', letters: ['S', 'A', 'T', 'I', 'P', 'N'] },
  { title: 'GROUP 2', letters: ['CK', 'E', 'H', 'R', 'M', 'D'] },
  { title: 'GROUP 3', letters: ['G', 'O', 'U', 'L', 'F', 'B'] },
  { title: 'GROUP 4', letters: ['AI', 'J', 'OA', 'IE', 'EE', 'OR'] },
  { title: 'GROUP 5', letters: ['Z', 'W', 'NG', 'V', 'OO', 'OO'] }, 
  { title: 'GROUP 6', letters: ['Y', 'X', 'CH', 'SH', 'TH', 'TH'] }, 
  { title: 'GROUP 7', letters: ['QU', 'OU', 'OI', 'UE', 'ER', 'AR'] },
  { title: 'ALTERNATIVES 1', letters: ['AI', 'UE', 'OA', 'OI', 'IE', 'OR'] },
  { title: 'ALTERNATIVES 2', letters: ['S', 'OU', 'J', 'EE', 'ER', 'F'] },
  { title: 'TRICKY WORDS', letters: ['1', '2', '3', '4', '5', '6'] },
];

function toCanonicalPhoneme(letter: string, groupTitle: string, letterIndex: number): string {
  const up = (letter || '').toUpperCase();

  if (groupTitle.includes('GROUP 5') && up === 'OO') {
    return letterIndex % 2 === 0 ? 'OO (SHORT)' : 'OO (LONG)';
  }

  if (groupTitle.includes('GROUP 6') && up === 'TH') {
    return letterIndex % 2 === 0 ? 'TH (SILENT)' : 'TH (VOICED)';
  }

  return up;
}

const ALT_SETS: Record<string, string[]> = {
  AI:['ai','ay','a_e'], UE:['u_e','ew','ue'], OA:['o_e','oa','ow'], OI:['oi','oy'],
  IE:['i_e','igh','ie'], OR:['or','al','aw','au'],
  S:['cy','ci','ce'], OU:['ou','ow'], J:['ge','j','gy','gi'],
  EE:['y','ea','e_e','ee'], ER:['ir','er','ur'], F:['ph','f'],
};
const isAlternative = (base: string) => !!ALT_SETS[(base || '').toUpperCase()];

export default function PhonicsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const contrastColor = tinycolor(accentColor).isLight()
    ? tinycolor(accentColor).darken(25).toHexString()
    : tinycolor(accentColor).lighten(25).toHexString();

  return (
    <BaseScreen title="Phonics">
      <ScrollView>
        <View style={styles.wrapper}>
          {phonicsGroups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.groupContainer}>
              <View style={[styles.banner, { backgroundColor: accentColor }]}>
                <Text style={[styles.bannerText, { fontFamily, fontSize: fontSizeValue + 2 }]}>
                  {group.title.toUpperCase()}
                </Text>
              </View>

              <View style={styles.letterGrid}>
                {group.letters.map((letter, letterIndex) => {
                  const title = group.title.toUpperCase();

                  const canonical = toCanonicalPhoneme(letter, title, letterIndex);

                  const tileContrast = tinycolor(accentColor).isLight()
                    ? tinycolor(accentColor).darken(25).toHexString()
                    : tinycolor(accentColor).lighten(25).toHexString();

                  return (
                    <TouchableOpacity
                      key={`${groupIndex}-${letterIndex}`}
                      style={[
                        styles.letterCard,
                        { borderColor: tileContrast, shadowColor: tileContrast },
                      ]}
                      onPress={() => {
                        if (title.includes('TRICKY')) {
                          const groupNum = Number(letter);
                          navigation.navigate('TrickyWordsLesson', {
                            group: Number.isFinite(groupNum) ? groupNum : 1,
                          });
                          return;
                        }

                        if (title.includes('ALTERNATIVES')) {
                          if (!isAlternative(canonical)) {

                          }
                          navigation.navigate('AlternativesLesson', { phoneme: canonical });
                          return;
                        }

                        navigation.navigate('GroupLesson', { phoneme: canonical });
                      }}
                    >
                      <Text style={[styles.letter, { fontFamily, fontSize: fontSizeValue }]}>
                        {letter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingBottom: 24 },
  groupContainer: { marginBottom: 24 },
  banner: { padding: 14, borderRadius: 20, marginBottom: 14, alignItems: 'center' },
  bannerText: { fontWeight: 'bold', color: '#fff' },
  letterGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  letterCard: {
    backgroundColor: '#fff',
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 6,
    elevation: 5,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.75,
    shadowRadius: 6,
  },
  letter: { color: '#333', fontWeight: 'bold' },
});
