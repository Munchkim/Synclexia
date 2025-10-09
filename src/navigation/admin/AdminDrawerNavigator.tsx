import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import AdminDashboardScreen from '../../features/admin/screens/Dashboard';
import AdminCustomDrawer from '../../features/admin/ui/AdminDrawerContent';

// Drawer routes are local to this navigator (separate from RootStackParamList)
export type AdminDrawerParamList = {
  AdminHome: undefined;
};

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

const AdminDrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AdminCustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: {
          backgroundColor: '#fff9c4',
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="AdminHome" component={AdminDashboardScreen} />
    </Drawer.Navigator>
  );
};

export default AdminDrawerNavigator;
