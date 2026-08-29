import { initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

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
const email = 'akshayplite@gmail.com';

async function run() {
  console.log(`Sending password reset email to ${email}...`);
  try {
    await sendPasswordResetEmail(auth, email);
    console.log(`Password reset email sent successfully to ${email}!`);
  } catch (err) {
    console.error('Error sending reset email:', err);
  }
  process.exit(0);
}

run();

