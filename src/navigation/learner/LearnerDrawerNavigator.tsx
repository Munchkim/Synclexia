import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import DashboardScreen from '../../features/learner/main/screens/Dashboard';
import CustomDrawer from '../../features/learner/ui/LearnerDrawerContent';

const Drawer = createDrawerNavigator();

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: {
          backgroundColor: '#fff9c4',
          width: 280,
        },
      }}
    >
      <Drawer.Screen name="DashboardScreen" component={DashboardScreen} />
    </Drawer.Navigator>
  );
};

export default DrawerNavigator;