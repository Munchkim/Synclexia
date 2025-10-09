import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { useAppSettings } from '../../../../../src/context/AppSettings';
import { useUser } from '../../../../../src/context/UserContext';
import { supabase } from '../../../../lib/supabaseClient';
import { fetchLearnerUnreadCount } from '../../../notifications/api';

type NavigationProps = DrawerNavigationProp<any>;

const DashboardScreen = () => {
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { user } = useUser(); 

  const [userName, setUserName] = useState<string>('');

  const [totalLessons, setTotalLessons] = useState<number>(0);
  const [readingDone, setReadingDone] = useState<number>(0);
  const [writingDone, setWritingDone] = useState<number>(0);
  const [lastReading, setLastReading] = useState<string | null>(null);
  const [lastWriting, setLastWriting] = useState<string | null>(null);

  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;
  const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data } = await supabase.from('users').select('username').eq('id', authData.user.id).single();
        setUserName(data?.username || 'User');
      }
    })();
  }, []);

  const fetchProgressSummary = useCallback(async () => {
    const { data: ud } = await supabase.auth.getUser();
    const me = ud?.user;
    if (!me) return;

    const { count: lessonsCount } = await supabase
      .from('phonics_lessons')
      .select('id', { count: 'exact', head: true });
    setTotalLessons(lessonsCount ?? 0);

    const { count: rdCount } = await supabase
      .from('lesson_progress')
      .select('lesson_id', { count: 'exact', head: true })
      .eq('user_id', me.id)
      .eq('mode', 'reading')
      .eq('completed', true);
    setReadingDone(rdCount ?? 0);

    const { count: wrCount } = await supabase
      .from('lesson_progress')
      .select('lesson_id', { count: 'exact', head: true })
      .eq('user_id', me.id)
      .eq('mode', 'writing')
      .eq('completed', true);
    setWritingDone(wrCount ?? 0);

    const { data: lastR } = await supabase
      .from('lesson_progress')
      .select('completed_at')
      .eq('user_id', me.id)
      .eq('mode', 'reading')
      .eq('completed', true)
      .order('completed_at', { ascending: false })
      .limit(1);

    const { data: lastW } = await supabase
      .from('lesson_progress')
      .select('completed_at')
      .eq('user_id', me.id)
      .eq('mode', 'writing')
      .eq('completed', true)
      .order('completed_at', { ascending: false })
      .limit(1);

    setLastReading(lastR?.[0]?.completed_at ?? null);
    setLastWriting(lastW?.[0]?.completed_at ?? null);
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    const n = await fetchLearnerUnreadCount(user.id);
    setUnreadCount(n);
  }, [user?.id]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      fetchProgressSummary();
      refreshUnread();
    });

    fetchProgressSummary();
    refreshUnread();
    return unsub;
  }, [navigation, fetchProgressSummary, refreshUnread]);

  useEffect(() => {
    const channel = supabase
      .channel('progress-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, () => {
        fetchProgressSummary();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProgressSummary]);


  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif_learner_badge_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'audience=eq.learner' },
        (payload) => {
          const newer: any = (payload as any).new || {};
          const older: any = (payload as any).old || {};
          const touchedUserId = newer?.user_id ?? older?.user_id;
          if (touchedUserId === user.id) {
            refreshUnread();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, refreshUnread]);

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../../../../assets/icons/logo.png')} style={styles.logo} />
          <Text style={[styles.logoText, { fontFamily, fontSize: fontSizeValue + 2 }]}>SYNCLEXIA</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications' as never)}>
            <View>
              <Ionicons name="notifications-outline" size={28} color="black" style={styles.icon} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: accentColor }]}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.openDrawer()}>
            <Ionicons name="menu" size={32} color="black" style={styles.icon} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.greeting}>
        <Text style={[styles.helloText, { fontFamily, fontSize: fontSizeValue + 8 }]}>Hello, {userName}!</Text>
        <Text style={[styles.subText, { fontFamily, fontSize: fontSizeValue }]}>Welcome to your dashboard!</Text>
      </View>

      <Text style={[styles.sectionTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>Let's start learning!</Text>
      <View style={styles.featureRow}>
        <TouchableOpacity
          style={[styles.featureBox, { backgroundColor: accentColor }]}
          onPress={() => navigation.navigate('Phonics' as never)}
        >
          <Text style={[styles.featureText, { fontFamily, fontSize: fontSizeValue }]}>Phonics</Text>
          <Image source={require('../../../../../assets/icons/phonics.png')} style={styles.featureIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureBox, { backgroundColor: accentColor }]}
          onPress={() => navigation.navigate('MainPracticeScreen' as never)}
        >
          <Text style={[styles.featureText, { fontFamily, fontSize: fontSizeValue }]}>Practice</Text>
          <Image source={require('../../../../../assets/icons/writing.png')} style={styles.featureIcon} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureBox, { backgroundColor: accentColor }]}
          onPress={() => navigation.navigate('Games' as never)}
        >
          <Text style={[styles.featureText, { fontFamily, fontSize: fontSizeValue }]}>Games</Text>
          <Image source={require('../../../../../assets/icons/reading.png')} style={styles.featureIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBox}>
        <Text style={[styles.sectionTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>
          Here’s your progress so far…
        </Text>

        {totalLessons === 0 ? (
          <>
            <Text style={[styles.oopsText, { fontFamily, fontSize: fontSizeValue + 10 }]}>Oops!!</Text>
            <Text style={[styles.oopsSubText, { fontFamily, fontSize: fontSizeValue }]}>No lessons found yet.</Text>
          </>
        ) : (
          <>
            <View style={{ width: '90%', marginTop: 10 }}>
              <Text style={{ fontFamily, marginBottom: 6 }}>
                ✍️ Writing: {writingDone}/{totalLessons} ({percent(writingDone, totalLessons)}%)
              </Text>
              <View style={{ height: 12, backgroundColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                <View style={{ width: `${percent(writingDone, totalLessons)}%`, height: '100%', backgroundColor: accentColor }} />
              </View>
              {lastWriting && (
                <Text style={{ fontFamily, fontSize: fontSizeValue - 2, color: '#666', marginTop: 4 }}>
                  Last writing activity: {new Date(lastWriting).toLocaleString()}
                </Text>
              )}
            </View>

            <View style={{ width: '90%', marginTop: 16 }}>
              <Text style={{ fontFamily, marginBottom: 6 }}>
                📣 Reading: {readingDone}/{totalLessons} ({percent(readingDone, totalLessons)}%)
              </Text>
              <View style={{ height: 12, backgroundColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
                <View style={{ width: `${percent(readingDone, totalLessons)}%`, height: '100%', backgroundColor: accentColor }} />
              </View>
              {lastReading && (
                <Text style={{ fontFamily, fontSize: fontSizeValue - 2, color: '#666', marginTop: 4 }}>
                  Last reading activity: {new Date(lastReading).toLocaleString()}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      <View style={[styles.bottomBar, { backgroundColor: accentColor }]}>
        <TouchableOpacity style={styles.bottomItem} onPress={() => navigation.navigate('TTS' as never)}>
          <MaterialIcons name="record-voice-over" size={30} color="#000" />
          <Text style={[styles.bottomText, { fontFamily, fontSize: fontSizeValue - 3 }]}>Text-to-speech</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomItem} onPress={() => navigation.navigate('Scan' as never)}>
          <Ionicons name="camera" size={30} color="#000" />
          <Text style={[styles.bottomText, { fontFamily, fontSize: fontSizeValue - 3 }]}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomItem} onPress={() => navigation.navigate('STT' as never)}>
          <FontAwesome name="microphone" size={30} color="#000" />
          <Text style={[styles.bottomText, { fontFamily, fontSize: fontSizeValue - 3 }]}>Speech-to-text</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 32, height: 32, resizeMode: 'contain', marginRight: 6 },
  logoText: { fontWeight: 'bold', color: '#333' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginLeft: 20 },

  badge: {
    position: 'absolute',
    right: -8,
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  greeting: { paddingHorizontal: 20, marginBottom: 10 },
  helloText: { fontWeight: 'bold', color: '#333' },
  subText: { color: '#333' },
  sectionTitle: { fontWeight: '600', marginLeft: 20, marginTop: 10, marginBottom: 8, color: '#000' },
  featureRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10, marginBottom: 20 },
  featureBox: { width: 100, height: 100, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  featureText: { fontWeight: 'bold' },
  featureIcon: { width: 40, height: 40, marginTop: 6, resizeMode: 'contain' },
  progressBox: { marginTop: 10, alignItems: 'center', paddingHorizontal: 20 },
  oopsText: { fontWeight: 'bold', fontStyle: 'italic', color: '#444' },
  oopsSubText: { marginTop: 5, color: '#555' },
  bottomBar: {
    position: 'absolute',
    paddingBottom: 30,
    bottom: 0,
    width: '100%',
    height: 105,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 6,
  },
  bottomItem: { alignItems: 'center' },
  bottomText: { marginTop: 4, color: '#333' },
});

export default DashboardScreen;
