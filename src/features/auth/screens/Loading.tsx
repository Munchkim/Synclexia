import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

const LoadingScreen = ({ navigation }: any) => {
  const { bgColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 20 : fontSize === 'large' ? 32 : 28;

  useEffect(() => {
  const checkLoginStatus = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigation.replace('Login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.session.user.id)
      .single();

    if (!userData?.is_setup_complete) {
      navigation.replace('Setup', { userId: data.session.user.id });
    } else {
      navigation.replace('Dashboard');
    }
  };

  setTimeout(checkLoginStatus, 1000);
}, []);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Image
        source={require('../../../../assets/icons/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { fontFamily, fontSize: fontSizeValue }]}>
        Synclexia
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontWeight: 'bold',
    color: '#333',
  },
});

export default LoadingScreen;
