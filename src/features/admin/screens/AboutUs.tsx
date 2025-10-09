//screens/admin/AboutUs.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';

const ABOUT_KEY = 'about';

const DEFAULT_ABOUT = `
# About Us

## Welcome to Synclexia
Synclexia is an AI-powered reading and writing assistance tool designed to support children and learners with dyslexia. Our mission is to make literacy more accessible through technology, personalization, and compassion.

## Our Mission
We aim to empower dyslexic learners by providing adaptive tools that strengthen reading and writing skills. By combining synthetic phonics, AI-driven feedback, and interactive exercises, we help learners build confidence step by step.

## Our Story
We created Synclexia with one goal in mind: to bridge the gap for learners who struggle with traditional reading methods. Inspired by real challenges faced by dyslexic students, we designed a tool that makes learning engaging, supportive, and inclusive.

## What We Offer
- AI Reading Assistance – Real-time support for reading comprehension.
- Speech-to-Text & Text-to-Speech – Helping learners express themselves more easily.
- Phonics-Based Exercises – Reinforcing literacy skills with proven methods.
- Image-to-Text Recognition – Scan images and choose to copy or listen to the text.

## Behind Synclexia
Synclexia was developed by a passionate team of student innovators from *UCLM College of Computer Studies*:

- **Hijara, Adona Eve P.** – *Project Manager*  
  Guides the overall direction of the project, ensuring smooth collaboration, timely progress, and that the app stays true to its mission.

- **Mahilum, Kimberly O.** – *Programmer*  
  Handles the technical side of development, focusing on coding, AI integration, and system functionality.

- **Mapula, Nica P.** – *UI/UX Designer*  
  Creates user-friendly and engaging designs to make the app simple, intuitive, and enjoyable for learners.

- **Cagang, Ana Mae Rose T.** – *Documentation*  
  Prepares and manages research, reports, and written materials to keep the project well-documented and structured.

- **Lubas, Renz Dy** – *Quality Assurance*  
  Tests and evaluates the app to ensure accuracy, reliability, and a smooth user experience.

## Our Vision
A world where every learner, regardless of challenges, can confidently read, write, and express their ideas.

## Connect With Us
- Email: support@synclexia.com  
- Website: https://www.synclexia.com
`.trim();

export default function AdminAboutEditorScreen() {
  const { fontFamily } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markdown, setMarkdown] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('site_pages').select('markdown').eq('key', ABOUT_KEY).maybeSingle();
    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }
    if (data?.markdown != null) setMarkdown(data.markdown);
    else setMarkdown(DEFAULT_ABOUT);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('site_pages')
      .upsert({ key: ABOUT_KEY, markdown }, { onConflict: 'key' });
    setSaving(false);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Saved', 'About page updated.');
  };

  return (
    <BaseScreen title="Edit About" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { fontFamily }]}>Markdown content</Text>
          <TextInput
            style={[styles.input, { fontFamily }]}
            value={markdown}
            onChangeText={setMarkdown}
            multiline
            textAlignVertical="top"
            placeholder="# About Us"
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
              <Text style={[styles.btnTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={() => setMarkdown(DEFAULT_ABOUT)}
              disabled={saving}
            >
              <Text style={[styles.btnGhostTxt, { fontFamily }]}>Reset to template</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6 },
  input: { minHeight: 420, borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  btn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  btnTxt: { fontWeight: '800', color: '#1c1c1c' },
  btnGhost: { borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#fff' },
  btnGhostTxt: { fontWeight: '700', color: '#222' },
});
