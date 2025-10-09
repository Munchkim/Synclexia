import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useAppSettings } from '../../../context/AppSettings';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { Alert } from 'react-native';

const CustomDrawer = (props: any) => {
  const [drawerUser, setDrawerUser] = useState<{ name: string; email: string } | null>(null);

  const { fontSize, fontFamily, bgColor, setFontSize, setFontFamily, setColors } = useAppSettings();
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontStyle, setShowFontStyle] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

  const fontSizeValue = fontSize === 'small' ? 14 : fontSize === 'large' ? 20 : 16;

  const fontOptions = [
    'Arial', 'Open Dyslexic', 'Verdana Pro', 'Tahoma', 'Century Gothic', 'Trebuchet', 'Calibri', 'Open Sans',
  ];

  const colorPairs = [
    { bg: '#d0f0ff', accent: '#a4daf3' },
    { bg: '#d7f9d3', accent: '#aef2a7' },
    { bg: '#f9d2b4', accent: '#f5b396' },
    { bg: '#f5d2da', accent: '#ffadc0' },
    { bg: '#fff9c4', accent: '#fde695' },
    { bg: '#ffdcad', accent: '#ffb984' },
  ];

  useEffect(() => {
  const fetchDrawerUser = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;

    const { data: userData, error } = await supabase
      .from('users')
      .select('username, email')
      .eq('id', authData.user.id)
      .single();

    if (!error && userData) {
      setDrawerUser({
        name: userData.username || 'User',
        email: userData.email,
      });
    }
  };

  fetchDrawerUser();
}, []);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={[styles.container, { backgroundColor: bgColor }]}>
<TouchableOpacity
  style={styles.profile}
  onPress={() => props.navigation.navigate('Account')}
>
  <Text style={[styles.name, { fontFamily, fontSize: fontSizeValue + 6 }]}>
    {drawerUser?.name || 'Loading...'}
  </Text>
  <Text style={[styles.email, { fontFamily, fontSize: fontSizeValue - 2 }]}>
    {drawerUser?.email || 'Loading...'}
  </Text>
</TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => setShowFontSize(true)}>
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="text-height" size={20} color="#333" />
        </View>
        <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>Font Size</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => setShowFontStyle(true)}>
        <View style={styles.iconWrapper}>
          <FontAwesome5 name="italic" size={20} color="#333" />
        </View>
        <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>Font Style</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => setShowBgColor(true)}>
        <View style={styles.iconWrapper}>
          <Ionicons name="color-palette-outline" size={22} color="#333" />
        </View>
        <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>Background color</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <TouchableOpacity
          style={styles.row}
          onPress={() => props.navigation.navigate('Help')}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="help-circle-outline" size={22} color="#333" />
          </View>
          <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>Help</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => props.navigation.navigate('AboutUs')}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="information-circle-outline" size={22} color="#333" />
          </View>
          <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>About Us</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          onPress={() => props.navigation.navigate('Feedback')}
        >
          <View style={styles.iconWrapper}>
            <Ionicons name="chatbox-ellipses-outline" size={22} color="#333" />
          </View>
          <Text style={[styles.item, { fontFamily, fontSize: fontSizeValue }]}>Feedback</Text>
        </TouchableOpacity>


      <View style={styles.divider} />

<TouchableOpacity
  style={styles.row}
  onPress={() =>
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => props.navigation.replace('Login'),
        },
      ]
    )
  }
>
  <View style={styles.iconWrapper}>
    <Ionicons name="log-out-outline" size={22} color="#333" />
  </View>
  <Text
    style={[
      styles.item,
      {
        fontFamily,
        fontSize: fontSizeValue,
        fontWeight: 'bold',
      },
    ]}
  >
    Logout
  </Text>
</TouchableOpacity>
      <Modal visible={showFontSize} transparent animationType="fade">
        <View style={styles.centeredModal}>
          <View style={[styles.modalWide, { backgroundColor: bgColor }]}>
            <Text style={[styles.modalTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>Font Size</Text>

            <View style={styles.sliderRow}>
              <Text style={[styles.sliderLabel, { fontFamily, fontSize: 14 }]}>A</Text>
              <Slider
                style={{ flex: 1, marginHorizontal: 12 }}
                minimumValue={0}
                maximumValue={2}
                step={1}
                value={fontSize === 'small' ? 0 : fontSize === 'large' ? 2 : 1}
                onValueChange={(val) => {
                  const sizes = ['small', 'medium', 'large'] as const;
                  setFontSize(sizes[val]);
                }}
                minimumTrackTintColor="#333"
                maximumTrackTintColor="#999"
                thumbTintColor="#333"
              />
              <Text style={[styles.sliderLabel, { fontFamily, fontSize: 22 }]}>A</Text>
            </View>

            <Text style={{
              marginTop: 20,
              fontSize: fontSizeValue,
              fontFamily,
              textAlign: 'center',
              color: '#333',
            }}>
              This is sample.
            </Text>

            <TouchableOpacity style={styles.okButton} onPress={() => setShowFontSize(false)}>
              <Text style={[styles.okText, { fontFamily, fontSize: fontSizeValue }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showFontStyle} transparent animationType="fade">
        <View style={[styles.modal, { backgroundColor: bgColor }]}>

          <Text style={[styles.modalTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>Font Style</Text>
          {fontOptions.map((font) => (
            <TouchableOpacity
              key={font}
              style={styles.option}
              onPress={() => {
                setFontFamily(font);
                setShowFontStyle(false);
              }}
            >
              <Text style={{ fontFamily: font, fontSize: fontSizeValue }}>{font}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <Modal visible={showBgColor} transparent animationType="fade">
        <View style={[styles.modal, { backgroundColor: bgColor }]}>
          <Text style={[styles.modalTitle, { fontFamily, fontSize: fontSizeValue + 2 }]}>Background Color</Text>
          <View style={styles.colorGridContainer}>
            {colorPairs.map(({ bg, accent }, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: bg, borderColor: bgColor === bg ? '#000' : bg },
                ]}
                onPress={() => {
                  setColors(bg, accent);
                  setShowBgColor(false);
                }}
              >
                <View style={[styles.accentBox, { backgroundColor: accent }]} />
                {bgColor === bg && <Text style={styles.checkmark}>✔</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  profile: { marginBottom: 20 },
  name: { paddingTop: 20, fontWeight: 'bold', marginBottom: 2, paddingLeft: 20 },
  email: { color: '#444', paddingLeft: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    paddingLeft: 20,
  },
  iconWrapper: {
    width: 26,
    alignItems: 'center',
  },
  item: {
    marginLeft: 16,
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#aaa',
    marginVertical: 14,
    opacity: 0.5,
  },
  modal: {
    marginTop: '30%',
    backgroundColor: '#fff9c4',
    marginHorizontal: 30,
    borderRadius: 16,
    padding: 20,
    elevation: 10,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
  },
  modalWide: {
    width: '85%',
    borderRadius: 20,
    padding: 24,
    elevation: 12,
  },
  centeredModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  sliderLabel: {
    color: '#333',
  },
  okButton: {
    marginTop: 24,
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'center',
  },
  okText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  option: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  colorGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  colorSwatch: {
    width: 130,
    height: 100,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accentBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: '#888',
  },
  checkmark: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default CustomDrawer;
