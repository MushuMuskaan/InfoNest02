// useAuth.ts - Enhanced with proper async loading
import { useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, firestore } from "../lib/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: "user" | "infowriter" | "admin";
  emailVerified: boolean;
  profilePicture?: string;
  createdAt?: Date;
  updatedAt?: Date;
  requestedWriterAccess?: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = async (): Promise<void> => {
    if (!auth.currentUser) return;

    setProfileLoading(true);
    try {
      await auth.currentUser.reload();
      const currentUser = auth.currentUser;
      const profileRef = doc(firestore, "users", currentUser.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();

        setUserProfile({
          uid: currentUser.uid,
          email: currentUser.email || "",
          // Prioritize Firestore displayName over Firebase Auth displayName
          displayName:
            data.displayName ||
            currentUser.displayName ||
            currentUser.email?.split("@")[0] ||
            "",
          role: data.role || "user",
          emailVerified: currentUser.emailVerified,
          profilePicture: data.profilePicture || "",
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          requestedWriterAccess: data.requestedWriterAccess,
        });
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  const loadUserProfile = async (firebaseUser: User): Promise<void> => {
    try {
      await firebaseUser.reload();
      const profileRef = doc(firestore, "users", firebaseUser.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();

        setUserProfile({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          // Prioritize Firestore displayName over Firebase Auth displayName
          displayName:
            data.displayName ||
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "",
          role: data.role || "user",
          emailVerified: firebaseUser.emailVerified,
          profilePicture: data.profilePicture || "",
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          requestedWriterAccess: data.requestedWriterAccess,
        });
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error("Failed to load user profile:", error);
      setUserProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time profile updates - always call useEffect but conditionally set up listener
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(firestore, "users", user.uid);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();

        setUserProfile({
          uid: user.uid,
          email: user.email || "",
          // Prioritize Firestore displayName over Firebase Auth displayName
          displayName:
            data.displayName ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "",
          role: data.role || "user",
          emailVerified: user.emailVerified,
          profilePicture: data.profilePicture || "",
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          requestedWriterAccess: data.requestedWriterAccess,
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Enhanced role checking functions
  const hasRole = (role: "user" | "infowriter" | "admin"): boolean => {
    return userProfile?.role === role;
  };

  const hasAnyRole = (roles: ("user" | "infowriter" | "admin")[]): boolean => {
    return userProfile ? roles.includes(userProfile.role) : false;
  };

  const canCreateArticles = (): boolean => {
    return hasAnyRole(["infowriter", "admin"]);
  };

  const canManageUsers = (): boolean => {
    return hasRole("admin");
  };

  const canEditArticle = (authorId: string): boolean => {
    if (!userProfile) return false;
    return userProfile.uid === authorId || userProfile.role === "admin";
  };

  // Enhanced role checking with better performance
  const isUserRole = (role: "user" | "infowriter" | "admin"): boolean => {
    return userProfile?.role === role;
  };

  const hasMinimumRole = (
    minimumRole: "user" | "infowriter" | "admin"
  ): boolean => {
    if (!userProfile) return false;

    const roleHierarchy = { user: 1, infowriter: 2, admin: 3 };
    const userRoleLevel = roleHierarchy[userProfile.role];
    const requiredLevel = roleHierarchy[minimumRole];

    return userRoleLevel >= requiredLevel;
  };

  return {
    user,
    userProfile,
    isAuthenticated: !!user,
    emailVerified: user?.emailVerified || false,
    isAdmin: userProfile?.role === "admin",
    isInfoWriter: userProfile?.role === "infowriter",
    isUser: userProfile?.role === "user",
    loading: loading || profileLoading,
    refreshProfile,
    // Enhanced role functions
    hasRole,
    hasAnyRole,
    canCreateArticles,
    canManageUsers,
    canEditArticle,
    // New optimized role functions
    isUserRole,
    hasMinimumRole,
  };
};
