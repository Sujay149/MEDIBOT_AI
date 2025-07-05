
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

// Utility to get/set cached profile in localStorage
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

  // Manual re-fetch function with debouncing
  const refreshProfile = useCallback(async (uid: string) => {
    console.log("useAuth: Manually refreshing profile for user", uid);
    try {
      const profile = await getUserProfile(uid);
      console.log("useAuth: Refreshed profile", { photoURL: profile?.photoURL });
      setUserProfile(profile);
      setCachedProfile(uid, profile);
    } catch (error) {
      console.error("useAuth: Error refreshing profile:", error);
    }
  }, []);

  useEffect(() => {
    console.log("useAuth: Setting up auth listener");
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("useAuth: Auth state changed", { uid: firebaseUser?.uid, email: firebaseUser?.email });
      setUser(firebaseUser);

      if (firebaseUser) {
        // Load cached profile for faster initial render
        const cachedProfile = getCachedProfile(firebaseUser.uid);
        if (cachedProfile) {
          console.log("useAuth: Using cached profile", { photoURL: cachedProfile.photoURL });
          setUserProfile(cachedProfile);
        }

        // Set loading to false immediately after auth state resolves
        setLoading(false);

        // Fetch profile from Firestore (async, non-blocking)
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          console.log("useAuth: Initial profile fetched", { photoURL: profile?.photoURL });
          setUserProfile(profile);
          setCachedProfile(firebaseUser.uid, profile);
        } catch (error) {
          console.error("useAuth: Error fetching initial profile:", error);
          setUserProfile(null);
          setCachedProfile(firebaseUser.uid, null);
        }

        // Subscribe to real-time Firestore updates
        const userRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeFirestore = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              console.log("useAuth: Firestore snapshot updated", {
                photoURL: data.photoURL,
                displayName: data.displayName,
                updatedAt: data.updatedAt?.toString(),
              });
              const normalizedProfile = {
                ...data,
                gender: data.gender ?? "",
                medicalInfo: data.medicalInfo
                  ? { ...data.medicalInfo, bloodType: data.medicalInfo.bloodType ?? "" }
                  : { allergies: [], conditions: [], bloodType: "" },
              };
              setUserProfile(normalizedProfile);
              setCachedProfile(firebaseUser.uid, normalizedProfile);
            } else {
              console.log("useAuth: Firestore document does not exist for user", firebaseUser.uid);
              setUserProfile(null);
              setCachedProfile(firebaseUser.uid, null);
            }
          },
          (error) => {
            console.error("useAuth: Error in Firestore snapshot:", error);
            // Fallback: Retry refresh with exponential backoff
            setTimeout(() => refreshProfile(firebaseUser.uid), 1000);
          }
        );

        // Cleanup Firestore subscription
        return () => {
          console.log("useAuth: Cleaning up Firestore subscription for user", firebaseUser.uid);
          unsubscribeFirestore();
        };
      } else {
        console.log("useAuth: No authenticated user");
        setUserProfile(null);
        setCachedProfile("", null);
        setLoading(false);
      }
    });

    // Cleanup Auth subscription
    return () => {
      console.log("useAuth: Cleaning up auth subscription");
      unsubscribeAuth();
    };
  }, [refreshProfile]);

  const signIn = async (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
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
    console.log("useAuth: User signed out");
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
