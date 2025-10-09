import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

export default function ForgotPasswordScreen({ navigation }: any) {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const isValidEmail = (e: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email.');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    try {
      setSending(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

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
          style={{ flex: 1, fontFamily, fontSize: fontSizeValue }}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, cooldown > 0 || sending ? { opacity: 0.6 } : null]}
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

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={[styles.linkText, { fontFamily, fontSize: fontSizeValue }]}>
          Remembered your password? <Text style={styles.link}>Back to Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, alignItems: 'center' },
  logo: { width: 100, height: 100, marginBottom: 10 },
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
