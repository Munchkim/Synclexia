import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppSettings } from '../../../../context/AppSettings';

type GameType = 'sound_match' | 'name_picture' | 'rhyme_time' | 'fill_blank';

export default function GamesMainScreen() {
  const navigation = useNavigation<any>();
  const { accentColor, fontFamily } = useAppSettings();

  const tiles: Array<{
    key: GameType;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    { key: 'sound_match',  title: 'Sound Match',      subtitle: 'Hear & choose the sound',        icon: <Ionicons name="volume-high" size={28} color="#000" /> },
    { key: 'name_picture', title: 'Name the Picture', subtitle: 'Pick the correct word',          icon: <Ionicons name="image" size={28} color="#000" /> },
    { key: 'rhyme_time',   title: 'Rhyme Time',       subtitle: 'Choose the rhyming word',        icon: <MaterialCommunityIcons name="music" size={28} color="#000" /> },
    { key: 'fill_blank',   title: 'Fill the Blank',   subtitle: 'Missing letter(s) challenge',    icon: <Ionicons name="text" size={28} color="#000" /> },
  ];

// GamesMainScreen.tsx
const onOpenGame = (type: GameType) => {
  switch (type) {
    case 'sound_match':  navigation.navigate('SoundMatch');  break;
    case 'name_picture': navigation.navigate('NamePicture'); break;
    case 'rhyme_time':   navigation.navigate('RhymeTime');   break;
    case 'fill_blank':   navigation.navigate('FillBlank');   break;
  }
};



  return (
    <BaseScreen title="Games" showBack>
      <Text style={[styles.note, { fontFamily }]}>Each game has 20 rounds • 5 items/round • Score shown after each round</Text>
      <View style={styles.grid}>
        {tiles.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.card, { borderColor: accentColor }]}
            onPress={() => onOpenGame(t.key)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconWrap, { backgroundColor: accentColor }]}>{t.icon}</View>
            <Text style={[styles.title, { fontFamily }]}>{t.title}</Text>
            <Text style={[styles.subtitle, { fontFamily }]}>{t.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  note: { textAlign: 'center', color: '#666', marginTop: 8, marginBottom: 6, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly', paddingVertical: 8 },
  card: { width: '44%', borderWidth: 2, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 12, marginVertical: 10, backgroundColor: '#fff', elevation: 3 },
  iconWrap: { alignSelf: 'flex-start', padding: 10, borderRadius: 12, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { marginTop: 6, fontSize: 12, color: '#555' },
});
