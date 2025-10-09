import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

import BaseScreen from '../../../components/BaseScreen';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import { uploadPublicFile } from '../../../lib/storage/upload';

const AVATAR_BUCKET = 'avatars';

export default function AdminProfileScreen() {
  const navigation = useNavigation<any>();
  const { fontFamily } = useAppSettings();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const original = useRef({ username: '', email: '', avatarUrl: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;
    if (!u) {
      Alert.alert('Not signed in', 'Please log in again.');
      setLoading(false);
      return;
    }
    const meta = (u.user_metadata as any) || {};
    const uname = meta.username || '';
    const avatar = meta.avatar_url || '';

    setUsername(uname);
    setEmail(u.email || '');
    setAvatarUrl(avatar || null);
    original.current = { username: uname, email: u.email || '', avatarUrl: avatar || '' };
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickAvatar = async () => {
    if (!editing) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (res.canceled || !res.assets?.length) return;

    const asset = res.assets[0];
    try {
      const { data: ud } = await supabase.auth.getUser();
      const u = ud?.user;
      if (!u) throw new Error('No session');

      const ext = (asset.fileName || asset.uri).split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${u.id}/avatar_${Date.now()}.${ext}`; // per-user folder
      const url = await uploadPublicFile(AVATAR_BUCKET, path, asset.uri);
      setAvatarUrl(url);
    } catch (e: any) {
      Alert.alert('Upload error', e.message);
    }
  };

  const reauthenticate = async () => {
    // verify current password by signing in again
    const emailToUse = original.current.email;
    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: currentPassword,
    });
    return error || null;
  };

  const save = async () => {
    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user;
      if (!u) throw new Error('No session');

      const changedUsername = username.trim() !== original.current.username;
      const changedEmail = email.trim() !== original.current.email;
      const wantsNewPassword = !!newPassword;

      // If changing email or password, require current password
      if ((changedEmail || wantsNewPassword) && !currentPassword) {
        throw new Error('Please enter your current password to confirm changes.');
      }
      if (changedEmail || wantsNewPassword) {
        const err = await reauthenticate();
        if (err) throw new Error(err.message || 'Current password is incorrect.');
      }

      // Build auth update payload
      const authUpd: any = {};
      const newMeta: any = { ...(u.user_metadata || {}) };
      if (changedUsername) newMeta.username = username.trim();
      if (avatarUrl !== original.current.avatarUrl) newMeta.avatar_url = avatarUrl || null;
      authUpd.data = newMeta;

      if (changedEmail) authUpd.email = email.trim();
      if (wantsNewPassword) authUpd.password = newPassword;

      if (changedEmail || wantsNewPassword || changedUsername || avatarUrl !== original.current.avatarUrl) {
        const { error: authErr } = await supabase.auth.updateUser(authUpd);
        if (authErr) throw authErr;
      }

      // Mirror to app tables (best effort)
      try {
        await supabase.from('users').upsert(
          { id: u.id, username: username.trim() || null, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      } catch {}
      try {
        await supabase.from('profiles').upsert(
          { id: u.id, full_name: username.trim() || '', avatar_url: avatarUrl || null, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      } catch {}

      if (changedEmail) {
        Alert.alert('Check your inbox', 'We sent a confirmation link to your new email. Please confirm to complete the change.');
      } else {
        Alert.alert('Saved', 'Profile updated.');
      }

      original.current = { username: username.trim(), email: email.trim(), avatarUrl: avatarUrl || '' };
      setCurrentPassword('');
      setNewPassword('');
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setUsername(original.current.username);
    setEmail(original.current.email);
    setAvatarUrl(original.current.avatarUrl || null);
    setCurrentPassword('');
    setNewPassword('');
    setEditing(false);
  };

  const avatarSrc =
    avatarUrl ? { uri: avatarUrl + (avatarUrl.includes('?') ? '&' : '?') + 't=' + Date.now() } : null;

  return (
    <BaseScreen title="Manage Profile" showBack>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <View>
          <View style={styles.row}>
            {avatarSrc ? (
              <Image source={avatarSrc} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: '#eee' }]} />
            )}
            <TouchableOpacity onPress={pickAvatar} style={[styles.btn, !editing && { opacity: 0.5 }]}>
              <Text style={[styles.btnTxt, { fontFamily }]}>{editing ? 'Change Photo' : 'View Only'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { fontFamily }]}>Username</Text>
          {editing ? (
            <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
          ) : (
            <Text style={styles.value}>{username || 'Not set'}</Text>
          )}

          <Text style={[styles.label, { fontFamily }]}>Email</Text>
          {editing ? (
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          ) : (
            <Text style={styles.value}>{email || 'Not set'}</Text>
          )}

          {editing && (
            <>
              <Text style={[styles.label, { fontFamily }]}>Current password (required for email/password changes)</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { fontFamily }]}>New password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Enter new password (leave blank to keep)"
                autoCapitalize="none"
              />
            </>
          )}

          {!editing ? (
            <TouchableOpacity style={styles.saveBtn} onPress={() => setEditing(true)}>
              <Text style={[styles.saveTxt, { fontFamily }]}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity style={[styles.saveBtn, { opacity: saving ? 0.6 : 1 }]} onPress={save} disabled={saving}>
                <Text style={[styles.saveTxt, { fontFamily }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#eee' }]} onPress={cancel} disabled={saving}>
                <Text style={[styles.saveTxt, { fontFamily }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: '#e6ebf1' },
  label: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6, marginTop: 8 },
  value: { fontSize: 16, marginBottom: 8, color: '#555' },
  input: { borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 10, padding: 10, backgroundColor: '#fff' },
  btn: { borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff' },
  btnTxt: { fontWeight: '700', color: '#111' },
  saveBtn: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe6ee', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontWeight: '800', color: '#1c1c1c' },
  link: { color: '#3366cc', marginTop: 6, marginBottom: 6 },
});
