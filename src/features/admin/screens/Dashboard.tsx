import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  RefreshControl, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppSettings } from '../../../context/AppSettings';
import { supabase } from '../../../lib/supabaseClient';
import tinycolor from 'tinycolor2';

type Counts = {
  learners: number;
  feedbacks: number;
  lessons: number;
  completedAttempts: number;
  unreadNotifs: number;
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { bgColor, accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [counts, setCounts] = useState<Counts>({
    learners: 0, feedbacks: 0, lessons: 0, completedAttempts: 0, unreadNotifs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tintBg = tinycolor(accentColor).setAlpha(0.12).toRgbString();
  const cardBg = tinycolor(accentColor).setAlpha(0.18).toRgbString();
  const borderCol = tinycolor(accentColor).darken(10).toHexString();
  const textDark = '#1b1b1b';

  const featureCards = [
    {
      key: 'phonics',
      label: 'Manage Phonics',
      icon: <Ionicons name="book" size={28} color={textDark} />,
      onPress: () => navigation.navigate('AdminPhonics'),
    },
    {
      key: 'accounts',
      label: 'Manage Accounts',
      icon: <Ionicons name="people" size={28} color={textDark} />,
      onPress: () => navigation.navigate('AdminAccounts'),
    },
    {
      key: 'games',
      label: 'Manage Games',
      icon: <Ionicons name="game-controller" size={28} color={textDark} />,
      onPress: () => navigation.navigate('AdminGames'),
    },
    {
      key: 'practice',
      label: 'Manage Practice',
      icon: <Ionicons name="create" size={28} color={textDark} />,
      onPress: () => navigation.navigate('AdminPractice'),
    },
  ];
  const cardsWithGhost =
    featureCards.length % 3 === 2
      ? [...featureCards, { key: 'ghost', label: '', icon: null, onPress: () => {} }]
      : featureCards;

  const fetchCounts = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);

      const [{ count: learnersCount }, { count: fbCount }, { count: lessonsCount }, { count: completedCount }] =
        await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'learner'),
          supabase.from('feedbacks').select('*', { count: 'exact', head: true }),
          supabase.from('phonics_lessons').select('*', { count: 'exact', head: true }),
          supabase.from('lesson_progress').select('*', { count: 'exact', head: true }).eq('completed', true),
        ]);

      const { count: unreadAdminCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('audience', 'admin')
        .eq('read', false);

      setCounts(c => ({
        ...c,
        learners: learnersCount ?? 0,
        feedbacks: fbCount ?? 0,
        lessons: lessonsCount ?? 0,
        completedAttempts: completedCount ?? 0,
        unreadNotifs: unreadAdminCount ?? 0,
      }));
    } catch (err: any) {
      console.log('AdminDashboard fetchCounts error:', err?.message || err);
      setError('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCounts(); }, [fetchCounts]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCounts();
    setRefreshing(false);
  }, [fetchCounts]);

  useEffect(() => {
    const ch = supabase
      .channel('admin-dashboard-notifs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'audience=eq.admin' },
        () => fetchCounts()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCounts]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: bgColor }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentColor} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Image source={require('../../../../assets/icons/logo.png')} style={styles.logo} />
          <Text style={[styles.logoText, { fontFamily, fontSize: fontSizeValue + 2 }]}>SYNCLEXIA</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate('AdminNotifications')}>
            <View>
              <Ionicons name="notifications-outline" size={26} color={textDark} />
              {counts.unreadNotifs > 0 && (
                <View style={[styles.badge, { backgroundColor: accentColor }]}>
                  <Text style={styles.badgeText}>
                    {counts.unreadNotifs > 99 ? '99+' : counts.unreadNotifs}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (navigation as any).openDrawer?.()}>
            <Ionicons name="menu" size={30} color={textDark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Greeting */}
      <Text style={[styles.welcome, { fontFamily, fontSize: fontSizeValue + 6, color: textDark }]}>
        Welcome, Admin!
      </Text>
      <Text style={[styles.subtitle, { fontFamily, fontSize: fontSizeValue }]}>
        Let’s get back to work.
      </Text>

      {/* Feature Cards */}
      <View style={styles.grid}>
        {cardsWithGhost.map((c) => {
          const isGhost = c.key === 'ghost';
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: borderCol },
                isGhost && { opacity: 0, pointerEvents: 'none' },
              ]}
              onPress={c.onPress}
              activeOpacity={0.9}
            >
              {c.icon}
              <Text style={[styles.cardText, { fontFamily, fontSize: fontSizeValue, color: textDark }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.section, { backgroundColor: tintBg, borderColor: borderCol }]}>
        <Text style={[styles.sectionTitle, { fontFamily, fontSize: fontSizeValue + 2, color: textDark }]}>
          Live Insights
        </Text>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator size="small" color={accentColor || '#ff9900'} />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#b00020" />
            <Text style={[styles.errorText, { fontFamily }]}> {error}</Text>
          </View>
        ) : (
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { borderColor: borderCol, backgroundColor: '#ffffffaa' }]}>
              <Ionicons name="school" size={22} color={textDark} />
              <Text style={[styles.kpiValue, { fontFamily, color: textDark }]}>{counts.learners}</Text>
              <Text style={[styles.kpiLabel, { fontFamily, color: textDark }]}>Learners</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: borderCol, backgroundColor: '#ffffffaa' }]}>
              <Ionicons name="chatbubble-ellipses" size={22} color={textDark} />
              <Text style={[styles.kpiValue, { fontFamily, color: textDark }]}>{counts.feedbacks}</Text>
              <Text style={[styles.kpiLabel, { fontFamily, color: textDark }]}>Feedback</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: borderCol, backgroundColor: '#ffffffaa' }]}>
              <Ionicons name="book" size={22} color={textDark} />
              <Text style={[styles.kpiValue, { fontFamily, color: textDark }]}>{counts.lessons}</Text>
              <Text style={[styles.kpiLabel, { fontFamily, color: textDark }]}>Lessons</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: borderCol, backgroundColor: '#ffffffaa' }]}>
              <Ionicons name="checkmark-done" size={22} color={textDark} />
              <Text style={[styles.kpiValue, { fontFamily, color: textDark }]}>{counts.completedAttempts}</Text>
              <Text style={[styles.kpiLabel, { fontFamily, color: textDark }]}>Completed</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 30, height: 30, marginRight: 8, resizeMode: 'contain' },
  logoText: { fontWeight: 'bold', color: '#333' },
  welcome: { fontWeight: '700' },
  subtitle: { color: '#666', marginBottom: 16 },
  section: { borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1.5 },
  centerRow: { alignItems: 'center', paddingVertical: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fde7ea', padding: 8, borderRadius: 8 },
  errorText: { color: '#b00020', marginLeft: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginVertical: 10 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  card: {
    width: '44%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginVertical: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    paddingVertical: 10,
  },
  cardText: { marginTop: 8, fontWeight: '600', textAlign: 'center' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  kpiCard: {
    flexBasis: '48%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  kpiLabel: { fontSize: 12, marginTop: 2 },
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
});
