// types.ts

export type RootStackParamList = {
  GroupLesson: { phoneme: string };
  AlternativesLesson: { phoneme: string };
  TrickyWordsLesson: { group: number };
  Loading: undefined;
  Login: undefined;
  Signup: undefined;
  Setup: undefined;
  Dashboard: undefined;
  TTS: undefined;
  STT: undefined;
  Scan: undefined;
  Writing: undefined;
  Phonics: undefined;
  Help: undefined;
  AboutUs: undefined;
  Feedback: undefined;
  ReadingBook: undefined;
  Notifications: undefined;
  Account: undefined;
  ForgotPassword: undefined;
  AdminDashboard: undefined;
  AdminPhonics: undefined;
  AdminPhonicsItems: undefined;
  AdminFeedback: undefined;
  AdminAccounts: undefined;
  PhonicsCategory: { category: string };
  PhonicsLessonScreen: { phoneme: string };
};
