import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import DashboardScreen from '../../features/learner/main/screens/Dashboard';
import CustomDrawer from '../../features/learner/ui/LearnerDrawerContent';

// Drawer routes are local to this navigator (separate from RootStackParamList)
export type LearnerDrawerParamList = {
  DashboardScreen: undefined;
};

const Drawer = createDrawerNavigator<LearnerDrawerParamList>();

const LearnerDrawerNavigator = () => {
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

export default LearnerDrawerNavigator;
