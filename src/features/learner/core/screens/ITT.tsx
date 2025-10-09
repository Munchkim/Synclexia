import * as ImageManipulator from 'expo-image-manipulator';
import * as Speech from 'expo-speech';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAppSettings } from '../../../../context/AppSettings';
import BaseScreen from '../../../../components/BaseScreen';

export default function ScanScreen() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const [image, setImage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const pickImage = async (fromCamera: boolean = false) => {
    const permissionResult = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission denied', 'We need permission to access your camera or gallery.');
      return;
    }

    const result = await (fromCamera
      ? ImagePicker.launchCameraAsync()
      : ImagePicker.launchImageLibraryAsync());

    if (!result.canceled && result.assets?.[0]) {
      const original = result.assets[0];

      const manipulated = await ImageManipulator.manipulateAsync(
        original.uri,
        [
          { resize: { width: 800 } },
          { crop: { originX: 0, originY: 0, width: original.width ?? 800, height: original.height ?? 600 } },
        ],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
      );

      const enhanced = await ImageManipulator.manipulateAsync(
        manipulated.uri,
        [{ resize: { width: 800 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.7 }
      );

      setImage(enhanced.uri);
      sendToOCR(enhanced.uri);
    }
  };

  const sendToOCR = async (uri: string) => {
    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'image.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('language', 'eng');
      formData.append('isOverlayRequired', 'false');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          apikey: 'K81942883388957',
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const result = await response.json();
      const parsedText = result?.ParsedResults?.[0]?.ParsedText;

      if (parsedText && parsedText.trim() !== '') {
        setExtractedText(parsedText.trim());
      } else {
        console.log(result);
        Alert.alert('OCR Failed', 'No readable text found. Try better lighting and clearer font.');
        setExtractedText('');
      }
    } catch (error) {
      console.error('OCR error:', error);
      Alert.alert('Error', 'Something went wrong during OCR scan.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      Speech.speak(extractedText, {
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
      setIsSpeaking(true);
    }
  };

  return (
    <BaseScreen title="Scan Image for Text">
      <View style={[styles.outputBox, { backgroundColor: accentColor }]}>
        <ScrollView>
          <Text style={[styles.resultText, { fontFamily, fontSize: fontSizeValue }]}>
            {isLoading ? '🔍 Scanning for text...' : extractedText || 'Extracted text will appear here.'}
          </Text>
        </ScrollView>

        {extractedText.trim() !== '' && !isLoading && (
          <TouchableOpacity style={styles.micButton} onPress={toggleSpeech}>
            <Ionicons
              name={isSpeaking ? 'stop-circle' : 'volume-high'}
              size={26}
              color="#fff"
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.imagePlaceholder}>
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} />
        ) : (
          <Text style={[styles.placeholderText, { fontFamily, fontSize: fontSizeValue }]}>
            Image goes here
          </Text>
        )}
      </View>

      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.iconButton} onPress={() => pickImage(false)}>
          <MaterialIcons name="file-upload" size={24} color="#fff" />
          <Text style={[styles.buttonLabel, { fontFamily, fontSize: fontSizeValue - 2 }]}>Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={() => pickImage(true)}>
          <Ionicons name="camera-outline" size={24} color="#fff" />
          <Text style={[styles.buttonLabel, { fontFamily, fontSize: fontSizeValue - 2 }]}>Camera</Text>
        </TouchableOpacity>
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  outputBox: {
    borderRadius: 10,
    padding: 16,
    minHeight: 410,
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  resultText: {
    color: '#333',
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
  },
  imagePlaceholder: {
    backgroundColor: '#eee',
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    color: '#999',
  },
  preview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'contain',
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  iconButton: {
    width: 130,
    height: 56,
    backgroundColor: '#333',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#fff',
    marginTop: 4,
  },
});
