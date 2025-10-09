import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Loading'>;
type Props = { navigation: Nav };

const LoadingScreen: React.FC<Props> = ({ navigation }) => {
  const { bgColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 20 : fontSize === 'large' ? 32 : 28;

  useEffect(() => {
    let cancelled = false;

    const checkLoginStatus = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data?.session) {
        navigation.replace('Login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (cancelled) return;

      if (!userData?.is_setup_complete) {
        navigation.replace('Setup', { userId: data.session.user.id });
      } else {
        navigation.replace('Dashboard');
      }
    };

    const t = setTimeout(checkLoginStatus, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Image
        source={require('../../../../assets/icons/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { fontFamily, fontSize: fontSizeValue }]}>Synclexia</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontWeight: 'bold', color: '#333' },
});

export default LoadingScreen;
