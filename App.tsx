// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import * as Font from 'expo-font';
import NamePictureScreen from './src/features/learner/games/screens/NameThePicture';
import RhymeTimeScreen from './src/features/learner/games/screens/RhymeTime';
import FillBlankScreen from './src/features/learner/games/screens/FillInTheBlank';
import GameScreen from './src/features/learner/games/screens/MainGames';
import SoundMatchScreen from './src/features/learner/games/screens/SoundMatch';
import GameReviewScreen from './src/features/learner/games/screens/GameReview';
import GameRoundsScreen from './src/features/learner/games/screens/GameRounds';
// Screens
import LoadingScreen from './src/features/auth/screens/Loading';
import LoginScreen from './src/features/auth/screens/LogIn';
import SignupScreen from './src/features/auth/screens/SignUp';
import SetupScreen from './src/features/auth/screens/SetUp';
import ForgotPasswordScreen from './src/features/auth/screens/ForgotPassword';

import DashboardScreen from './src/navigation/learner/LearnerDrawerNavigator';
import TTSScreen from './src/features/learner/core/screens/TTS';
import STTScreen from './src/features/learner/core/screens/STT';
import ScanScreen from './src/features/learner/core/screens/ITT';

import WritingPracticeScreen from './src/features/learner/practice/screens/WritingPractice';
import MainPracticeScreen from './src/features/learner/practice/screens/MainPractice';
import ReadingPracticeScreen from './src/features/learner/practice/screens/ReadingPractice';

import MainPhonics from './src/features/learner/phonics/screens/MainPhonics';
import PhonicsLessonScreen from './src/features/learner/phonics/screens/Lessons';

import HelpScreen from './src/features/learner/main/screens/Help';
import AboutScreen from './src/features/learner/main/screens/AboutUs';
import FeedbackScreen from './src/features/learner/main/screens/Feedback';

import NotificationScreen from './src/features/learner/main/screens/Notifications';
import AccountScreen from './src/features/learner/main/screens/Profile';


import AdminPhonicsGroupScreen from './src/features/admin/screens/PhonicsGroups';
import AdminPhonicsLessonScreen from './src/features/admin/screens/ManageLessons';
import AdminGameSettingsScreen from './src/features/admin/screens/GameSettings';
import AdminGamesScreen from './src/features/admin/screens/ManageGames';
import AdminPracticeScreen from './src/features/admin/screens/ManagePractice';
import AdminPracticeSettingsScreen from './src/features/admin/screens/PracticeSettings';


// Admin Screens
import AdminDrawerNavigator from './src/navigation/admin/AdminDrawerNavigator';
import AdminPhonicsScreen from './src/features/admin/screens/ManagePhonics';
import AdminFeedbackScreen from './src/features/admin/screens/Feedback';
import AdminAccountsScreen from './src/features/admin/screens/ManageAccounts';
import AdminNotificationsScreen from './src/features/admin/screens/Notifications';

// Context Providers
import { AppSettingsProvider } from './src/context/AppSettings';
import { UserProvider } from './src/context/UserContext';
import AdminAboutEditorScreen from './src/features/admin/screens/AboutUs';
import AdminHelpEditorScreen from './src/features/admin/screens/Help';
import AdminProfileScreen from './src/features/admin/screens/Profile';

import AlternativesLesson from './src/features/learner/phonics/screens/AltLessons';
import GroupLesson from './src/features/learner/phonics/screens/GroupLessons';
import TrickyWordsLesson from './src/features/learner/phonics/screens/TrickyWords';



const Stack = createNativeStackNavigator();

const loadFonts = async () => {
  await Font.loadAsync({
    'Open Dyslexic': require('./assets/fonts/OpenDyslexic-Regular.otf'),
  });
};

export default function App() {
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    loadFonts()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error('Font loading failed:', err);
        setIsReady(true);
      });
  }, []);

  if (!isReady) return <LoadingScreen />;

  return (
    <UserProvider>
      <AppSettingsProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Loading" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Loading" component={LoadingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Setup" component={SetupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="TTS" component={TTSScreen} />
            <Stack.Screen name="STT" component={STTScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="Phonics" component={MainPhonics} />
            <Stack.Screen name="PhonicsLessonScreen" component={PhonicsLessonScreen} />
            <Stack.Screen name="WritingPracticeScreen" component={WritingPracticeScreen} />
            <Stack.Screen name="MainPracticeScreen" component={MainPracticeScreen} />
            <Stack.Screen name="ReadingPracticeScreen" component={ReadingPracticeScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
            <Stack.Screen name="AboutUs" component={AboutScreen} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
            <Stack.Screen name="Games" component={GameScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="NamePicture" component={NamePictureScreen} />
            <Stack.Screen name="RhymeTime" component={RhymeTimeScreen} />
            <Stack.Screen name="FillBlank" component={FillBlankScreen} />
            <Stack.Screen name="AdminNotificationsScreen" component={AdminNotificationsScreen} />
            <Stack.Screen name="AdminPhonicsGroup" component={AdminPhonicsGroupScreen} />
            <Stack.Screen name="AdminPhonicsLesson" component={AdminPhonicsLessonScreen} />
            <Stack.Screen name="AdminPractice" component={AdminPracticeScreen} />
            <Stack.Screen name="AdminPracticeSettings" component={AdminPracticeSettingsScreen} />
            <Stack.Screen name="AdminAboutEditor" component={AdminAboutEditorScreen} />
      <Stack.Screen name="AdminHelpEditor" component={AdminHelpEditorScreen} />
      <Stack.Screen name="AdminProfile" component={AdminProfileScreen} />
      <Stack.Screen name="GameReview" component={GameReviewScreen} />
<Stack.Screen name="GameRounds" component={GameRoundsScreen} />




            {/* Admin Screens */}
            <Stack.Screen name="SoundMatch" component={SoundMatchScreen} />
            <Stack.Screen name="AdminRoot" component={AdminDrawerNavigator} />
            {/*<Stack.Screen name="AdminDashboard" component={AdminDrawerNavigator} />*/}
            <Stack.Screen name="AdminPhonics" component={AdminPhonicsScreen} />
            <Stack.Screen name="AdminFeedback" component={AdminFeedbackScreen} />
            <Stack.Screen name="AdminAccounts" component={AdminAccountsScreen} />
            <Stack.Screen name="AdminGames" component={AdminGamesScreen} />
            <Stack.Screen name="AdminGameSettings" component={AdminGameSettingsScreen} />
            <Stack.Screen name="GroupLesson" component={GroupLesson} />
            <Stack.Screen name="AlternativesLesson" component={AlternativesLesson} />
            <Stack.Screen name="TrickyWordsLesson" component={TrickyWordsLesson} />




          </Stack.Navigator>
        </NavigationContainer>
      </AppSettingsProvider>
    </UserProvider>
  );
}

