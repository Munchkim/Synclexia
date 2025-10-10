// screens/learner/main/AboutUs.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking,
  TouchableOpacity, Image,
} from 'react-native';
import BaseScreen from '../../../../components/BaseScreen';
import { supabase } from '../../../../lib/supabaseClient';
import { useAppSettings } from '../../../../context/AppSettings';

// ---------- types ----------
type Offer = { title: string; desc: string };
type Team = { name: string; role?: string; bio?: string; avatarUrl?: string };

// ---------- robust section parsing ----------
const sec = (md: string, titles: string[]) => {
  for (const t of titles) {
    // match "##  Title" or "### Title" (case-insensitive), tolerant to CRLF
    const rx = new RegExp(
      `(?:^|\\r?\\n)#{2,}\\s*${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n#{2,}\\s|$)`,
      'i'
    );
    const m = md.match(rx);
    if (m?.[1]) return m[1].trim();
  }
  return '';
};

const stripMd = (s = '') =>
  s.replace(/\*\*(.+?)\*\*/g, '$1')
   .replace(/\*(.+?)\*/g, '$1')
   .replace(/`(.+?)`/g, '$1')
   .replace(/<[^>]*>/g, '');

const splitBullets = (block: string) =>
  block
    .split(/\r?\n/)
    .filter((ln) => ln.trim().startsWith('- '))
    .map((ln) => ln.trim().replace(/^- /, ''));

const parseOffers = (block: string): Offer[] =>
  splitBullets(block).map((item) => {
    const parts = item.split(/ — | – | - /);
    const title = stripMd(parts[0] || '').trim();
    const desc  = stripMd(parts.slice(1).join(' - ') || '').trim();
    return { title, desc };
  });

const parseTeam = (block: string): Team[] => {
  // bullets like:
  // - **Name** – *Role*
  //   Bio line(s)...
  const lines = block.split(/\r?\n/);
  const out: Team[] = [];
  let cur: Team | null = null;

  for (const raw of lines) {
    if (raw.trim().startsWith('- ')) {
      if (cur) out.push(cur);
      const line = raw.trim().replace(/^- /, '');
      const name = (line.match(/\*\*(.+?)\*\*/)?.[1] ?? '').trim();
      const role = (line.match(/–\s*\*(.+?)\*/)?.[1] ??
                   line.match(/-\s*\*(.+?)\*/)?.[1] ?? '').trim();
      cur = { name: stripMd(name), role: stripMd(role), bio: '' };
    } else if (cur) {
      const text = stripMd(raw.trim());
      if (text) cur.bio = (cur.bio ? `${cur.bio} ` : '') + text;
    }
  }
  if (cur) out.push(cur);
  return out;
};

