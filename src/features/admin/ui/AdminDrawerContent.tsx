import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabaseClient';

function initialsFrom(name?: string | null, email?: string | null) {
  const src = (name || email || '').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const AdminCustomDrawer: React.FC<DrawerContentComponentProps> = (props) => {
  const [displayName, setDisplayName] = useState<string>('Loading…');
  const [email, setEmail] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return;
    const meta = (u.user_metadata as any) || {};
    const uname = meta.username;
    const avatar = meta.avatar_url || null;

    setDisplayName(uname || u.email || '');
    setEmail(u.email || '');
    setAvatarUrl(avatar);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  // refresh when drawer gains focus (e.g., after saving profile)
  useFocusEffect(useCallback(() => { loadUser(); }, [loadUser]));

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          props.navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  // tiny cache-buster so a newly uploaded avatar shows immediately
  const avatarSrc = avatarUrl ? { uri: avatarUrl + (avatarUrl.includes('?') ? '&' : '?') + 't=' + Date.now() } : null;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      {/* Header */}
      <TouchableOpacity
        style={styles.profile}
        activeOpacity={0.8}
        onPress={() => props.navigation.navigate('AdminProfile')}
        accessibilityRole="button"
        accessibilityLabel="Open admin profile"
      >
        {avatarSrc ? (
          <Image source={avatarSrc} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarTxt}>{initialsFrom(displayName, email)}</Text>
          </View>
        )}
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.name}>{displayName}</Text>
          {!!email && <Text style={styles.email}>{email}</Text>}
        </View>
      </TouchableOpacity>

      {/* Items */}
      <TouchableOpacity style={styles.row} onPress={() => props.navigation.navigate('AdminHelpEditor')}>
        <View style={styles.iconWrapper}><Ionicons name="help-circle-outline" size={22} color="#333" /></View>
        <Text style={styles.item}>Help</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => props.navigation.navigate('AdminAboutEditor')}>
        <View style={styles.iconWrapper}><Ionicons name="information-circle-outline" size={22} color="#333" /></View>
        <Text style={styles.item}>About Us</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => props.navigation.navigate('AdminFeedback')}>
        <View style={styles.iconWrapper}><Ionicons name="chatbubble-ellipses-outline" size={22} color="#333" /></View>
        <Text style={styles.item}>Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={handleLogout}>
        <View style={styles.iconWrapper}><Ionicons name="log-out-outline" size={22} color="#333" /></View>
        <Text style={[styles.item, { fontWeight: 'bold' }]}>Logout</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const AVATAR_SIZE = 44;

const styles = StyleSheet.create({
  container: { paddingVertical: 30, paddingHorizontal: 20, flexGrow: 1, backgroundColor: '#fff9c4' },
  profile: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingLeft: 4 },
  avatarImg: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: '#ffe085' },
  avatarFallback: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: '#ffe085', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: '#333' },
  name: { color: '#111', fontWeight: '800', fontSize: 16 },
  email: { color: '#555', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingLeft: 20 },
  iconWrapper: { width: 26, alignItems: 'center' },
  item: { marginLeft: 16, color: '#222', fontSize: 16 },
});

export default AdminCustomDrawer;
