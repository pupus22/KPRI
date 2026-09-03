// Salin nilai firebaseConfig dari Firebase Console ke file ini.
// Project settings > Your apps > Web app > SDK setup and configuration.
// API key Web Firebase bukan password; keamanan data diatur oleh firestore.rules.
export const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "ISI_MESSAGING_SENDER_ID",
  appId: "ISI_APP_ID"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value => value.startsWith("ISI_"));
