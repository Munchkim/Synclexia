import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../../src/context/AppSettings';
import { supabase } from '../../../../src/lib/supabaseClient';
import { uploadPublicFile } from '../../../../src/lib/storage/upload';

const AVATAR_BUCKET = 'avatars';

export default function AdminProfileScreen() {
  const { fontFamily } = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (!u) {
      Alert.alert('Not signed in', 'Please log in again.');
      setLoading(false);
      return;
    }
    setName((u.user_metadata as any)?.full_name || '');
    setEmail(u.email || '');
    setAvatarUrl((u.user_metadata as any)?.avatar_url || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    try {
      const url = await uploadPublicFile(AVATAR_BUCKET, `admin/${Date.now()}_${asset.fileName || 'avatar'}`, asset.uri);
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert('Upload error', e.message);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      if (!u) throw new Error('No session');

      const { error: authErr } = await supabase.auth.updateUser({
        email: email || undefined,
        data: { full_name: name || '', avatar_url: avatarUrl || null },
      });
      if (authErr) throw authErr;

      try {
        await supabase.from('profiles').upsert(
          { id: u.id, full_name: name || '', avatar_url: avatarUrl || null, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      } catch {}

      Alert.alert('Saved', 'Profile updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseScreen title="Manage Profile" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <View>
          <View style={styles.row}>
            <Image source={{ uri: avatarUrl || 'https://placehold.co/120x120?text=Avatar' }} style={styles.avatar} />
            <TouchableOpacity onPress={pickAvatar} style={styles.btn}>
              <Text style={[styles.btnTxt, { fontFamily }]}>Change Photo</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { fontFamily }]}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" />

          <Text style={[styles.label, { fontFamily }]}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />

          <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
            <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>

          <Text style={[styles.note, { fontFamily }]}>
            Tip: If your project uses a `profiles` table, this screen also upserts your name/avatar there.
          </Text>
        </View>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eee', borderWidth: 1, borderColor: '#e6ebf1' },

  label: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff' },

  btn: { borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  btnTxt: { fontWeight: '700', color: '#111' },

  saveBtn: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontWeight: '800', color: '#1c1c1c' },
  note: { color: '#666', fontSize: 12, marginTop: 8 },
});
