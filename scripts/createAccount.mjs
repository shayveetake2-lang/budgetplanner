import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBVDcQiWjnGO_CPEURzGOOHJDhIWIWHBRA",
  authDomain: "budgetplanner-574d1.firebaseapp.com",
  projectId: "budgetplanner-574d1",
  storageBucket: "budgetplanner-574d1.firebasestorage.app",
  messagingSenderId: "835924994025",
  appId: "1:835924994025:web:65bcfe1c54d17bb1bd8d78",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const email = 'akshayplite@gmail.com';
const username = 'Akshay';
const password = 'Password123!';

async function run() {
  console.log(`Attempting to create account for ${email}...`);
  let uid = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log(`Created user in Firebase Auth with UID: ${uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`Email already registered in Auth. Signing in to verify/update Firestore profile...`);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
      console.log(`Signed in successfully with UID: ${uid}`);
    } else {
      console.error('Auth error:', err);
      process.exit(1);
    }
  }

  const userDocRef = doc(db, 'users', uid);
  const existingDoc = await getDoc(userDocRef);

  if (!existingDoc.exists()) {
    const today = new Date().toISOString().split('T')[0];
    const initialProfile = {
      uid,
      email,
      username,
      level: 1,
      xp: 0,
      coins: 150, // bonus starter coins!
      budgetPeriod: 'monthly',
      budgetLimit: 1000,
      streak: 1,
      lastLoginDate: today,
      unlockedAchievements: [],
      unlockedThemes: ['theme_zinc'],
      activeTheme: 'theme_zinc',
      activeAvatarFrame: 'frame_bronze',
      recurringExpenses: [
        { id: 'ri_rent', name: 'Rent', amount: 450, category: 'Rent / Mortgage', cycle: 'weekly' },
        { id: 'ri_groceries', name: 'Groceries', amount: 150, category: 'Groceries', cycle: 'weekly' }
      ],
      recurringIncome: [
        { id: 'ri_salary', name: 'Main Salary', amount: 1200, category: 'Salary', cycle: 'weekly' }
      ],
      createdAt: new Date().toISOString(),
    };
    await setDoc(userDocRef, initialProfile);
    console.log('Created initial UserProfile in Firestore.');
  } else {
    console.log('UserProfile already exists in Firestore.');
  }

  console.log('Account creation complete!');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
