import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { UserDashboard } from "./UserDashboard";
import { AdminDashboard } from "./AdminDashboard";
import { InfoWriterDashboard } from "./InfoWriterDashboard";

export const Dashboard: React.FC = () => {
  const { userProfile, isAdmin, isInfoWriter, isUser, loading, getDashboardRoute } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
        <p className="text-gray-600">Please log in to access the dashboard.</p>
      </div>
    );
  }

  // Route to appropriate dashboard based on user role
  if (isAdmin) {
    return <AdminDashboard />;
  }

  if (isInfoWriter) {
    return <InfoWriterDashboard />;
  }

  if (isUser) {
    return <UserDashboard />;
  }

  // Fallback for unknown roles
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Unknown Role</h2>
      <p className="text-gray-600">Your account role is not recognized. Please contact support.</p>
    </div>
  );
};