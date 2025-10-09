import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

const SetupScreen = ({ navigation, route }: any) => {
  const { userId } = route.params || {};
  const [name, setName] = useState('');
  const [age, setAge] = useState(7);

  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Exit Setup?',
          'Are you sure you want to exit? Your setup progress will not be saved.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', onPress: () => navigation.navigate('Login') },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
return () => subscription.remove();

    }, [navigation])
  );

  const handleApply = async () => {
    if (!userId) {
      Alert.alert('Error', 'Something went wrong. Please try signing up again.');
      return;
    }

    const { data: authData, error: sessionError } = await supabase.auth.refreshSession();

    if (sessionError || !authData.session) {
      console.error('No session found:', sessionError);
      Alert.alert('Session Expired', 'Please log in again.');
      navigation.navigate('Login');
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: { username: name },
    });

    if (authError) {
      console.error('Auth update error:', authError.message);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
      return;
    }

    const { error: dbError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          username: name,
          age: parseInt(age.toString()),
          is_setup_complete: true,
        },
        { onConflict: 'id' }
      );

    if (dbError) {
      console.error('DB insert error:', dbError.message);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      return;
    }

    navigation.navigate('Dashboard');
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
        />
      </View>

      <View style={[styles.box, { backgroundColor: accentColor }]}>
        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>How old are you?</Text>
        <Slider
          style={styles.slider}
          minimumValue={3}
          maximumValue={18}
          step={1}
          minimumTrackTintColor="#333"
          maximumTrackTintColor="#888"
          thumbTintColor="#333"
          value={age}
          onValueChange={setAge}
        />
        <Text style={[styles.ageOutput, { fontFamily, fontSize: fontSizeValue }]}>{age} years old</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleApply}>
        <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Apply</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  box: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 10,
  },
  ageOutput: {
    marginTop: 12,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#333',
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 40,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default SetupScreen;
