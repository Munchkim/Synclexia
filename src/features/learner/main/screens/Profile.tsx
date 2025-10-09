import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import BaseScreen from '../../../../components/BaseScreen';
import { useAppSettings } from '../../../../context/AppSettings';
import { supabase } from '../../../../lib/supabaseClient';

type ProfileRow = {
  username: string | null;
  birthdate: string | null;
  last_birthdate_update: string | null;
};

const isValidYmd = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(`${s}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt <= new Date();
};

const calcAgeFromBirthdate = (isoYmd: string | null): string => {
  if (!isoYmd) return '';
  const [y, m, d] = isoYmd.split('-').map((p) => parseInt(p, 10));
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return String(Math.max(age, 0));
};

export default function AccountScreen() {
  const navigation = useNavigation<any>();
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [age, setAge] = useState<string>('');

  // password controls
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [lastBirthUpdate, setLastBirthUpdate] = useState<Date | null>(null);
  const original = useRef({ username: '', email: '', birthdate: '' });

  const canEditBirthdate = useMemo(() => {
    if (!lastBirthUpdate) return true;
    return Date.now() - lastBirthUpdate.getTime() >= 365 * 24 * 60 * 60 * 1000;
  }, [lastBirthUpdate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('users')
        .select('username, birthdate, last_birthdate_update')
        .eq('id', user.id)
        .single<ProfileRow>();

      if (!error && data) {
        const bd = data.birthdate ?? '';
        setUsername(data.username ?? '');
        setBirthdate(bd);
        setAge(calcAgeFromBirthdate(bd || null));
        setEmail(user.email ?? '');
        setLastBirthUpdate(data.last_birthdate_update ? new Date(data.last_birthdate_update) : null);
        original.current = { username: data.username ?? '', email: user.email ?? '', birthdate: bd };
      } else {
        const uname = user.user_metadata?.username ?? '';
        setUsername(uname);
        setEmail(user.email ?? '');
        setBirthdate('');
        setAge('');
        setLastBirthUpdate(null);
        original.current = { username: uname, email: user.email ?? '', birthdate: '' };
      }
      setLoading(false);
    })();
  }, []);

  const reauthenticate = async () => {
    const emailToUse = original.current.email;
    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: currentPassword,
    });
    return error || null;
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error('No session');

      const uname = username.trim();
      const newEmail = email.trim();
      const bd = birthdate.trim();

      const changedUsername = uname !== original.current.username;
      const changedEmail = newEmail !== original.current.email;
      const changedBirthdate = bd !== original.current.birthdate;
      const wantsNewPassword = !!newPassword;

      if (!uname) throw new Error('Please enter a valid username.');
      if (bd && !isValidYmd(bd)) throw new Error('Birthdate must be YYYY-MM-DD and not in the future.');

      if (changedBirthdate && !canEditBirthdate) {
        const nextAllowed = lastBirthUpdate ? new Date(lastBirthUpdate.getTime() + 365 * 24 * 60 * 60 * 1000) : null;
        throw new Error(nextAllowed
          ? `Birthdate can be edited once per year. Try again after ${nextAllowed.toDateString()}.`
          : 'Birthdate can be edited once per year.');
      }

      // Require current password for email/password changes
      if ((changedEmail || wantsNewPassword) && !currentPassword) {
        throw new Error('Please enter your current password to confirm changes.');
      }
      if (changedEmail || wantsNewPassword) {
        const err = await reauthenticate();
        if (err) throw new Error(err.message || 'Current password is incorrect.');
      }

      // Auth updates
      const authUpd: any = {};
      const newMeta: any = { ...(user.user_metadata || {}) };
      if (changedUsername) newMeta.username = uname;
      authUpd.data = newMeta;

      if (changedEmail) authUpd.email = newEmail;
      if (wantsNewPassword) authUpd.password = newPassword;

      if (changedEmail || wantsNewPassword || changedUsername) {
        const { error: authErr } = await supabase.auth.updateUser(authUpd);
        if (authErr) throw authErr;
      }

      // DB updates
      if (changedUsername || changedBirthdate) {
        const upd: any = { updated_at: new Date().toISOString() };
        if (changedUsername) upd.username = uname;
        if (changedBirthdate) {
          upd.birthdate = bd || null;
          upd.last_birthdate_update = new Date().toISOString();
        }
        const { error: dbErr } = await supabase.from('users').update(upd).eq('id', user.id);
        if (dbErr) throw dbErr;
      }

      if (changedEmail) {
        Alert.alert('Check your inbox', 'We sent a confirmation link to your new email. Please confirm to complete the change.');
      } else {
        Alert.alert('Saved', 'Profile updated.');
      }

      original.current = { username: uname, email: newEmail, birthdate: bd };
      setAge(calcAgeFromBirthdate(bd || null));
      if (changedBirthdate) setLastBirthUpdate(new Date());

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
    setBirthdate(original.current.birthdate);
    setAge(calcAgeFromBirthdate(original.current.birthdate || null));
    setCurrentPassword('');
    setNewPassword('');
    setEditing(false);
  };

  if (loading) {
    return (
      <BaseScreen title="Account">
        <Text style={[styles.text, { fontFamily, fontSize: fontSizeValue }]}>Loading...</Text>
      </BaseScreen>
    );
  }

  return (
    <BaseScreen title="Account" showBack>
      <View style={[styles.card, { backgroundColor: accentColor }]}>
        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Username</Text>
        {editing ? (
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>{username || 'Not set'}</Text>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Email</Text>
        {editing ? (
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        ) : (
          <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>{email || 'Not set'}</Text>
        )}

        {editing && (
          <>
            <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>
              Current password (required for email/password changes)
            </Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              placeholder="Enter current password"
              style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={[styles.link, { fontFamily }]}>Forgot password?</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password (leave blank to keep)"
              style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
              autoCapitalize="none"
            />
          </>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Birthdate</Text>
        {editing ? (
          <TextInput
            value={birthdate}
            onChangeText={setBirthdate}
            placeholder="YYYY-MM-DD"
            style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            keyboardType="numeric"
            autoCapitalize="none"
          />
        ) : (
          <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>{birthdate || 'Not set'}</Text>
        )}
        {!editing && !canEditBirthdate ? (
          <Text style={[styles.note, { fontFamily }]}>Birthdate can be edited once per year.</Text>
        ) : null}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Age</Text>
        <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>{age ? `${age} years` : 'Not set'}</Text>

        {!editing ? (
          <TouchableOpacity style={styles.button} onPress={() => setEditing(true)}>
            <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={[styles.button, { opacity: saving ? 0.6 : 1 }]} onPress={saveProfile} disabled={saving}>
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={cancel}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 20, marginHorizontal: 24 },
  label: { fontWeight: '600', marginBottom: 4, marginTop: 12, color: '#333' },
  value: { fontSize: 16, marginBottom: 8, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, borderRadius: 8, marginBottom: 12, backgroundColor: '#fff' },
  button: { backgroundColor: '#333', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  text: { fontSize: 18, color: '#333', textAlign: 'center', marginTop: 40 },
  note: { color: '#666', fontSize: 12, marginTop: 4 },
  link: { color: '#3366cc', marginBottom: 8, marginTop: -6 },
});
