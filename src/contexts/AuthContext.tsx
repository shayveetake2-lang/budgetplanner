import React, { createContext, useContext, useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { UserProfile } from '../utils/gamification';

interface AuthContextType {
  currentUser: { uid: string; email: string } | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (username: string, email: string, passwordString: string) => Promise<void>;
  signIn: (emailOrUsername: string, passwordString: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (fields: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Synchronize Auth Session with Firebase or Local Session
  useEffect(() => {
    const unsubscribe = dataService.onAuthStateChanged(async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          const profile = await dataService.getUserProfile(user.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUserProfile(null);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signUp = async (username: string, email: string, passwordString: string) => {
    setLoading(true);
    try {
      const profile = await dataService.signUp(username, email, passwordString);
      setCurrentUser({ uid: profile.uid, email: profile.email });
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (emailOrUsername: string, passwordString: string) => {
    setLoading(true);
    try {
      const profile = await dataService.signIn(emailOrUsername, passwordString);
      setCurrentUser({ uid: profile.uid, email: profile.email });
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await dataService.signOut();
      setCurrentUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (fields: Partial<UserProfile>) => {
    if (!currentUser) return;
    try {
      const updated = await dataService.updateUserProfile(currentUser.uid, fields);
      setUserProfile(updated);
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const profile = await dataService.getUserProfile(currentUser.uid);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

