import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Login'>;

type Props = {
  navigation: Nav;
};

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Disable Android hardware back on this screen
  useFocusEffect(
    React.useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backHandler.remove();
    }, [])
  );

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing Fields', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      // Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (authError || !authData?.user) {
        Alert.alert('Login Failed', authError?.message || 'Invalid email or password.');
        return;
      }

      // Profile
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (dbError || !userData) {
        Alert.alert('Error', 'Failed to load your profile.');
        return;
      }

      // Route by role / setup status
      if (userData.role === 'admin') {
        navigation.reset({ index: 0, routes: [{ name: 'AdminRoot' }] });
      } else if (!userData.is_setup_complete) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Setup', params: { userId: userData.id } }],
        });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }
    } catch (err) {
      console.log('Unexpected Error:', err);
      Alert.alert('Login Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Image source={require('../../../../assets/icons/logo.png')} style={styles.logo} />

      <Text style={[styles.heading, { fontFamily }]}>Login</Text>

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Email</Text>
      <TextInput
        style={[styles.input, { fontFamily, fontSize: fontSizeValue, backgroundColor: accentColor }]}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Password</Text>
      <View style={[styles.input, styles.passwordRow, { backgroundColor: accentColor }]}>
        <TextInput
          style={{ flex: 1, fontFamily, fontSize: fontSizeValue }}
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          textContentType="password"
          autoCapitalize="none"
          autoComplete="password"
          editable={!loading}
        />
        <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} disabled={loading}>
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={22}
            color="#555"
            style={{ marginLeft: 10 }}
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.forgot}
        onPress={() => navigation.navigate('ForgotPassword')}
        disabled={loading}
      >
        <Text style={[styles.forgotText, { fontFamily, fontSize: fontSizeValue }]}>
          Forgot password?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.loginButton, loading && { opacity: 0.6 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.loginButtonText, { fontFamily, fontSize: fontSizeValue }]}>
            Login
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')} disabled={loading}>
        <Text style={[styles.linkText, { fontFamily, fontSize: fontSizeValue }]}>
          Don’t have an account? <Text style={styles.link}>Signup here</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60, alignItems: 'center' },
  logo: { width: 100, height: 100, marginBottom: 10 },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, color: '#333' },
  label: { alignSelf: 'flex-start', marginLeft: 10, fontWeight: '600', color: '#444' },
  input: { width: '100%', borderRadius: 8, padding: 12, marginBottom: 20 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  forgot: { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText: { color: '#666', textDecorationLine: 'underline' },
  loginButton: { backgroundColor: '#333', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center', marginBottom: 20 },
  loginButtonText: { color: '#fff', fontWeight: 'bold' },
  linkText: { color: '#333' },
  link: { fontWeight: 'bold', textDecorationLine: 'underline' },
});

export default LoginScreen;
