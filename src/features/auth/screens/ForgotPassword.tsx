// src/features/auth/screens/ForgotPassword.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type Props = { navigation: Nav };

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startCooldown = (seconds = 30) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSend = async () => {
    const em = email.trim().toLowerCase();
    if (!em) {
      Alert.alert('Missing Email', 'Please enter your email.');
      return;
    }
    if (!isValidEmail(em)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setSending(true);
      const { error } = await supabase.auth.resetPasswordForEmail(em);
      if (error) {
        Alert.alert('Reset Failed', error.message);
        return;
      }

      Alert.alert(
        'Check Your Email',
        'We sent a password reset link to your inbox. Follow the link to create a new password.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
      startCooldown(30);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* NEW: simple header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={26} color="#333" />
        </TouchableOpacity>
        <View style={{ width: 26 }} />
      </View>

      <Image source={require('../../../../assets/icons/logo.png')} style={styles.logo} />
      <Text style={[styles.heading, { fontFamily }]}>Forgot Password</Text>
      <Text style={[styles.sub, { fontFamily, fontSize: fontSizeValue }]}>
        Enter the email you used to sign up and we’ll send you a reset link.
      </Text>

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Email</Text>
      <View style={[styles.inputRow, { backgroundColor: accentColor }]}>
        <Ionicons name="mail" size={20} color="#555" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={{ flex: 1, fontFamily, fontSize: fontSizeValue }}
          editable={!sending && cooldown === 0}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (cooldown > 0 || sending) && { opacity: 0.6 }]}
        onPress={handleSend}
        disabled={cooldown > 0 || sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.primaryText, { fontFamily, fontSize: fontSizeValue }]}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Reset Link'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, alignItems: 'center' },
  header: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    height: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: { width: 100, height: 100, marginBottom: 10, marginTop: 16 },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  sub: { color: '#666', marginBottom: 20, textAlign: 'center' },
  label: { alignSelf: 'flex-start', marginLeft: 10, fontWeight: '600', color: '#444' },
  inputRow: {
    width: '100%',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryText: { color: '#fff', fontWeight: 'bold' },
  linkText: { color: '#333' },
  link: { fontWeight: 'bold', textDecorationLine: 'underline' },
});

export default ForgotPasswordScreen;
