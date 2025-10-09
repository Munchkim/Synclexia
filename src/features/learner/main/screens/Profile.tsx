import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAppSettings } from '../../../../../src/context/AppSettings';
import { supabase } from '../../../../../src/lib/supabaseClient';
import BaseScreen from '../../../../components/BaseScreen';

type ProfileRow = {
  username: string | null;
  birthdate: string | null;
  last_birthdate_update: string | null; 
};

export default function AccountScreen() {
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthdate, setBirthdate] = useState(''); 
  const [age, setAge] = useState<string>('');    
  const [lastBirthUpdate, setLastBirthUpdate] = useState<Date | null>(null);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingBirthdate, setIsEditingBirthdate] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const calcAgeFromBirthdate = (isoYmd: string | null): string => {
    if (!isoYmd) return '';
    const parts = isoYmd.split('-').map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '';
    const [y, m, d] = parts;
    const today = new Date();
    let age = today.getFullYear() - y;
    const mDiff = today.getMonth() + 1 - m;
    const dDiff = today.getDate() - d;
    if (mDiff < 0 || (mDiff === 0 && dDiff < 0)) age -= 1;
    return String(Math.max(age, 0));
  };

  const isValidYmd = (s: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    const dt = new Date(s + 'T00:00:00');
    if (Number.isNaN(dt.getTime())) return false;
    const today = new Date();
    return dt <= today;
  };

  const canEditBirthdate = useMemo(() => {
    if (!lastBirthUpdate) return true; 
    const now = new Date();
    const diff = now.getTime() - lastBirthUpdate.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days >= 365;
  }, [lastBirthUpdate]);

  const fetchUserInfo = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('users')
      .select('username, birthdate, last_birthdate_update')
      .eq('id', user.id)
      .single<ProfileRow>();

    if (!error && data) {
      setUsername(data.username ?? '');
      setBirthdate(data.birthdate ?? '');
      setAge(calcAgeFromBirthdate(data.birthdate ?? null));
      setEmail(user.email ?? '');
      setNewEmail(user.email ?? '');
      setLastBirthUpdate(data.last_birthdate_update ? new Date(data.last_birthdate_update) : null);
    } else {
      setUsername(user.user_metadata?.username ?? '');
      setEmail(user.email ?? '');
      setNewEmail(user.email ?? '');
      setBirthdate('');
      setAge('');
      setLastBirthUpdate(null);
    }

    setLoading(false);
  };

  const handleUpdateUsername = async () => {
    const u = username.trim();
    if (!u) {
      Alert.alert('Invalid Input', 'Please enter a valid username.');
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { error: authError } = await supabase.auth.updateUser({ data: { username: u } });
    const { error: dbError } = await supabase.from('users').update({ username: u }).eq('id', user.id);

    setSaving(false);
    if (authError || dbError) {
      const msg =
        (dbError?.message || authError?.message || 'Failed to update username.')
          .replace('duplicate key value violates unique constraint', 'Username already taken.');
      Alert.alert('Error', msg);
      return;
    }
    Alert.alert('Success', 'Username updated successfully.');
    setIsEditingUsername(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password changed successfully.');
      setNewPassword('');
      setShowPasswordInput(false);
    }
  };

  const handleUpdateEmail = async () => {
    const e = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email: e });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Check your inbox', 'We sent a confirmation link to your new email. Please confirm to complete the change.');
    setIsEditingEmail(false);
    setEmail(e);
  };

  const handleUpdateBirthdate = async () => {
    const bd = birthdate.trim();
    if (!isValidYmd(bd)) {
      Alert.alert('Invalid Birthdate', 'Please use YYYY-MM-DD and avoid future dates.');
      return;
    }
    if (!canEditBirthdate) {
      const nextAllowed = lastBirthUpdate ? new Date(lastBirthUpdate.getTime() + 365 * 24 * 60 * 60 * 1000) : null;
      Alert.alert(
        'Edit limit',
        nextAllowed
          ? `Birthdate can be edited once per year.\nTry again after ${nextAllowed.toDateString()}.`
          : 'Birthdate can be edited once per year.'
      );
      return;
    }
    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { error } = await supabase
      .from('users')
      .update({
        birthdate: bd,
        last_birthdate_update: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message || 'Failed to update birthdate.');
      return;
    }
    setIsEditingBirthdate(false);
    setAge(calcAgeFromBirthdate(bd));
    setLastBirthUpdate(new Date());
    Alert.alert('Success', 'Birthdate updated.');
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
        {/* USERNAME */}
        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Username</Text>
        {isEditingUsername ? (
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
        {!isEditingUsername ? (
          <TouchableOpacity style={styles.button} onPress={() => setIsEditingUsername(true)}>
            <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Edit Username</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handleUpdateUsername} disabled={saving}>
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Save Username'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={() => {
                setIsEditingUsername(false);
                fetchUserInfo();
              }}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Email</Text>
        {isEditingEmail ? (
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        ) : (
          <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>{email || 'Not set'}</Text>
        )}
        {!isEditingEmail ? (
          <TouchableOpacity style={styles.button} onPress={() => setIsEditingEmail(true)}>
            <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Edit Email</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handleUpdateEmail} disabled={saving}>
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Save Email'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={() => {
                setIsEditingEmail(false);
                setNewEmail(email);
              }}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Password</Text>
        <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>********</Text>
        {!showPasswordInput ? (
          <TouchableOpacity style={styles.button} onPress={() => setShowPasswordInput(true)}>
            <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Change Password</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Enter new password"
              style={[styles.input, { fontFamily, fontSize: fontSizeValue }]}
            />
            <TouchableOpacity style={styles.button} onPress={handleChangePassword} disabled={saving}>
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Save Password'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={() => {
                setShowPasswordInput(false);
                setNewPassword('');
              }}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Birthdate</Text>
        {isEditingBirthdate ? (
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
        {!isEditingBirthdate ? (
          <TouchableOpacity
            style={[styles.button, { opacity: canEditBirthdate ? 1 : 0.6 }]}
            onPress={() => {
              if (!canEditBirthdate) {
                const nextAllowed = lastBirthUpdate
                  ? new Date(lastBirthUpdate.getTime() + 365 * 24 * 60 * 60 * 1000)
                  : null;
                Alert.alert(
                  'Edit limit',
                  nextAllowed
                    ? `Birthdate can be edited once per year.\nTry again after ${nextAllowed.toDateString()}.`
                    : 'Birthdate can be edited once per year.'
                );
                return;
              }
              setIsEditingBirthdate(true);
            }}
          >
            <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Edit Birthdate</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handleUpdateBirthdate} disabled={saving}>
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>{saving ? 'Saving…' : 'Save Birthdate'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#aaa' }]}
              onPress={() => {
                setIsEditingBirthdate(false);
                fetchUserInfo();
              }}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { fontFamily, fontSize: fontSizeValue }]}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.label, { fontFamily, fontSize: fontSizeValue }]}>Age</Text>
        <Text style={[styles.value, { fontFamily, fontSize: fontSizeValue }]}>
          {age ? `${age} years` : 'Not set'}
        </Text>
      </View>
    </BaseScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 24,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 12,
    color: '#333',
  },
  value: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  text: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginTop: 40,
  },
});
