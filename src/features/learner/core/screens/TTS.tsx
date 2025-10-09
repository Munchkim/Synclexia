import BaseScreen from '../../../../components/BaseScreen';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';
import { useAppSettings } from '../../../../context/AppSettings';

export default function TTSScreen() {
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (!text.trim()) {
      Alert.alert('Empty Text', 'Please type or upload some content first.');
      return;
    }
    setIsSpeaking(true);
    Speech.speak(text, {
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  function getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'txt': return 'text/plain';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default: return 'application/octet-stream';
    }
  }

  const pickFile = async () => {
    try {
      if (isSpeaking) stopSpeaking();
      setText(''); 

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const uri = file.uri;
      const mimeType = getMimeType(file.name || '');

      if (mimeType.includes('text/plain')) {
        const content = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' as any });
        if (!content.trim()) {
          Alert.alert('Empty File', 'The uploaded file contains no readable text.');
          return;
        }
        if (content.length > 5000) {
          Alert.alert('File Too Large', 'Please upload shorter content (max 5000 characters).');
          return;
        }
        setText(content);
      } else if (mimeType.includes('wordprocessingml')) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
        const binary = Buffer.from(base64, 'base64').toString('binary');
        const uint8Array = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const arrayBuffer = uint8Array.buffer;
        const { value } = await mammoth.convertToHtml({ arrayBuffer });
        const plainText = value.replace(/<[^>]*>?/gm, '').trim();

        if (!plainText) {
          Alert.alert('Empty File', 'The uploaded file contains no readable text.');
          return;
        }
        if (plainText.length > 5000) {
          Alert.alert('File Too Large', 'Please upload shorter content (max 5000 characters).');
          return;
        }
        setText(plainText);
      } else {
        Alert.alert('Unsupported File', 'Only .txt and .docx files are supported.');
      }
    } catch (err) {
      console.error('File error:', err);
      Alert.alert('Error reading file', 'Please try again or use another file.');
    }
  };

  return (
    <BaseScreen title="Text-to-Speech" showBack>
      <TouchableOpacity style={styles.uploadButton} onPress={pickFile}>
        <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        <Text style={[styles.uploadText, { fontFamily, fontSize: fontSizeValue }]}>
          Upload File (.txt or .docx)
        </Text>
      </TouchableOpacity>

      <ScrollView style={[styles.inputBox, { backgroundColor: accentColor }]}>
        <TextInput
          style={[styles.inputText, { fontFamily, fontSize: fontSizeValue }]}
          multiline
          placeholder="Type your text or upload a file..."
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
        />
      </ScrollView>

      <TouchableOpacity
        style={[styles.speakButton, isSpeaking && styles.buttonStop]}
        onPress={isSpeaking ? stopSpeaking : handleSpeak}
      >
        <Ionicons name={isSpeaking ? 'stop' : 'volume-high'} size={22} color="#fff" />
        <Text style={[styles.speakText, { fontFamily, fontSize: fontSizeValue }]}>
          {isSpeaking ? 'Stop' : 'Speak'}
        </Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadText: {
    color: '#fff',
    marginLeft: 8,
  },
  inputBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  inputText: {
    color: '#333',
    minHeight: 180,
  },
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 10,
    justifyContent: 'center',
  },
  buttonStop: {
    backgroundColor: '#aa0000',
  },
  speakText: {
    color: '#fff',
    marginLeft: 10,
  },
});
