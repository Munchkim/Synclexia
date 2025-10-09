import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { useRoute } from '@react-navigation/native';
import { useAppSettings } from '../../../../context/AppSettings';

export default function GameReviewScreen() {
  const { fontFamily } = useAppSettings();
  const route = useRoute<any>();
  const wrong = (route.params?.wrong || []) as Array<{
    promptText?: string;
    promptImage?: string | null;
    choices: string[];
    correctIndex: number;
    selectedIndex: number | null;
  }>;

  return (
    <BaseScreen title="Review Answers" showBack>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {wrong.length === 0 ? (
          <Text style={[styles.msg, { fontFamily }]}>No mistakes this round — great job! 🎉</Text>
        ) : wrong.map((w, i) => (
          <View key={i} style={styles.card}>
            {!!w.promptText && <Text style={[styles.prompt, { fontFamily }]}>{w.promptText}</Text>}
            {w.choices.map((c, idx) => {
              const isCorrect = idx === w.correctIndex;
              const isYours = idx === w.selectedIndex;
              return (
                <Text key={idx} style={[
                  styles.choice, 
                  isCorrect ? styles.correct : isYours ? styles.yours : null,
                  { fontFamily }
                ]}>
                  {String.fromCharCode(65 + idx)}. {c}
                </Text>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  msg: { fontSize: 16, textAlign: 'center', marginTop: 24 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  prompt: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  choice: { fontSize: 14, marginVertical: 2 },
  correct: { color: '#0a7f23', fontWeight: '800' },
  yours: { textDecorationLine: 'underline' },
});
