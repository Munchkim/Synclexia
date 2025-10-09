// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar, View, ActivityIndicator, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';

import { RootStackParamList } from './types';

import { AppSettingsProvider } from './src/context/AppSettings';
import { UserProvider } from './src/context/UserContext';

/** ----------------------- Learner: Games ----------------------- */
import NamePictureScreen from './src/features/learner/games/screens/NameThePicture';
import RhymeTimeScreen from './src/features/learner/games/screens/RhymeTime';
import FillBlankScreen from './src/features/learner/games/screens/FillInTheBlank';
import GameScreen from './src/features/learner/games/screens/MainGames';
import SoundMatchScreen from './src/features/learner/games/screens/SoundMatch';
import GameReviewScreen from './src/features/learner/games/screens/GameReview';
import GameRoundsScreen from './src/features/learner/games/screens/GameRounds';

/** ----------------------- Auth ----------------------- */
import LoadingScreen from './src/features/auth/screens/Loading';
import LoginScreen from './src/features/auth/screens/LogIn';
import SignupScreen from './src/features/auth/screens/SignUp';
import SetupScreen from './src/features/auth/screens/SetUp';
import ForgotPasswordScreen from './src/features/auth/screens/ForgotPassword';

/** ----------------------- Learner: Core ----------------------- */
import DashboardScreen from './src/navigation/learner/LearnerDrawerNavigator';
import TTSScreen from './src/features/learner/core/screens/TTS';
import STTScreen from './src/features/learner/core/screens/STT';
import ScanScreen from './src/features/learner/core/screens/ITT';

/** ----------------------- Learner: Practice ----------------------- */
import WritingPracticeScreen from './src/features/learner/practice/screens/WritingPractice';
import MainPracticeScreen from './src/features/learner/practice/screens/MainPractice';
import ReadingPracticeScreen from './src/features/learner/practice/screens/ReadingPractice';

/** ----------------------- Learner: Phonics ----------------------- */
import MainPhonics from './src/features/learner/phonics/screens/MainPhonics';
import PhonicsLessonScreen from './src/features/learner/phonics/screens/Lessons';
import AlternativesLesson from './src/features/learner/phonics/screens/AltLessons';
import GroupLesson from './src/features/learner/phonics/screens/GroupLessons';
import TrickyWordsLesson from './src/features/learner/phonics/screens/TrickyWords';

/** ----------------------- Learner: Main pages ----------------------- */
import HelpScreen from './src/features/learner/main/screens/Help';
import AboutScreen from './src/features/learner/main/screens/AboutUs';
import FeedbackScreen from './src/features/learner/main/screens/Feedback';
import NotificationScreen from './src/features/learner/main/screens/Notifications';
import AccountScreen from './src/features/learner/main/screens/Profile';

/** ----------------------- Admin ----------------------- */
import AdminDrawerNavigator from './src/navigation/admin/AdminDrawerNavigator';
import AdminPhonicsScreen from './src/features/admin/screens/ManagePhonics';
import AdminPhonicsGroupScreen from './src/features/admin/screens/PhonicsGroups';
import AdminPhonicsLessonScreen from './src/features/admin/screens/ManageLessons';
import AdminGameSettingsScreen from './src/features/admin/screens/GameSettings';
import AdminGamesScreen from './src/features/admin/screens/ManageGames';
import AdminPracticeScreen from './src/features/admin/screens/ManagePractice';
import AdminPracticeSettingsScreen from './src/features/admin/screens/PracticeSettings';
import AdminFeedbackScreen from './src/features/admin/screens/Feedback';
import AdminAccountsScreen from './src/features/admin/screens/ManageAccounts';
import AdminNotificationsScreen from './src/features/admin/screens/Notifications';
import AdminAboutEditorScreen from './src/features/admin/screens/AboutUs';
import AdminHelpEditorScreen from './src/features/admin/screens/Help';
import AdminProfileScreen from './src/features/admin/screens/Profile';

