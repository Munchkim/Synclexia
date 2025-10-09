import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useAppSettings } from '../../../../context/AppSettings';
import BaseScreen from '../../../../components/BaseScreen';

import Constants from 'expo-constants';

const ASSEMBLY_API_KEY = process.env.EXPO_PUBLIC_ASSEMBLY_API_KEY;

export default function STTScreen() {
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [transcript, setTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setTimeout(() => stopRecording(), 10000);
    }
    return () => clearTimeout(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

const transcribeAudio = async (fileUri: string) => {
  try {
    if (!ASSEMBLY_API_KEY) {
      Alert.alert('Config error', 'Missing ASSEMBLY_API_KEY in app config.');
      return;
    }

    setStatusMessage('📤 Uploading audio...');

    // 1) Read the local file as a Blob
    const localResp = await fetch(fileUri);
    const blob = await localResp.blob();

    // 2) Upload to AssemblyAI /upload
    const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLY_API_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    });

    if (!uploadResp.ok) {
      const errText = await uploadResp.text().catch(() => '');
      throw new Error(`Upload failed: ${uploadResp.status} ${errText}`);
    }

    const { upload_url } = await uploadResp.json();

    // 3) Create transcript
    setStatusMessage('🧠 Processing transcription...');
    const createResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio_url: upload_url }),
    });

    if (!createResp.ok) {
      const errText = await createResp.text().catch(() => '');
      throw new Error(`Create transcript failed: ${createResp.status} ${errText}`);
    }

    const { id: transcriptId } = await createResp.json();

    // 4) Poll transcript
    const start = Date.now();
    const TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

    while (true) {
      const pollResp = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLY_API_KEY },
      });
      const result = await pollResp.json();

      if (result.status === 'completed') {
        const finalText = String(result.text || '').trim();
        setTranscript(finalText || '');
        setStatusMessage(finalText ? '✅ Transcription complete.' : '⚠️ No text detected in audio.');
        break;
      }

      if (result.status === 'error') {
        setTranscript('');
        setStatusMessage(`❌ Transcription failed: ${result.error || 'Unknown error'}`);
        break;
      }

      // statuses can be "queued" or "processing"
      setStatusMessage(result.status === 'queued' ? '⏳ Queued…' : '⚙️ Processing…');

      if (Date.now() - start > TIMEOUT_MS) {
        setStatusMessage('⏲️ Timed out while waiting for transcription.');
        break;
      }

      await new Promise((res) => setTimeout(res, 2500));
    }
  } catch (error: any) {
    console.error(error);
    Alert.alert('Error', 'Transcription failed.');
    setStatusMessage(`❌ Something went wrong during transcription.`);
  }
};


  const uploadAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result && Array.isArray(result.assets) && result.assets.length > 0)
      {
        transcribeAudio(result.assets[0].uri);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Upload Error', 'Could not upload file.');
    }
  };

  const startRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
      }

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone access.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setTranscript('');
      setStatusMessage('🎙️ Listening... Speak now!');
    } catch (error) {
      console.error('Start recording failed:', error);
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setStatusMessage('⏳ Preparing transcription...');
      if (uri) {
        transcribeAudio(uri);
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (error) {
      console.error('Stop recording failed:', error);
    }
  };

  return (
    <BaseScreen title="Speech-to-Text">
      <ScrollView style={[styles.outputBox, { backgroundColor: accentColor }]}>
        <Text style={[styles.transcriptText, { fontFamily, fontSize: fontSizeValue }]}>
          {statusMessage.startsWith('✅') && transcript
            ? transcript
            : statusMessage || 'Your transcript will appear here.'}
        </Text>
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, isRecording && styles.buttonStop]}
        onPress={isRecording ? stopRecording : startRecording}
      >
        <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={uploadAudioFile}>
        <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>
          Upload Audio File
        </Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  outputBox: {
    flex: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  transcriptText: {
    color: '#333',
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonStop: {
    backgroundColor: '#aa0000',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
