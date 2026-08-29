import { auth, db, isFirebaseConfigured } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
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
  deleteDoc,
} from 'firebase/firestore';
import { UserProfile, Transaction, RecurringItem } from '../utils/gamification';

// ------------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------------
const getTodayDateString = () => new Date().toISOString().split('T')[0];
const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

// ------------------------------------------------------------------
// Default profile factory
// ------------------------------------------------------------------
const buildDefaultProfile = (uid: string, email: string, username: string): UserProfile => ({
  uid,
  email,
  username,
  level: 1,
  xp: 0,
  coins: 100,
  budgetPeriod: 'monthly',
  budgetLimit: 1000,
  streak: 1,
  lastLoginDate: getTodayDateString(),
  unlockedAchievements: [],
  unlockedThemes: ['theme_zinc'],
  activeTheme: 'theme_zinc',
  activeAvatarFrame: 'frame_none',
  recurringExpenses: [],
  recurringIncome: [],
  createdAt: new Date().toISOString(),
});

// ------------------------------------------------------------------
// Back-fill helper (for old profiles missing new fields)
// ------------------------------------------------------------------
const backfillProfile = (data: Record<string, unknown>): UserProfile => ({
  uid: (data.uid as string) || '',
  email: (data.email as string) || '',
  username: (data.username as string) || '',
  level: (data.level as number) || 1,
  xp: (data.xp as number) || 0,
  coins: (data.coins as number) || 0,
  budgetPeriod: (data.budgetPeriod as UserProfile['budgetPeriod']) || 'monthly',
  budgetLimit: (data.budgetLimit as number) || (data.monthlyBudget as number) || 1000,
  streak: (data.streak as number) || 1,
  lastLoginDate: (data.lastLoginDate as string) || getTodayDateString(),
  unlockedAchievements: (data.unlockedAchievements as string[]) || [],
  unlockedThemes: (data.unlockedThemes as string[]) || ['theme_zinc'],
  activeTheme: (data.activeTheme as string) || 'theme_zinc',
  activeAvatarFrame: (data.activeAvatarFrame as string) || 'frame_none',
  recurringExpenses: (data.recurringExpenses as RecurringItem[]) || [],
  recurringIncome: (data.recurringIncome as RecurringItem[]) || [],
  createdAt: (data.createdAt as string) || new Date().toISOString(),
});

// ------------------------------------------------------------------
// Streak logic
// ------------------------------------------------------------------
const applyLoginStreak = (profile: UserProfile): UserProfile => {
  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();
  if (profile.lastLoginDate === today) return profile;

  const wasYesterday = profile.lastLoginDate === yesterday;
  const streak = wasYesterday ? profile.streak + 1 : 1;
  let xpGain = wasYesterday ? 20 : 10;
  let coinGain = wasYesterday ? 10 : 5;

  let newXp = profile.xp + xpGain;
  let newLevel = profile.level;
  if (newXp >= newLevel * 150) {
    newXp -= newLevel * 150;
    newLevel += 1;
    coinGain += newLevel * 50;
  }

  return { ...profile, streak, lastLoginDate: today, xp: newXp, level: newLevel, coins: profile.coins + coinGain };
};

// ------------------------------------------------------------------
// Local Storage key helpers (simple prefix functions, NOT object props)
// ------------------------------------------------------------------
const lsUsersKey = 'brpg_users';
const lsSessionKey = 'brpg_session';
const lsProfileKey = (uid: string) => `brpg_profile_${uid}`;
const lsTxsKey = (uid: string) => `brpg_txs_${uid}`;

const lsGetUsers = (): any[] => JSON.parse(localStorage.getItem(lsUsersKey) || '[]');
const lsSetUsers = (u: any[]) => localStorage.setItem(lsUsersKey, JSON.stringify(u));

const lsReadProfile = (uid: string): UserProfile | null => {
  const raw = localStorage.getItem(lsProfileKey(uid));
  return raw ? backfillProfile(JSON.parse(raw)) : null;
};
const lsWriteProfile = (uid: string, p: UserProfile) =>
  localStorage.setItem(lsProfileKey(uid), JSON.stringify(p));

