import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../src/context/AppSettings'; // fixed path

type BaseScreenProps = {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
  /** optional right-side header content (e.g., gear icon) */
  right?: React.ReactNode;
  /** set true to wrap content in a ScrollView */
  scroll?: boolean;
  /** extra styles for the content container */
  contentStyle?: object;
};

export default function BaseScreen({
  children,
  title,
  showBack = true,
  right,
  scroll = false,
  contentStyle,
}: BaseScreenProps) {
  const navigation = useNavigation<any>();
  const { bgColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const ContentWrap: React.ComponentType<any> = scroll ? require('react-native').ScrollView : View;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={[styles.title, { fontFamily, fontSize: fontSizeValue + 2 }]}>{title}</Text>
        <View style={{ minWidth: 24, alignItems: 'flex-end' }}>
          {right ?? null}
        </View>
      </View>

      <ContentWrap
        style={[styles.content, contentStyle]}
        contentContainerStyle={scroll ? styles.scrollContent : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ContentWrap>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  header: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontWeight: 'bold', color: '#333' },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
});
