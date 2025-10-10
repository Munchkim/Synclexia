// types.ts

export type RootStackParamList = {
  /** ---------------- Auth ---------------- */
  Loading: undefined;
  Login: undefined;
  Signup: undefined;
  Setup: { userId?: string } | undefined;
  ForgotPassword: undefined;

  /** -------------- Learner: Core -------------- */
  Dashboard: undefined;
  TTS: undefined;
  STT: undefined;
  Scan: undefined;

  /** -------------- Learner: Phonics -------------- */
  Phonics: undefined;
  PhonicsLessonScreen: { phoneme: string }; // adjust to optional if needed
  GroupLesson: { phoneme: string };
  AlternativesLesson: { phoneme: string };
  TrickyWordsLesson: { group: number };

  /** -------------- Learner: Practice -------------- */
  MainPracticeScreen: undefined;
  WritingPracticeScreen: { lessonId?: string };
  ReadingPracticeScreen: { lessonId?: string };

  /** -------------- Learner: Games -------------- */
  Games: undefined;
  NamePicture: undefined;
  RhymeTime: undefined;
  FillBlank: undefined;
  SoundMatch: undefined;
  GameReview: { resultId?: string } | undefined;
  GameRounds: { setId?: string } | undefined;

  /** -------------- Learner: Main pages -------------- */
  Help: undefined;
  AboutUs: undefined;
  Feedback: undefined;
  Notifications: undefined;
  Account: undefined;

  /** -------------- Admin -------------- */
  AdminRoot: undefined;
  AdminPhonics: undefined;
  AdminPhonicsGroup: undefined;
  AdminPhonicsLesson: undefined;
  AdminPractice: undefined;
  AdminPracticeSettings: undefined;
  AdminGames: undefined;
  AdminGameSettings: undefined;
  AdminFeedback: undefined;
  AdminAccounts: undefined;
  AdminNotifications: undefined;
  AdminAboutEditor: undefined;
  AdminHelpEditor: undefined;
  AdminProfile: undefined;
};
