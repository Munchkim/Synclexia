import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../src/context/AppSettings';

interface BaseScreenProps {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
}

export default function BaseScreen({ children, title, showBack = true }: BaseScreenProps) {
  const navigation = useNavigation<any>();
  const { bgColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: 32, paddingBottom: 32 }]}>
      <View style={styles.header}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={[styles.title, { fontFamily, fontSize: fontSizeValue + 2 }]}>
          {title}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
});