const lsReadTxs = (uid: string): Transaction[] =>
  JSON.parse(localStorage.getItem(lsTxsKey(uid)) || '[]');
const lsWriteTxs = (uid: string, txs: Transaction[]) =>
  localStorage.setItem(lsTxsKey(uid), JSON.stringify(txs));

const lsDelay = (ms = 400) => new Promise<void>((r) => setTimeout(r, ms));

// ------------------------------------------------------------------
// LOCAL STORAGE FALLBACK FUNCTIONS
// ------------------------------------------------------------------
const lsSignUp = async (username: string, email: string, password: string): Promise<UserProfile> => {
  await lsDelay();
  const users = lsGetUsers();
  if (users.some((u: any) => u.email.toLowerCase() === email.toLowerCase()))
    throw new Error('An account with this email already exists.');
  if (users.some((u: any) => u.username.toLowerCase() === username.toLowerCase()))
    throw new Error('This username is already taken.');
  const uid = 'local_' + Math.random().toString(36).slice(2, 10);
  users.push({ uid, username, email, password });
  lsSetUsers(users);
  const profile = buildDefaultProfile(uid, email, username);
  lsWriteProfile(uid, profile);
  localStorage.setItem(lsSessionKey, JSON.stringify({ uid, email }));
  return profile;
};

