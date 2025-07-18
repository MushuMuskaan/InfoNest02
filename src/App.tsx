import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./hooks/useAuth";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Layout } from "./components/Layout";
import { AuthForm } from "./components/AuthForm";
import { EmailVerificationPage } from "./pages/EmailVerificationPage";
import { HomePage } from "./pages/HomePage";
import { Dashboard } from "./pages/Dashboard";
import { ArticleEditor } from "./pages/ArticleEditor";
import { ArticleView } from "./pages/ArticleView";
import { MyArticles } from "./pages/MyArticles";

import { SearchPage } from "./pages/SearchPage";
import { AdminPanel } from "./pages/AdminPanel";
import { WriterRequestPage } from "./pages/WriterRequestPage";
import { SavedArticles } from "./pages/SavedArticles";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { ChatsPage } from "./pages/ChatsPage";

import { ActiveWritersPage } from "./pages/ActiveWritersPage";
import { RemovedWritersPage } from "./pages/RemovedWritersPage";
import { PersonalDashboard } from "./pages/PersonalDashboard";
import {
  ProtectedRoute,
  AdminRoute,
  InfoWriterRoute,
  UserRoute,
} from "./components/ProtectedRoute";

function App() {
  // Main application component with notification system integrated
  const { loading, isAuthenticated, emailVerified } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#EFEDFA" }}
      >
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <NotificationProvider>
        <div
          className="App"
          style={{ backgroundColor: "#EFEDFA", minHeight: "100vh" }}
        >
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#fff",
                color: "#374151",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              },
            }}
          />

          <Routes>
            {/* Test Route */}
            <Route
              path="/test"
              element={
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                  <div className="bg-white p-8 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                      InfoNest Test Page
                    </h1>
                    <p className="text-gray-600 mb-4">
                      If you can see this, React is working!
                    </p>
                    <div className="space-y-2">
                      <p>Auth Loading: {loading ? "Yes" : "No"}</p>
                      <p>Is Authenticated: {isAuthenticated ? "Yes" : "No"}</p>
                      <p>Email Verified: {emailVerified ? "Yes" : "No"}</p>
                      <p>User Profile: None</p>
                    </div>
                    <div className="mt-4">
                      <a href="/" className="text-blue-600 hover:text-blue-800">
                        Go to HomePage
                      </a>
                    </div>
                  </div>
                </div>
              }
            />

            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route
              path="/auth"
              element={
                !isAuthenticated ? <AuthForm /> : <Navigate to="/" replace />
              }
            />
            <Route path="/email-verify" element={<EmailVerificationPage />} />

            {/* Protected Routes */}
            {isAuthenticated && emailVerified ? (
              <Route path="/*" element={<Layout />}>
                {/* Routes accessible to all authenticated users */}
                <Route
                  path="dashboard"
                  element={
                    <UserRoute>
                      <Dashboard />
                    </UserRoute>
                  }
                />
                <Route
                  path="search"
                  element={
                    <ProtectedRoute requiredRoles={["infowriter", "admin"]}>
                      <SearchPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="article/:id"
                  element={
                    <UserRoute>
                      <ArticleView />
                    </UserRoute>
                  }
                />
                <Route
                  path="writer-request"
                  element={
                    <UserRoute>
                      <WriterRequestPage />
                    </UserRoute>
                  }
                />
                <Route
                  path="saved-articles"
                  element={
                    <UserRoute>
                      <SavedArticles />
                    </UserRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <UserRoute>
                      <ProfilePage />
                    </UserRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <UserRoute>
                      <SettingsPage />
                    </UserRoute>
                  }
                />
                <Route
                  path="chats"
                  element={
                    <UserRoute>
                      <ChatsPage />
                    </UserRoute>
                  }
                />

                {/* InfoWriter and Admin only routes */}
                <Route
                  path="article/new"
                  element={
                    <InfoWriterRoute>
                      <ArticleEditor />
                    </InfoWriterRoute>
                  }
                />
                <Route
                  path="article/edit/:id"
                  element={
                    <InfoWriterRoute>
                      <ArticleEditor />
                    </InfoWriterRoute>
                  }
                />
                <Route
                  path="my-articles"
                  element={
                    <ProtectedRoute requiredRole="infowriter">
                      <MyArticles />
                    </ProtectedRoute>
                  }
                />

                {/* Admin only routes */}
                <Route
                  path="personal-dashboard"
                  element={
                    <AdminRoute>
                      <PersonalDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/writer-requests"
                  element={
                    <AdminRoute>
                      <WriterRequestPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/active-writers"
                  element={
                    <AdminRoute>
                      <ActiveWritersPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/removed-writers"
                  element={
                    <AdminRoute>
                      <RemovedWritersPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="admin/system"
                  element={
                    <AdminRoute>
                      <SettingsPage />
                    </AdminRoute>
                  }
                />

                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Route>
            ) : isAuthenticated && !emailVerified ? (
              <Route
                path="*"
                element={<Navigate to="/email-verify" replace />}
              />
            ) : (
              <Route path="*" element={<Navigate to="/auth" replace />} />
            )}
          </Routes>
        </div>
      </NotificationProvider>
    </Router>
  );
}

export default App;
