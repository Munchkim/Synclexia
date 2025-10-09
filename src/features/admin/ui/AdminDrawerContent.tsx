import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const AdminCustomDrawer = (props: any) => {
  const [email, setEmail] = useState<string>('Loading...');

  useEffect(() => {
    const fetchEmail = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.email) {
        setEmail(authData.user.email);
      }
    };
    fetchEmail();
  }, []);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.profile}
        activeOpacity={0.8}
        onPress={() => props.navigation.navigate('AdminProfile')}
        accessibilityRole="button"
        accessibilityLabel="Open admin profile"
      >
        <Text style={styles.email}>{email}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => props.navigation.navigate('AdminHelpEditor')}>
        <View style={styles.iconWrapper}>
          <Ionicons name="help-circle-outline" size={22} color="#333" />
        </View>
        <Text style={styles.item}>Help</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => props.navigation.navigate('AdminAboutEditor')}>
        <View style={styles.iconWrapper}>
          <Ionicons name="information-circle-outline" size={22} color="#333" />
        </View>
        <Text style={styles.item}>About Us</Text>
      </TouchableOpacity>

      <TouchableOpacity
  style={styles.row}
  onPress={() => props.navigation.navigate('AdminFeedback')}
>
  <View style={styles.iconWrapper}>
    <Ionicons name="chatbubble-ellipses-outline" size={22} color="#333" />
  </View>
  <Text style={styles.item}>Feedback</Text>
</TouchableOpacity>


      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          Alert.alert('Confirm Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout',
              style: 'destructive',
              onPress: () => props.navigation.replace('Login'),
            },
          ])
        }
      >
        <View style={styles.iconWrapper}>
          <Ionicons name="log-out-outline" size={22} color="#333" />
        </View>
        <Text style={[styles.item, { fontWeight: 'bold' }]}>Logout</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    flexGrow: 1,
    backgroundColor: '#fff9c4',
  },
  profile: {
    marginBottom: 20,
  },
  email: {
    color: '#333',
    fontWeight: '600',
    fontSize: 16,
    paddingLeft: 20,
    marginBottom: 10,
  },
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
    fontSize: 16,
  },
});

export default AdminCustomDrawer;
