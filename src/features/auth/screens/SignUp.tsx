import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Signup'>;
type Props = { navigation: Nav };

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const em = email.trim().toLowerCase();
    const pw = password.trim();
    const cpw = confirmPassword.trim();

    if (!em || !pw || !cpw) {
      Alert.alert('Missing Info', 'Please fill in all required fields.');
      return;
    }
    if (pw !== cpw) {
      Alert.alert('Passwords Don’t Match', 'Make sure both passwords are the same.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: em, password: pw });
      if (error) {
        Alert.alert('Signup Failed', error.message);
        return;
      }

      Alert.alert(
        'Check Your Email',
        'A confirmation link has been sent. Please check your inbox.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e: any) {
      Alert.alert('Signup Error', e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Image source={require('../../../../assets/icons/logo.png')} style={styles.logo} />
      <Text style={[styles.heading, { fontFamily }]}>Signup</Text>

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Email</Text>
      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={[styles.input, { backgroundColor: accentColor, fontFamily, fontSize: fontSizeValue }]}
        editable={!loading}
      />

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Password</Text>
      <View style={[styles.input, styles.passwordRow, { backgroundColor: accentColor }]}>
        <TextInput
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{ flex: 1, fontFamily, fontSize: fontSizeValue }}
          editable={!loading}
        />
        <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} disabled={loading}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#555" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Confirm Password</Text>
      <View style={[styles.input, styles.passwordRow, { backgroundColor: accentColor }]}>
        <TextInput
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showConfirm}
          style={{ flex: 1, fontFamily, fontSize: fontSizeValue }}
          editable={!loading}
        />
        <TouchableOpacity onPress={() => setShowConfirm(prev => !prev)} disabled={loading}>
          <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={22} color="#555" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signupButton, loading && { opacity: 0.6 }]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.signupButtonText, { fontFamily, fontSize: fontSizeValue }]}>Signup</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.orText, { fontFamily, fontSize: fontSizeValue }]}>— OR —</Text>

      <View style={styles.socialRow}>
        <TouchableOpacity disabled={loading}>
          <Image source={require('../../../../assets/icons/facebook.png')} style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity disabled={loading}>
          <Image source={require('../../../../assets/icons/google.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
        <Text style={[styles.linkText, { fontFamily, fontSize: fontSizeValue }]}>
          Already have an account? <Text style={styles.link}>Login here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, alignItems: 'center' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 20 },
  logo: { width: 100, height: 100, marginBottom: 10 },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, color: '#333' },
  label: { alignSelf: 'flex-start', marginLeft: 10, fontWeight: '600', color: '#444' },
  input: { width: '100%', borderRadius: 8, padding: 12, marginBottom: 20 },
  signupButton: { backgroundColor: '#333', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 20 },
  signupButtonText: { color: '#fff', fontWeight: 'bold' },
  orText: { marginBottom: 12, color: '#666' },
  socialRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  icon: { width: 40, height: 40 },
  linkText: { color: '#333' },
  link: { fontWeight: 'bold', textDecorationLine: 'underline' },
});

export default SignupScreen;
