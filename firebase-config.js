// Salin nilai firebaseConfig dari Firebase Console ke file ini.
// Project settings > Your apps > Web app > SDK setup and configuration.
// API key Web Firebase bukan password; keamanan data diatur oleh firestore.rules.
export const firebaseConfig = {
  apiKey: "AIzaSyD9IwjcU-sSATLs5JZoULDw3Iu9BFROB3c",
  authDomain: "kpripln.firebaseapp.com",
  projectId: "kpripln",
  storageBucket: "kpripln.firebasestorage.app",
  messagingSenderId: "538235477656",
  appId: "1:538235477656:web:deaf552076c4f43ac03aed"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value => value.startsWith("ISI_"));