/** ----------------------- Types & Stack ----------------------- */
type ScreenTuple = [keyof RootStackParamList, React.ComponentType<any>];
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = Font.useFonts({
    'Open Dyslexic': require('./assets/fonts/OpenDyslexic-Regular.otf'),
  });

   if (!fontsLoaded) {
     return (
       <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff9c4' }}>
         <Image source={require('./assets/icons/logo.png')} style={{ width: 120, height: 120, marginBottom: 16 }} />
         <ActivityIndicator />
       </View>
     );
   }

  // Grouped route tables (typed so route names must exist in RootStackParamList)
  const AUTH_SCREENS: ScreenTuple[] = [
    ['Loading', LoadingScreen],
    ['Login', LoginScreen],
    ['Signup', SignupScreen],
    ['Setup', SetupScreen],
    ['ForgotPassword', ForgotPasswordScreen],
  ];

  const LEARNER_CORE_SCREENS: ScreenTuple[] = [
    ['Dashboard', DashboardScreen],
    ['TTS', TTSScreen],
    ['STT', STTScreen],
    ['Scan', ScanScreen],
  ];

  const PHONICS_SCREENS: ScreenTuple[] = [
    ['Phonics', MainPhonics],
    ['PhonicsLessonScreen', PhonicsLessonScreen],
    ['GroupLesson', GroupLesson],
    ['AlternativesLesson', AlternativesLesson],
    ['TrickyWordsLesson', TrickyWordsLesson],
  ];

  const PRACTICE_SCREENS: ScreenTuple[] = [
    ['MainPracticeScreen', MainPracticeScreen],
    ['WritingPracticeScreen', WritingPracticeScreen],
    ['ReadingPracticeScreen', ReadingPracticeScreen],
  ];

  const GAME_SCREENS: ScreenTuple[] = [
    ['Games', GameScreen],
    ['NamePicture', NamePictureScreen],
    ['RhymeTime', RhymeTimeScreen],
    ['FillBlank', FillBlankScreen],
    ['SoundMatch', SoundMatchScreen],
    ['GameReview', GameReviewScreen],
    ['GameRounds', GameRoundsScreen],
  ];

  const LEARNER_MAIN_SCREENS: ScreenTuple[] = [
    ['Help', HelpScreen],
    ['AboutUs', AboutScreen],
    ['Feedback', FeedbackScreen],
    ['Notifications', NotificationScreen],
    ['Account', AccountScreen],
  ];

  const ADMIN_SCREENS: ScreenTuple[] = [
    ['AdminRoot', AdminDrawerNavigator],
    ['AdminPhonics', AdminPhonicsScreen],
    ['AdminPhonicsGroup', AdminPhonicsGroupScreen],
    ['AdminPhonicsLesson', AdminPhonicsLessonScreen],
    ['AdminPractice', AdminPracticeScreen],
    ['AdminPracticeSettings', AdminPracticeSettingsScreen],
    ['AdminGames', AdminGamesScreen],
    ['AdminGameSettings', AdminGameSettingsScreen],
    ['AdminFeedback', AdminFeedbackScreen],
    ['AdminAccounts', AdminAccountsScreen],
    ['AdminNotificationsScreen', AdminNotificationsScreen],
    ['AdminAboutEditor', AdminAboutEditorScreen],
    ['AdminHelpEditor', AdminHelpEditorScreen],
    ['AdminProfile', AdminProfileScreen],
  ];

  const register = ([name, component]: ScreenTuple) => (
    <Stack.Screen key={name} name={name} component={component} />
  );

  return (
    <UserProvider>
      <AppSettingsProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" />
          <Stack.Navigator initialRouteName="Loading" screenOptions={{ headerShown: false }}>
            {/* Auth */}
            {AUTH_SCREENS.map(register)}

            {/* Learner core */}
            {LEARNER_CORE_SCREENS.map(register)}

            {/* Phonics */}
            {PHONICS_SCREENS.map(register)}

            {/* Practice */}
            {PRACTICE_SCREENS.map(register)}

            {/* Games */}
            {GAME_SCREENS.map(register)}

            {/* Learner main */}
            {LEARNER_MAIN_SCREENS.map(register)}

            {/* Admin */}
            {ADMIN_SCREENS.map(register)}
          </Stack.Navigator>
        </NavigationContainer>
      </AppSettingsProvider>
    </UserProvider>
  );
}
