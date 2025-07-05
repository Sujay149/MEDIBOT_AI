"use client";

import { useEffect, useState, useCallback } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider, facebookProvider } from "@/lib/firebase";
import { getUserProfile, type UserProfile } from "@/lib/firestore";

// Constants for caching
const PROFILE_CACHE_KEY = "medibot_user_profile";

const getCachedProfile = (uid: string): UserProfile | null => {
  try {
    const cached = localStorage.getItem(`${PROFILE_CACHE_KEY}_${uid}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error("useAuth: Error reading cached profile:", error);
    return null;
  }
};

const setCachedProfile = (uid: string, profile: UserProfile | null) => {
  try {
    if (profile) {
      localStorage.setItem(`${PROFILE_CACHE_KEY}_${uid}`, JSON.stringify(profile));
    } else {
      localStorage.removeItem(`${PROFILE_CACHE_KEY}_${uid}`);
    }
  } catch (error) {
    console.error("useAuth: Error caching profile:", error);
  }
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      setUserProfile(profile);
      setCachedProfile(uid, profile);
    } catch (error) {
      console.error("useAuth: Error refreshing profile:", error);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false); // Done with auth check

      if (firebaseUser) {
        const cached = getCachedProfile(firebaseUser.uid);
        if (cached && !userProfile) {
          setUserProfile(cached);
        }
      } else {
        if (userProfile !== null) {
          setUserProfile(null);
        }
        setCachedProfile("", null);
      }
    });

    return () => unsubscribeAuth();
  }, [userProfile]);

  // Firestore real-time profile sync
  useEffect(() => {
    if (!user) return;

    let unsubscribeFirestore: () => void;

    const fetchAndSubscribe = async () => {
      try {
        const profile = await getUserProfile(user.uid);
        if (
          !userProfile ||
          JSON.stringify(profile) !== JSON.stringify(userProfile)
        ) {
          setUserProfile(profile);
          setCachedProfile(user.uid, profile);
        }
      } catch (err) {
        console.error("useAuth: Error fetching profile:", err);
      }

      const userRef = doc(db, "users", user.uid);
      unsubscribeFirestore = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const normalizedProfile: UserProfile = {
              ...data,
              gender: data.gender ?? "",
              medicalInfo: data.medicalInfo
                ? {
                    ...data.medicalInfo,
                    bloodType: data.medicalInfo.bloodType ?? "",
                  }
                : { allergies: [], conditions: [], bloodType: "" },
            };
            setUserProfile(normalizedProfile);
            setCachedProfile(user.uid, normalizedProfile);
          }
        },
        (error) => {
          console.error("useAuth: Firestore snapshot error:", error);
          setTimeout(() => refreshProfile(user.uid), 1000); // Retry after delay
        }
      );
    };

    fetchAndSubscribe();

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, [user, refreshProfile]);

  // Auth functions
  const signIn = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && result.user) {
      await updateProfile(result.user, { displayName });
    }
    return result;
  };

  const signInWithGoogle = async () => {
    return signInWithPopup(auth, googleProvider);
  };

  const signInWithFacebook = async () => {
    return signInWithPopup(auth, facebookProvider);
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCachedProfile("", null);
  };

  const resetPassword = async (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  return {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithFacebook,
    logout,
    resetPassword,
    refreshProfile,
  };
}