const parseContacts = (block: string) =>
  splitBullets(block).map((item) => {
    const m = item.match(/^([^:]+):\s*(.+)$/);
    const label = (m?.[1] || '').trim();
    const value = (m?.[2] || '').trim();
    let href = '';
    if (/^https?:\/\//i.test(value)) href = value;
    else if (/@/.test(value)) href = `mailto:${value}`;
    else if (/^[0-9 +()-]+$/.test(value)) href = `tel:${value.replace(/[^\d+]/g, '')}`;
    return { label, value, href };
  });

const initials = (name?: string) => (name || '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');

// ---------- simple fallback renderer (never blank) ----------
const FallbackMd = ({ md, fontFamily, fontSizeValue }: { md: string; fontFamily?: string; fontSizeValue: number }) => {
  const renderLine = (line: string, i: number) => {
    if (line.startsWith('# '))  return <Text key={i} style={[styles.h1, { fontFamily }]}>{line.replace(/^# /, '')}</Text>;
    if (line.startsWith('## ')) return <Text key={i} style={[styles.h2, { fontFamily }]}>{line.replace(/^## /, '')}</Text>;
    if (line.startsWith('- '))  return <Text key={i} style={[styles.li, { fontFamily }]}>• {line.replace(/^- /, '')}</Text>;
    if (/https?:\/\//.test(line)) return (
      <Text key={i} style={[styles.p, { fontFamily, fontSize: fontSizeValue }]} onPress={() => Linking.openURL(line.trim())}>{line.trim()}</Text>
    );
    return <Text key={i} style={[styles.p, { fontFamily, fontSize: fontSizeValue }]}>{line}</Text>;
  };
  return <>{md.split(/\r?\n/).map(renderLine)}</>;
};

// ---------- component ----------
export default function AboutScreen() {
  const { accentColor, fontFamily, fontSize } = useAppSettings();
  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const [loading, setLoading] = useState(true);
  const [md, setMd] = useState('');

  // expand/collapse
  const [showMission, setShowMission] = useState(false);
  const [showVision, setShowVision] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('site_pages')
        .select('markdown')
        .eq('key', 'about')
        .maybeSingle();
      setMd((data?.markdown as string) || '');
      setLoading(false);
    })();
  }, []);

  const data = useMemo(() => {
    const intro    = stripMd(sec(md, ['Welcome to Synclexia', 'Welcome']));
    const mission  = stripMd(sec(md, ['Our Mission', 'Mission']));
    const vision   = stripMd(sec(md, ['Our Vision', 'Vision']));
    const story    = stripMd(sec(md, ['Our Story', 'Story']));
    const offers   = parseOffers(sec(md, ['What We Offer', 'What we offer', 'Features']));
    const team     = parseTeam(sec(md, ['Behind Synclexia', 'Meet the Team', 'Team']));
    const contacts = parseContacts(sec(md, ['Connect With Us', 'Connect with Us', 'Contact']));
    return { intro, mission, vision, story, offers, team, contacts };
  }, [md]);

  const nothingParsed =
    !data.intro && !data.mission && !data.vision && !data.story &&
    data.offers.length === 0 && data.team.length === 0 && data.contacts.length === 0;

  return (
    <BaseScreen title="About">
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#666" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
          {nothingParsed ? (
            <FallbackMd md={md} fontFamily={fontFamily} fontSizeValue={fontSizeValue} />
          ) : (
            <>
              {/* Intro */}
              <SectionTitle label="Welcome to Synclexia" accent={accentColor} fontFamily={fontFamily} />
              {!!data.intro && (
                <Text style={[styles.p, { fontFamily, fontSize: fontSizeValue }]}>{data.intro}</Text>
              )}

              {/* Mission + Vision */}
              <View style={styles.row2}>
                <View style={[styles.card, { backgroundColor: accentColor }]}>
                  <Text style={[styles.cardTitle, { fontFamily }]}>Our Mission</Text>
                  {!!data.mission && (
                    <Text
                      style={[styles.cardText, { fontFamily }]}
                      numberOfLines={showMission ? undefined : 5}
                    >
                      {data.mission}
                    </Text>
                  )}
                  {!!data.mission && (
                    <TouchableOpacity onPress={() => setShowMission((v) => !v)}>
                      <Text style={[styles.cardLink, { fontFamily }]}>
                        {showMission ? 'See Less' : 'See More'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.card, { backgroundColor: accentColor }]}>
                  <Text style={[styles.cardTitle, { fontFamily }]}>Our Vision</Text>
                  {!!data.vision && (
                    <Text
                      style={[styles.cardText, { fontFamily }]}
                      numberOfLines={showVision ? undefined : 5}
                    >
                      {data.vision}
                    </Text>
                  )}
                  {!!data.vision && (
                    <TouchableOpacity onPress={() => setShowVision((v) => !v)}>
                      <Text style={[styles.cardLink, { fontFamily }]}>
                        {showVision ? 'See Less' : 'See More'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Story */}
              <SectionTitle label="Our Story" accent={accentColor} fontFamily={fontFamily} />
              {!!data.story && (
                <Text style={[styles.p, { fontFamily, fontSize: fontSizeValue }]}>{data.story}</Text>
              )}

              {/* What we offer */}
              {!!data.offers.length && (
                <>
                  <SectionTitle label="What we offer" accent={accentColor} fontFamily={fontFamily} />
                  <View style={styles.offersWrap}>
                    {data.offers.map((it, idx) => (
                      <View key={idx} style={[styles.offerCard, { backgroundColor: accentColor }]}>
                        <Text style={[styles.offerTitle, { fontFamily }]}>{it.title}</Text>
                        {!!it.desc && <Text style={[styles.offerDesc, { fontFamily }]}>{it.desc}</Text>}
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Team */}
              {!!data.team.length && (
                <>
                  <SectionTitle label="Meet the Team" accent={accentColor} fontFamily={fontFamily} />
                  <Text style={[styles.p, { fontFamily, fontSize: fontSizeValue }]}>
                    Synclexia was developed by a passionate team of student innovators from UCLM College of Computer Studies.
                  </Text>
                  <View style={styles.swipeRow}>
                    <Text style={[styles.swipe, { fontFamily }]}>Swipe</Text>
                    <Text style={[styles.swipe, { fontFamily }]}>{'>'}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                    {data.team.map((m, i) => (
                      <View key={`${m.name}-${i}`} style={[styles.teamCard, { backgroundColor: accentColor }]}>
                        {m.avatarUrl ? (
                          <Image source={{ uri: m.avatarUrl }} style={styles.avatar} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: '#f0e2b6' }]}>
                            <Text style={[styles.avatarTxt, { fontFamily }]}>{initials(m.name)}</Text>
                          </View>
                        )}
                        <Text style={[styles.teamName, { fontFamily }]}>{m.name}</Text>
                        {!!m.role && <Text style={[styles.teamRole, { fontFamily }]}>{m.role}</Text>}
                        {!!m.bio && (
                          <Text style={[styles.teamBio, { fontFamily }]} numberOfLines={6}>
                            {m.bio}
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Contacts */}
              {!!data.contacts.length && (
                <>
                  <SectionTitle label="Connect with Us" accent={accentColor} fontFamily={fontFamily} />
                  <View style={{ gap: 10 }}>
                    {data.contacts.map((c, idx) => (
                      <TouchableOpacity
                        key={idx}
                        activeOpacity={0.85}
                        onPress={() => c.href && Linking.openURL(c.href)}
                        style={[styles.contactCard, { backgroundColor: accentColor }]}
                      >
                        <Text style={[styles.contactLabel, { fontFamily }]}>{c.label}</Text>
                        <Text style={[styles.contactValue, { fontFamily }]}>{c.value}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </BaseScreen>
  );
}

function SectionTitle({ label, accent, fontFamily }: { label: string; accent: string; fontFamily?: string }) {
  return (
    <View style={{ marginTop: 6, marginBottom: 10 }}>
      <Text style={[styles.h1, { fontFamily }]}>{label}</Text>
      <View style={[styles.underline, { backgroundColor: accent }]} />
    </View>
  );
}

const AVATAR = 84;
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  h1: { fontSize: 20, fontWeight: '800', color: '#1c1c1c' },
  h2: { fontSize: 16, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  p: { color: '#1c1c1c', marginBottom: 12 },
  li: { color: '#1c1c1c', marginBottom: 4, paddingLeft: 8 },

  underline: { width: 48, height: 6, borderRadius: 3, marginTop: 6 },

  row2: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 12 },
  card: { flex: 1, borderRadius: 12, padding: 12 },
  cardTitle: { fontWeight: '800', color: '#1c1c1c', marginBottom: 6 },
  cardText: { color: '#1c1c1c' },
  cardLink: { color: '#1c1c1c', marginTop: 8, fontWeight: '700', textDecorationLine: 'underline' },

  offersWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  offerCard: { width: '48%', borderRadius: 12, padding: 12 },
  offerTitle: { fontWeight: '800', color: '#1c1c1c' },
  offerDesc: { color: '#333', marginTop: 6, fontSize: 12 },

  swipeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6, gap: 6 },
  swipe: { color: '#666', fontSize: 12 },

  teamCard: { width: 220, borderRadius: 14, padding: 14, marginRight: 12 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, alignSelf: 'center', marginBottom: 10 },
  avatarTxt: { fontWeight: '800', fontSize: 24, color: '#333' },
  teamName: { fontWeight: '800', color: '#1c1c1c', textAlign: 'center' },
  teamRole: { color: '#333', fontSize: 12, textAlign: 'center', marginTop: 2, marginBottom: 6 },
  teamBio: { color: '#333', fontSize: 12 },

  contactCard: { borderRadius: 12, padding: 12 },
  contactLabel: { fontWeight: '800', color: '#1c1c1c', marginBottom: 4 },
  contactValue: { color: '#1c1c1c' },
});