const lsSignIn = async (emailOrUsername: string, password: string): Promise<UserProfile> => {
  await lsDelay();
  const users = lsGetUsers();
  const found = users.find(
    (u: any) =>
      (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
        u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
      u.password === password
  );
  if (!found) throw new Error('Invalid email/username or password.');
  localStorage.setItem(lsSessionKey, JSON.stringify({ uid: found.uid, email: found.email }));
  let profile = lsReadProfile(found.uid) || buildDefaultProfile(found.uid, found.email, found.username);
  profile = applyLoginStreak(profile);
  lsWriteProfile(found.uid, profile);
  return profile;
};

const lsSignOut = () => localStorage.removeItem(lsSessionKey);

const lsOnAuthStateChanged = (cb: (u: { uid: string; email: string } | null) => void) => {
  const raw = localStorage.getItem(lsSessionKey);
  cb(raw ? JSON.parse(raw) : null);
};

const lsGetProfile = async (uid: string): Promise<UserProfile> => {
  const p = lsReadProfile(uid);
  if (!p) throw new Error('Profile not found.');
  return p;
};

const lsUpdateProfile = async (uid: string, fields: Partial<UserProfile>): Promise<UserProfile> => {
  const current = await lsGetProfile(uid);
  const updated = { ...current, ...fields };
  lsWriteProfile(uid, updated);
  return updated;
};

const lsGetTxs = async (uid: string): Promise<Transaction[]> => lsReadTxs(uid);

const lsAddTx = async (uid: string, tx: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> => {
  await lsDelay(150);
  const list = lsReadTxs(uid);
  const newTx: Transaction = { ...tx, id: 'tx_' + Math.random().toString(36).slice(2, 10), timestamp: Date.now() };
  lsWriteTxs(uid, [newTx, ...list]);
  return newTx;
};

const lsDeleteTx = async (uid: string, id: string): Promise<void> => {
  lsWriteTxs(uid, lsReadTxs(uid).filter((t) => t.id !== id));
};

const lsAddRecurring = async (
  uid: string,
  type: 'income' | 'expense',
  item: Omit<RecurringItem, 'id'>
): Promise<RecurringItem> => {
  const profile = await lsGetProfile(uid);
  const newItem: RecurringItem = { ...item, id: 'ri_' + Math.random().toString(36).slice(2, 10) };
  const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
  lsWriteProfile(uid, { ...profile, [key]: [...profile[key], newItem] });
  return newItem;
};

const lsDeleteRecurring = async (uid: string, type: 'income' | 'expense', itemId: string): Promise<void> => {
  const profile = await lsGetProfile(uid);
  const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
  lsWriteProfile(uid, { ...profile, [key]: profile[key].filter((r) => r.id !== itemId) });
};

// ------------------------------------------------------------------
// DUAL-MODE DATA SERVICE (exported)
// ------------------------------------------------------------------
export const dataService = {
  isFirebase: isFirebaseConfigured,

  async signUp(username: string, email: string, password: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !auth || !db) return lsSignUp(username, email, password);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = buildDefaultProfile(cred.user.uid, email, username);
    await setDoc(doc(db, 'users', cred.user.uid), profile);
    return profile;
  },

  async signIn(emailOrUsername: string, password: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !auth || !db) return lsSignIn(emailOrUsername, password);
    if (!emailOrUsername.includes('@')) throw new Error('Please sign in with your email address.');
    const cred = await signInWithEmailAndPassword(auth, emailOrUsername, password);
    const ref = doc(db, 'users', cred.user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Profile not found in database.');
    let profile = backfillProfile(snap.data() as Record<string, unknown>);
    profile = applyLoginStreak(profile);
    await updateDoc(ref, profile as unknown as Record<string, unknown>);
    return profile;
  },

  async signOut(): Promise<void> {
    if (!isFirebaseConfigured || !auth) { lsSignOut(); return; }
    await firebaseSignOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    if (!isFirebaseConfigured || !auth) return;
    await sendPasswordResetEmail(auth, email);
  },

  onAuthStateChanged(cb: (u: { uid: string; email: string } | null) => void) {
    if (!isFirebaseConfigured || !auth) { lsOnAuthStateChanged(cb); return () => {}; }
    return firebaseOnAuthStateChanged(auth, (u: FirebaseUser | null) =>
      cb(u ? { uid: u.uid, email: u.email || '' } : null)
    );
  },

  async getUserProfile(uid: string): Promise<UserProfile> {
    if (!isFirebaseConfigured || !db) return lsGetProfile(uid);
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) throw new Error('Profile not found.');
    return backfillProfile(snap.data() as Record<string, unknown>);
  },

  async updateUserProfile(uid: string, fields: Partial<UserProfile>): Promise<UserProfile> {
    if (!isFirebaseConfigured || !db) return lsUpdateProfile(uid, fields);
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, fields as unknown as Record<string, unknown>);
    const snap = await getDoc(ref);
    return backfillProfile(snap.data() as Record<string, unknown>);
  },

  async getTransactions(uid: string): Promise<Transaction[]> {
    if (!isFirebaseConfigured || !db) return lsGetTxs(uid);
    const q = query(collection(db, 'users', uid, 'transactions'), orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
  },

  async addTransaction(uid: string, tx: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    if (!isFirebaseConfigured || !db) return lsAddTx(uid, tx);
    const timestamp = Date.now();
    const ref = await addDoc(collection(db, 'users', uid, 'transactions'), { ...tx, timestamp });
    return { ...tx, id: ref.id, timestamp };
  },

  async deleteTransaction(uid: string, txId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) { await lsDeleteTx(uid, txId); return; }
    await deleteDoc(doc(db, 'users', uid, 'transactions', txId));
  },

  async addRecurringItem(uid: string, type: 'income' | 'expense', item: Omit<RecurringItem, 'id'>): Promise<RecurringItem> {
    if (!isFirebaseConfigured || !db) return lsAddRecurring(uid, type, item);
    const profile = await this.getUserProfile(uid);
    const newItem: RecurringItem = { ...item, id: 'ri_' + Date.now().toString(36) };
    const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
    const updated = [...profile[key], newItem];
    await updateDoc(doc(db, 'users', uid), { [key]: updated });
    return newItem;
  },

  async deleteRecurringItem(uid: string, type: 'income' | 'expense', itemId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) { await lsDeleteRecurring(uid, type, itemId); return; }
    const profile = await this.getUserProfile(uid);
    const key = type === 'income' ? 'recurringIncome' : 'recurringExpenses';
    const updated = profile[key].filter((r) => r.id !== itemId);
    await updateDoc(doc(db, 'users', uid), { [key]: updated });
  },
};
