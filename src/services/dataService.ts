import { auth, db, isFirebaseConfigured } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { UserProfile, Transaction } from '../utils/gamification';

// Helper for dates
const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getYesterdayDateString = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

// ----------------------------------------------------
// LOCAL STORAGE SIMULATOR (FALLBACK MODE)
// ----------------------------------------------------
const localStorageSim = {
  usersKey: 'budget_rpg_auth_users',
  currentSessionKey: 'budget_rpg_session_user',
  profilePrefix: 'budget_rpg_profile_',
  transactionsPrefix: 'budget_rpg_transactions_',

  delay: (ms = 500) => new Promise(resolve => setTimeout(resolve, ms)),

  getUsers(): any[] {
    const data = localStorage.getItem(this.usersKey);
    return data ? JSON.parse(data) : [];
  },

  setUsers(users: any[]) {
    localStorage.setItem(this.usersKey, JSON.stringify(users));
  },

  async signUp(username: string, email: string, passwordString: string): Promise<UserProfile> {
    await this.delay();
    const users = this.getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('An account with this email already exists.');
    }
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('This username is already taken.');
    }

    const uid = 'local_uid_' + Math.random().toString(36).substr(2, 9);
    const newUser = { uid, username, email, password: passwordString };
    users.push(newUser);
    this.setUsers(users);

    // Create Initial Profile
    const profile: UserProfile = {
      uid,
      email,
      username,
      level: 1,
      xp: 0,
      coins: 100, // starting gold!
      monthlyBudget: 1000,
      streak: 1, // Start at 1
      lastLoginDate: getTodayDateString(),
      unlockedAchievements: [],
      unlockedThemes: ['theme_zinc'],
      activeTheme: 'theme_zinc',
      activeAvatarFrame: 'frame_none',
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(this.profilePrefix + uid, JSON.stringify(profile));
    localStorage.setItem(this.currentSessionKey, JSON.stringify(newUser));

    return profile;
  },

  async signIn(emailOrUsername: string, passwordString: string): Promise<UserProfile> {
    await this.delay();
    const users = this.getUsers();
    const foundUser = users.find(
      u =>
        (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
          u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
        u.password === passwordString
    );

    if (!foundUser) {
      throw new Error('Invalid email/username or password.');
    }

    localStorage.setItem(this.currentSessionKey, JSON.stringify(foundUser));
    
    // Fetch profile and check login rewards (streaks)
    let profile = await this.getUserProfile(foundUser.uid);
    profile = this.evaluateLoginStreak(profile);
    await this.updateUserProfile(profile.uid, profile);

    return profile;
  },

  signOut() {
    localStorage.removeItem(this.currentSessionKey);
  },

  onAuthStateChanged(callback: (user: { uid: string; email: string } | null) => void) {
    // Immediate callback for local session check
    const session = localStorage.getItem(this.currentSessionKey);
    if (session) {
      const user = JSON.parse(session);
      callback({ uid: user.uid, email: user.email });
    } else {
      callback(null);
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile> {
    const raw = localStorage.getItem(this.profilePrefix + uid);
    if (!raw) {
      throw new Error('User profile not found.');
    }
    return JSON.parse(raw);
  },

  async updateUserProfile(uid: string, fields: Partial<UserProfile>): Promise<UserProfile> {
    const current = await this.getUserProfile(uid);
    const updated = { ...current, ...fields };
    localStorage.setItem(this.profilePrefix + uid, JSON.stringify(updated));
    return updated;
  },

  async getTransactions(uid: string): Promise<Transaction[]> {
    const raw = localStorage.getItem(this.transactionsPrefix + uid);
    return raw ? JSON.parse(raw) : [];
  },

  async addTransaction(uid: string, transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    await this.delay(200);
    const list = await this.getTransactions(uid);
    const newTx: Transaction = {
      ...transaction,
      id: 'tx_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now()
    };
    list.push(newTx);
    localStorage.setItem(this.transactionsPrefix + uid, JSON.stringify(list));
    return newTx;
  },

  async deleteTransaction(uid: string, transactionId: string): Promise<void> {
    const list = await this.getTransactions(uid);
    const filtered = list.filter(t => t.id !== transactionId);
    localStorage.setItem(this.transactionsPrefix + uid, JSON.stringify(filtered));
  },

  evaluateLoginStreak(profile: UserProfile): UserProfile {
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();
    
    if (profile.lastLoginDate === today) {
      // Already logged in today, no streak updates
      return profile;
    }

    let nextStreak = profile.streak;
    let xpGain = 0;
    let coinGain = 0;

    if (profile.lastLoginDate === yesterday) {
      // Consecutive day login!
      nextStreak += 1;
      xpGain = 20; // reward 20 XP for checking in
      coinGain = 10;
    } else {
      // Streak broken, reset to 1
      nextStreak = 1;
      xpGain = 10; // small welcome back
      coinGain = 5;
    }

    // Accumulate XP and coins
    let newXp = profile.xp + xpGain;
    let newLevel = profile.level;
    let xpNeeded = newLevel * 150;

    if (newXp >= xpNeeded) {
      newXp -= xpNeeded;
      newLevel += 1;
      coinGain += newLevel * 50; // Level up bonus!
    }

    return {
      ...profile,
      streak: nextStreak,
      lastLoginDate: today,
      xp: newXp,
      level: newLevel,
      coins: profile.coins + coinGain
    };
  }
};

// ----------------------------------------------------
// DUAL-MODE SERVICE ADAPTER
// ----------------------------------------------------
export const dataService = {
  isFirebase: isFirebaseConfigured,

  async signUp(username: string, email: string, passwordString: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !auth || !db) {
      return localStorageSim.signUp(username, email, passwordString);
    }

    // 1. Firebase Auth Registration
    const userCredential = await createUserWithEmailAndPassword(auth, email, passwordString);
    const user = userCredential.user;

    // 2. Initial RPG profile creation
    const profile: UserProfile = {
      uid: user.uid,
      email,
      username,
      level: 1,
      xp: 0,
      coins: 100, // starting gold!
      monthlyBudget: 1000,
      streak: 1,
      lastLoginDate: getTodayDateString(),
      unlockedAchievements: [],
      unlockedThemes: ['theme_zinc'],
      activeTheme: 'theme_zinc',
      activeAvatarFrame: 'frame_none',
      createdAt: new Date().toISOString()
    };

    // Save profile to Firestore
    await setDoc(doc(db, 'users', user.uid), profile);
    return profile;
  },

  async signIn(emailOrUsername: string, passwordString: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !auth || !db) {
      return localStorageSim.signIn(emailOrUsername, passwordString);
    }

    let email = emailOrUsername;
    // Simple helper: if they entered a username instead of an email, look it up in local cache (or require email)
    // Firebase auth needs email. We can inspect if the entry is an email, if not, we can prompt email or search users collection.
    // To make username sign-in possible in Firebase without storing emails publicly:
    // Let's assume standard signin takes email and password. If they provide username, we can suggest signing in with email or register it as such.
    // To make it simple, let's treat the entry as email, or check if it doesn't contain '@' and alert them.
    if (!emailOrUsername.includes('@')) {
      throw new Error('Please sign in using your email address.');
    }

    const userCredential = await signInWithEmailAndPassword(auth, email, passwordString);
    const user = userCredential.user;

    // Fetch Firestore Profile
    const profileDocRef = doc(db, 'users', user.uid);
    const profileSnap = await getDoc(profileDocRef);
    
    if (!profileSnap.exists()) {
      throw new Error('Profile details do not exist in database.');
    }

    let profile = profileSnap.data() as UserProfile;
    
    // Evaluate login streaks
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    if (profile.lastLoginDate !== today) {
      let nextStreak = profile.streak;
      let xpGain = 0;
      let coinGain = 0;

      if (profile.lastLoginDate === yesterday) {
        nextStreak += 1;
        xpGain = 20;
        coinGain = 10;
      } else {
        nextStreak = 1;
        xpGain = 10;
        coinGain = 5;
      }

      let newXp = profile.xp + xpGain;
      let newLevel = profile.level;
      const xpNeeded = newLevel * 150;

      if (newXp >= xpNeeded) {
        newXp -= xpNeeded;
        newLevel += 1;
        coinGain += newLevel * 50;
      }

      profile = {
        ...profile,
        streak: nextStreak,
        lastLoginDate: today,
        xp: newXp,
        level: newLevel,
        coins: profile.coins + coinGain
      };

      await updateDoc(profileDocRef, profile as any);
    }

    return profile;
  },

  async signOut(): Promise<void> {
    if (!isFirebaseConfigured || !auth) {
      localStorageSim.signOut();
      return;
    }
    await firebaseSignOut(auth);
  },

  onAuthStateChanged(callback: (user: { uid: string; email: string } | null) => void) {
    if (!isFirebaseConfigured || !auth) {
      localStorageSim.onAuthStateChanged(callback);
      return () => {};
    }

    return firebaseOnAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (user) {
        callback({ uid: user.uid, email: user.email || '' });
      } else {
        callback(null);
      }
    });
  },

  async getUserProfile(uid: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !db) {
      return localStorageSim.getUserProfile(uid);
    }
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      throw new Error('User profile does not exist.');
    }
    return snap.data() as UserProfile;
  },

  async updateUserProfile(uid: string, fields: Partial<UserProfile>): Promise<UserProfile> {
    if (!isFirebaseConfigured || !db) {
      return localStorageSim.updateUserProfile(uid, fields);
    }
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, fields as any);
    const snap = await getDoc(docRef);
    return snap.data() as UserProfile;
  },

  async getTransactions(uid: string): Promise<Transaction[]> {
    if (!isFirebaseConfigured || !db) {
      return localStorageSim.getTransactions(uid);
    }
    const colRef = collection(db, 'users', uid, 'transactions');
    const q = query(colRef, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    const txs: Transaction[] = [];
    snap.forEach(d => {
      const data = d.data();
      txs.push({
        id: d.id,
        type: data.type,
        amount: data.amount,
        category: data.category,
        description: data.description,
        date: data.date,
        timestamp: data.timestamp
      });
    });
    return txs;
  },

  async addTransaction(uid: string, transaction: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    if (!isFirebaseConfigured || !db) {
      return localStorageSim.addTransaction(uid, transaction);
    }
    const colRef = collection(db, 'users', uid, 'transactions');
    const timestamp = Date.now();
    const docRef = await addDoc(colRef, {
      ...transaction,
      timestamp
    });
    return {
      ...transaction,
      id: docRef.id,
      timestamp
    };
  },

  async deleteTransaction(uid: string, transactionId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      return localStorageSim.deleteTransaction(uid, transactionId);
    }
    const docRef = doc(db, 'users', uid, 'transactions', transactionId);
    await deleteDoc(docRef);
  }
};

