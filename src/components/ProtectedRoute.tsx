import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, Shield, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'infowriter' | 'admin';
  requiredRoles?: ('user' | 'infowriter' | 'admin')[];
  fallbackPath?: string;
  showError?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredRoles,
  fallbackPath = '/dashboard',
  showError = true
}) => {
  const { userProfile, loading, isAuthenticated, hasRole, hasAnyRole, permissions } = useAuth();
  const location = useLocation();

  // Show loading while checking authentication and permissions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Wait for userProfile and permissions to be loaded before checking roles
  if (!userProfile || !permissions) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // Check role requirements using cached permissions
  let hasRequiredRole = true;
  
  if (requiredRole) {
    hasRequiredRole = hasRole(requiredRole);
  } else if (requiredRoles) {
    hasRequiredRole = hasAnyRole(requiredRoles);
  }

  // If user doesn't have required role
  if (!hasRequiredRole) {
    if (showError) {
      const roleText = requiredRole || requiredRoles?.join(' or ');
      toast.error(`You need ${roleText} privileges to access this page`);
    }
    
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

// Specific role-based components for common use cases
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRole="admin">
    {children}
  </ProtectedRoute>
);

export const InfoWriterRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={['infowriter', 'admin']}>
    {children}
  </ProtectedRoute>
);

export const UserRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={['user', 'infowriter', 'admin']}>
    {children}
  </ProtectedRoute>
);

// Role-based access denied component
export const AccessDenied: React.FC<{
  requiredRole?: string;
  currentRole?: string;
}> = ({ requiredRole, currentRole }) => (
  <div className="min-h-64 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-8">
      <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Lock className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-600 mb-4">
        You need {requiredRole} privileges to access this page.
      </p>
      {currentRole && (
        <p className="text-sm text-gray-500 mb-6">
          Your current role: <span className="font-medium">{currentRole}</span>
        </p>
      )}
      <div className="space-y-3">
        <button
          onClick={() => window.history.back()}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Go Back
        </button>
        <a
          href="/dashboard"
          className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  </div>
);

// Role badge component
export const RoleBadge: React.FC<{ role: 'user' | 'infowriter' | 'admin' }> = ({ role }) => {
  const getRoleConfig = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: Shield,
          label: 'Admin'
        };
      case 'infowriter':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: Shield,
          label: 'InfoWriter'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Shield,
          label: 'User'
        };
    }
  };

  const config = getRoleConfig(role);
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </span>
  );
};

// Permission checker component
export const PermissionGate: React.FC<{
  children: React.ReactNode;
  requiredRole?: 'user' | 'infowriter' | 'admin';
  requiredRoles?: ('user' | 'infowriter' | 'admin')[];
  fallback?: React.ReactNode;
}> = ({ children, requiredRole, requiredRoles, fallback = null }) => {
  const { hasRole, hasAnyRole } = useAuth();

  let hasPermission = true;
  
  if (requiredRole) {
    hasPermission = hasRole(requiredRole);
  } else if (requiredRoles) {
    hasPermission = hasAnyRole(requiredRoles);
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};
