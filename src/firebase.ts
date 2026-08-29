import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBVDcQiWjnGO_CPEURzGOOHJDhIWIWHBRA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'budgetplanner-574d1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'budgetplanner-574d1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'budgetplanner-574d1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '835924994025',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:835924994025:web:65bcfe1c54d17bb1bd8d78',
};

// Quick verification if environmental credentials are placeholder or actual configuration keys
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'your_api_key_here'
);

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully.');
  } catch (error) {
    console.error('Firebase failed to initialize:', error);
  }
} else {
  console.warn(
    'Firebase environment variables missing or incomplete. Operating in LOCAL DEMO MODE.'
  );
}

export { auth, db, isFirebaseConfigured };

