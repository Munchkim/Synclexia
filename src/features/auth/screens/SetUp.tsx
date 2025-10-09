import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Setup'>;
type Rt = RouteProp<RootStackParamList, 'Setup'>;

function isValidYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(s + 'T00:00:00');
  if (Number.isNaN(dt.getTime())) return false;
  return dt <= new Date();
}

type Props = { navigation: Nav; route: Rt };

const SetupScreen: React.FC<Props> = ({ navigation, route }) => {
  const { userId: paramUserId } = route.params || {};
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState(''); // YYYY-MM-DD
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Exit Setup?',
          'Are you sure you want to exit? Your setup progress will not be saved.',
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Exit', onPress: () => navigation.navigate('Login') }],
        );
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [navigation])
  );

  const handleApply = async () => {
    const nm = name.trim();
    const bd = birthdate.trim();

    if (!nm) {
      Alert.alert('Missing Name', 'Please enter your name.');
      return;
    }
    if (!isValidYmd(bd)) {
      Alert.alert('Invalid Birthdate', 'Please use YYYY-MM-DD and avoid future dates.');
      return;
    }

    setSaving(true);
    try {
      // Ensure session & get user
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      const userId = paramUserId || user?.id;
      if (!user || !userId) {
        Alert.alert('Session', 'Please log in again.');
        navigation.navigate('Login');
        return;
      }

      // Update auth metadata (username) so Account/Profile also see it
      const { error: authErr } = await supabase.auth.updateUser({ data: { username: nm } });
      if (authErr) {
        Alert.alert('Error', authErr.message || 'Failed to update profile.');
        return;
      }

      // Upsert app profile (what Account reads/edits)
      const nowIso = new Date().toISOString();
      const { error: dbErr } = await supabase
        .from('users')
        .upsert(
          {
            id: userId,
            username: nm,
            birthdate: bd,
            last_birthdate_update: nowIso, // Initial set counts as last update (Profile enforces cooldown)
            is_setup_complete: true,
            updated_at: nowIso,
          },
          { onConflict: 'id' }
        );

      if (dbErr) {
        Alert.alert('Error', dbErr.message || 'Failed to save your profile.');
        return;
      }

      // (Best effort) mirror to profiles table if present
      try {
        await supabase.from('profiles').upsert(
          { id: userId, full_name: nm, avatar_url: null, updated_at: nowIso },
          { onConflict: 'id' }
        );
      } catch { /* ignore if table not present */ }

      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e: any) {
      Alert.alert('Setup Error', e?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.box, { backgroundColor: accentColor }]}>
        <Text style={[styles.title, { fontFamily }]}>Welcome to Synclexia!</Text>

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>What should we call you?</Text>
        <TextInput
          placeholder="Enter your name"
          style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      <View style={[styles.box, { backgroundColor: accentColor }]}>
        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Your birthdate (YYYY-MM-DD)</Text>
        <TextInput
          placeholder="YYYY-MM-DD"
          style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
          value={birthdate}
          onChangeText={setBirthdate}
          autoCapitalize="none"
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity style={[styles.button, { opacity: saving ? 0.6 : 1 }]} onPress={handleApply} disabled={saving}>
        <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Apply'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  box: { padding: 20, borderRadius: 12, marginBottom: 30 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  label: { fontWeight: '600', marginBottom: 8, color: '#333' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8 },
  button: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 40 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});

export default SetupScreen;
