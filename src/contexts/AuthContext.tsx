import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'infowriter' | 'admin';
  emailVerified: boolean;
  profilePicture?: string;
  createdAt?: Date;
  updatedAt?: Date;
  requestedWriterAccess?: boolean;
}

export interface CachedPermissions {
  canCreateArticles: boolean;
  canManageUsers: boolean;
  canAccessAdmin: boolean;
  canEditAnyArticle: boolean;
  canDeleteArticles: boolean;
  canApproveWriters: boolean;
  canViewAnalytics: boolean;
  dashboardRoute: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  permissions: CachedPermissions | null;
  isAuthenticated: boolean;
  emailVerified: boolean;
  loading: boolean;
  profileLoading: boolean;
  
  // Role checks (cached)
  isAdmin: boolean;
  isInfoWriter: boolean;
  isUser: boolean;
  
  // Permission checks (cached)
  canCreateArticles: boolean;
  canManageUsers: boolean;
  canAccessAdmin: boolean;
  canEditAnyArticle: boolean;
  canDeleteArticles: boolean;
  canApproveWriters: boolean;
  canViewAnalytics: boolean;
  
  // Methods
  refreshProfile: () => Promise<void>;
  hasRole: (role: 'user' | 'infowriter' | 'admin') => boolean;
  hasAnyRole: (roles: ('user' | 'infowriter' | 'admin')[]) => boolean;
  canEditArticle: (authorId: string) => boolean;
  getDashboardRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache keys for localStorage
const CACHE_KEYS = {
  USER_PROFILE: 'infonest_user_profile',
  PERMISSIONS: 'infonest_permissions',
  LAST_UPDATED: 'infonest_cache_updated'
};

// Cache expiry time (5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;

// Generate permissions based on user role
const generatePermissions = (role: 'user' | 'infowriter' | 'admin'): CachedPermissions => {
  const basePermissions: CachedPermissions = {
    canCreateArticles: false,
    canManageUsers: false,
    canAccessAdmin: false,
    canEditAnyArticle: false,
    canDeleteArticles: false,
    canApproveWriters: false,
    canViewAnalytics: false,
    dashboardRoute: '/dashboard'
  };

  switch (role) {
    case 'admin':
      return {
        canCreateArticles: true,
        canManageUsers: true,
        canAccessAdmin: true,
        canEditAnyArticle: true,
        canDeleteArticles: true,
        canApproveWriters: true,
        canViewAnalytics: true,
        dashboardRoute: '/dashboard'
      };
    
    case 'infowriter':
      return {
        ...basePermissions,
        canCreateArticles: true,
        canEditAnyArticle: false,
        canViewAnalytics: false,
        dashboardRoute: '/dashboard'
      };
    
    case 'user':
    default:
      return {
        ...basePermissions,
        dashboardRoute: '/dashboard'
      };
  }
};

// Cache management utilities
const getCachedData = <T>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const lastUpdated = localStorage.getItem(CACHE_KEYS.LAST_UPDATED);
    if (!lastUpdated) return null;
    
    const cacheAge = Date.now() - parseInt(lastUpdated);
    if (cacheAge > CACHE_EXPIRY) {
      // Cache expired, clear it
      clearCache();
      return null;
    }
    
    return JSON.parse(cached);
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
};

const setCachedData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem(CACHE_KEYS.LAST_UPDATED, Date.now().toString());
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

const clearCache = (): void => {
  try {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<CachedPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Initialize from cache
  useEffect(() => {
    const cachedProfile = getCachedData<UserProfile>(CACHE_KEYS.USER_PROFILE);
    const cachedPermissions = getCachedData<CachedPermissions>(CACHE_KEYS.PERMISSIONS);
    
    if (cachedProfile && cachedPermissions) {
      setUserProfile(cachedProfile);
      setPermissions(cachedPermissions);
    }
  }, []);

  const loadUserProfile = async (firebaseUser: User): Promise<void> => {
    try {
      setProfileLoading(true);
      await firebaseUser.reload();
      
      const profileRef = doc(firestore, 'users', firebaseUser.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();
        
        const profile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: data.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
          role: data.role || 'user',
          emailVerified: firebaseUser.emailVerified,
          profilePicture: data.profilePicture || '',
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          requestedWriterAccess: data.requestedWriterAccess,
        };

        const userPermissions = generatePermissions(profile.role);

        // Cache the profile and permissions
        setCachedData(CACHE_KEYS.USER_PROFILE, profile);
        setCachedData(CACHE_KEYS.PERMISSIONS, userPermissions);

        setUserProfile(profile);
        setPermissions(userPermissions);
      } else {
        setUserProfile(null);
        setPermissions(null);
        clearCache();
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setUserProfile(null);
      setPermissions(null);
      clearCache();
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (!auth.currentUser) return;
    
    // Clear cache to force fresh data
    clearCache();
    await loadUserProfile(auth.currentUser);
  };

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setUser(firebaseUser);

      if (firebaseUser) {
        await loadUserProfile(firebaseUser);
      } else {
        setUser(null);
        setUserProfile(null);
        setPermissions(null);
        clearCache();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time profile updates (only when user is authenticated)
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = doc(firestore, 'users', user.uid);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: data.displayName || user.displayName || user.email?.split('@')[0] || '',
          role: data.role || 'user',
          emailVerified: user.emailVerified,
          profilePicture: data.profilePicture || '',
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          requestedWriterAccess: data.requestedWriterAccess,
        };

        const userPermissions = generatePermissions(profile.role);

        // Update cache
        setCachedData(CACHE_KEYS.USER_PROFILE, profile);
        setCachedData(CACHE_KEYS.PERMISSIONS, userPermissions);

        setUserProfile(profile);
        setPermissions(userPermissions);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Cached role checks
  const isAdmin = permissions?.canAccessAdmin || false;
  const isInfoWriter = permissions?.canCreateArticles && !permissions?.canAccessAdmin || false;
  const isUser = userProfile?.role === 'user' || false;

  // Permission methods (using cached data)
  const hasRole = (role: 'user' | 'infowriter' | 'admin'): boolean => {
    return userProfile?.role === role;
  };

  const hasAnyRole = (roles: ('user' | 'infowriter' | 'admin')[]): boolean => {
    return userProfile ? roles.includes(userProfile.role) : false;
  };

  const canEditArticle = (authorId: string): boolean => {
    if (!userProfile || !permissions) return false;
    return userProfile.uid === authorId || permissions.canEditAnyArticle;
  };

  const getDashboardRoute = (): string => {
    return permissions?.dashboardRoute || '/dashboard';
  };

  const contextValue: AuthContextType = {
    user,
    userProfile,
    permissions,
    isAuthenticated: !!user,
    emailVerified: user?.emailVerified || false,
    loading: loading || profileLoading,
    profileLoading,
    
    // Cached role checks
    isAdmin,
    isInfoWriter,
    isUser,
    
    // Cached permission checks
    canCreateArticles: permissions?.canCreateArticles || false,
    canManageUsers: permissions?.canManageUsers || false,
    canAccessAdmin: permissions?.canAccessAdmin || false,
    canEditAnyArticle: permissions?.canEditAnyArticle || false,
    canDeleteArticles: permissions?.canDeleteArticles || false,
    canApproveWriters: permissions?.canApproveWriters || false,
    canViewAnalytics: permissions?.canViewAnalytics || false,
    
    // Methods
    refreshProfile,
    hasRole,
    hasAnyRole,
    canEditArticle,
    getDashboardRoute,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};