import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { WriterRequestForm } from "../components/WriterRequestForm";
import { useNavigate } from "react-router-dom";
import {
  onSnapshot,
  collection,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { firestore } from "../lib/firebase";
import {
  getUserWriterRequest,
  getWriterRequests,
  processWriterRequest,
  RequestStatus,
} from "../lib/writerRequests";
import { approveWriterRequest } from "../lib/auth";
import { createInfoWriterApprovalNotification } from "../lib/notifications";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Mail,
  Calendar,
  FileText,
  Tag,
  Users,
  Eye,
  MessageSquare,
  Loader2,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import toast from "react-hot-toast";

// Combined request interface
interface CombinedWriterRequest {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  profilePicture?: string;
  requestedAt: Date;
  status: RequestStatus | "pending" | "approved" | "rejected";
  adminNote?: string;
  processedAt?: Date;
  processedBy?: string;
  // New system fields
  qualifications?: string;
  areasOfInterest?: string[];
  proposedTitle?: string;
  briefDescription?: string;
  targetAudience?: string;
  requestId?: string;
  // System source
  source: "legacy" | "new";
}

export const WriterRequestPage: React.FC = () => {
  const {
    userProfile,
    isAuthenticated,
    isAdmin,
    loading: authLoading,
  } = useAuth();
  const navigate = useNavigate();

  // Debug logging
  useEffect(() => {
    console.log("WriterRequestPage mounted", {
      isAuthenticated,
      isAdmin,
      userProfile: userProfile?.email,
      authLoading
    });
  }, [isAuthenticated, isAdmin, userProfile, authLoading]);

  // State management
  const [currentUserRequest, setCurrentUserRequest] =
    useState<CombinedWriterRequest | null>(null);
  const [allRequests, setAllRequests] = useState<CombinedWriterRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<CombinedWriterRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Load user's current request and all requests (if admin)
  useEffect(() => {
    // If auth is still loading, wait
    if (authLoading) {
      console.log("Auth still loading, waiting...");
      setLoading(true);
      return;
    }

    // If not authenticated, stop loading
    if (!isAuthenticated) {
      console.log("Not authenticated, stopping load");
      setLoading(false);
      return;
    }

    // If no userProfile yet, wait
    if (!userProfile) {
      console.log("No userProfile yet, waiting...");
      setLoading(true);
      return;
    }

    const loadRequests = async () => {
      console.log("Starting loadRequests for:", {
        userId: userProfile.uid,
        isAdmin,
      });
      setLoading(true);
      try {
        // Load current user's request from both systems
        await loadCurrentUserRequest();

        // If admin, load all requests
        if (isAdmin) {
          await loadAllRequests();
        }
        console.log("Requests loaded successfully");
      } catch (error) {
        console.error("Error loading requests:", error);
        toast.error("Failed to load requests");
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [isAuthenticated, userProfile, isAdmin, authLoading]);

  // Real-time updates for current user's request
  useEffect(() => {
    if (!userProfile) return;

    // Listen to legacy system (users collection)
    const legacyQuery = query(
      collection(firestore, "users"),
      where("uid", "==", userProfile.uid)
    );

    const unsubscribeLegacy = onSnapshot(legacyQuery, (snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.requestedWriterAccess) {
          const legacyRequest: CombinedWriterRequest = {
            id: doc.id,
            userId: data.uid || doc.id,
            displayName: data.displayName || "Unknown User",
            email: data.email || "",
            profilePicture: data.profilePicture,
            requestedAt: data.requestedWriterAccessAt?.toDate() || new Date(),
            status:
              data.role === "infowriter"
                ? "approved"
                : data.writerRequestRejected
                ? "rejected"
                : "pending",
            adminNote: data.adminNote,
            processedAt: data.writerRequestProcessedAt?.toDate(),
            processedBy: data.writerRequestProcessedBy,
            source: "legacy",
          };
          setCurrentUserRequest(legacyRequest);
        }
      });
    });

    return () => unsubscribeLegacy();
  }, [userProfile]);

  // Real-time updates for all requests (admin only)
  useEffect(() => {
    if (!isAdmin) return;

    // Listen to new system (writerRequests collection)
    const newSystemQuery = query(collection(firestore, "writerRequests"));

    const unsubscribeNew = onSnapshot(newSystemQuery, async (snapshot) => {
      console.log(
        "Real-time update: New system requests changed",
        snapshot.size
      );
      await loadAllRequests();
    });

    // Listen to legacy system (users collection)
    const legacyQuery = query(
      collection(firestore, "users"),
      where("requestedWriterAccess", "==", true)
    );

    const unsubscribeLegacy = onSnapshot(legacyQuery, async (snapshot) => {
      console.log(
        "Real-time update: Legacy system requests changed",
        snapshot.size
      );
      await loadAllRequests();
    });

    return () => {
      unsubscribeNew();
      unsubscribeLegacy();
    };
  }, [isAdmin]);

  // Handle authentication redirect in useEffect
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  // Early return if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const loadCurrentUserRequest = async () => {
    if (!userProfile) return;

    try {
      // Check new system first
      const newRequest = await getUserWriterRequest(userProfile.uid);
      if (newRequest) {
        const combinedRequest: CombinedWriterRequest = {
          id: newRequest.id,
          userId: newRequest.userId,
          displayName: newRequest.fullName,
          email: newRequest.email,
          requestedAt: newRequest.submittedAt,
          status: newRequest.status,
          adminNote: newRequest.adminNotes,
          processedAt: newRequest.processedAt,
          processedBy: newRequest.processedBy,
          qualifications: newRequest.qualifications,
          areasOfInterest: newRequest.areasOfInterest,
          proposedTitle: newRequest.proposedTitle,
          briefDescription: newRequest.briefDescription,
          targetAudience: newRequest.targetAudience,
          requestId: newRequest.requestId,
          source: "new",
        };
        setCurrentUserRequest(combinedRequest);
        return;
      }

      // Check legacy system
      const userDoc = doc(firestore, "users", userProfile.uid);
      const userSnapshot = await getDoc(userDoc);
      if (userSnapshot.exists()) {
        const data = userSnapshot.data();
        if (data.requestedWriterAccess) {
          const legacyRequest: CombinedWriterRequest = {
            id: userSnapshot.id,
            userId: data.uid || userSnapshot.id,
            displayName: data.displayName || "Unknown User",
            email: data.email || "",
            profilePicture: data.profilePicture,
            requestedAt: data.requestedWriterAccessAt?.toDate() || new Date(),
            status:
              data.role === "infowriter"
                ? "approved"
                : data.writerRequestRejected
                ? "rejected"
                : "pending",
            adminNote: data.adminNote,
            processedAt: data.writerRequestProcessedAt?.toDate(),
            processedBy: data.writerRequestProcessedBy,
            source: "legacy",
          };
          setCurrentUserRequest(legacyRequest);
        }
      }
    } catch (error) {
      console.error("Error loading current user request:", error);
    }
  };

  const loadAllRequests = async () => {
    if (!isAdmin) return;

    try {
      const combinedRequests: CombinedWriterRequest[] = [];

      // Load from new system
      const newRequests = await getWriterRequests();
      newRequests.forEach((request) => {
        combinedRequests.push({
          id: request.id,
          userId: request.userId,
          displayName: request.fullName,
          email: request.email,
          requestedAt: request.submittedAt,
          status: request.status,
          adminNote: request.adminNotes,
          processedAt: request.processedAt,
          processedBy: request.processedBy,
          qualifications: request.qualifications,
          areasOfInterest: request.areasOfInterest,
          proposedTitle: request.proposedTitle,
          briefDescription: request.briefDescription,
          targetAudience: request.targetAudience,
          requestId: request.requestId,
          source: "new",
        });
      });

      // Load from legacy system
      const legacyQuery = query(
        collection(firestore, "users"),
        where("requestedWriterAccess", "==", true)
      );

      const legacySnapshot = await getDocs(legacyQuery);
      legacySnapshot.forEach((doc) => {
        const data = doc.data();
        // Avoid duplicates - check if user already exists in new system
        const existsInNew = combinedRequests.some(
          (r) => r.userId === (data.uid || doc.id)
        );
        if (!existsInNew) {
          combinedRequests.push({
            id: doc.id,
            userId: data.uid || doc.id,
            displayName: data.displayName || "Unknown User",
            email: data.email || "",
            profilePicture: data.profilePicture,
            requestedAt: data.requestedWriterAccessAt?.toDate() || new Date(),
            status:
              data.role === "infowriter"
                ? "approved"
                : data.writerRequestRejected
                ? "rejected"
                : "pending",
            adminNote: data.adminNote,
            processedAt: data.writerRequestProcessedAt?.toDate(),
            processedBy: data.writerRequestProcessedBy,
            source: "legacy",
          });
        }
      });

      // Sort by request date (newest first)
      combinedRequests.sort(
        (a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()
      );
      setAllRequests(combinedRequests);
    } catch (error) {
      console.error("Error loading all requests:", error);
      toast.error("Failed to load requests");
    }
  };

  const handleProcessRequest = async (
    request: CombinedWriterRequest,
    action: "approve" | "reject"
  ) => {
    if (!userProfile || !isAdmin) return;

    setProcessingId(request.id);
    try {
      if (request.source === "new") {
        // Process new system request
        await processWriterRequest(
          request.id,
          action === "approve" ? "approved" : "rejected",
          userProfile.uid,
          adminNotes
        );

        // If approved, also update user role in auth system
        if (action === "approve") {
          await approveWriterRequest(request.userId);

          // Create notification
          try {
            await createInfoWriterApprovalNotification(request.userId);
          } catch (notifError) {
            console.error("Failed to create notification:", notifError);
          }
        }
      } else {
        // Process legacy system request
        const userRef = doc(firestore, "users", request.id);

        if (action === "approve") {
          await updateDoc(userRef, {
            role: "infowriter",
            writerRequestProcessedAt: serverTimestamp(),
            writerRequestProcessedBy: userProfile.uid,
            adminNote: adminNotes,
            requestedWriterAccess: false,
          });

          // Create notification
          try {
            await createInfoWriterApprovalNotification(request.userId);
          } catch (notifError) {
            console.error("Failed to create notification:", notifError);
          }
        } else {
          await updateDoc(userRef, {
            writerRequestRejected: true,
            writerRequestProcessedAt: serverTimestamp(),
            writerRequestProcessedBy: userProfile.uid,
            adminNote: adminNotes,
            requestedWriterAccess: false,
          });
        }
      }

      // Refresh data
      await loadAllRequests();
      await loadCurrentUserRequest();

      setSelectedRequest(null);
      setAdminNotes("");
      toast.success(`Request ${action}d successfully!`);

      // Trigger a custom event for cross-component updates
      window.dispatchEvent(
        new CustomEvent("writerRequestProcessed", {
          detail: { requestId: request.id, action, userId: request.userId },
        })
      );
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} request`);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const filteredRequests = allRequests.filter(
    (request) => request.status === "pending"
  );

  if (loading) {
    return (
      <div
        className="min-h-screen py-8 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: "#EFEDFA" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading requests...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen py-8 px-4 sm:px-6 lg:px-8"
      style={{ backgroundColor: "#EFEDFA" }}
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isAdmin ? "InfoWriter Requests" : "InfoWriter Application"}
            </h1>
          </div>
        </div>

        {/* New Application Form */}
        {!isAdmin &&
          (!currentUserRequest || currentUserRequest.status !== "pending") && (
            <div className="mb-8">
              <WriterRequestForm onClose={() => navigate("/dashboard")} />
            </div>
          )}

        {/* Current User Request Status */}
        {!isAdmin && currentUserRequest && (
          <div className="mb-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Your Request Status
                </h2>
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full border ${getStatusColor(
                    currentUserRequest.status
                  )}`}
                >
                  {getStatusIcon(currentUserRequest.status)}
                  <span className="text-sm font-medium capitalize">
                    {currentUserRequest.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Submitted{" "}
                    {formatDistanceToNow(currentUserRequest.requestedAt)} ago
                  </span>
                </div>

                {currentUserRequest.processedAt && (
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      Processed{" "}
                      {formatDistanceToNow(currentUserRequest.processedAt)} ago
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4" />
                  <span>
                    Source:{" "}
                    {currentUserRequest.source === "new"
                      ? "New System"
                      : "Legacy System"}
                  </span>
                </div>

                {currentUserRequest.requestId && (
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>ID: {currentUserRequest.requestId}</span>
                  </div>
                )}
              </div>

              {currentUserRequest.adminNote && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Admin Note
                      </p>
                      <p className="text-sm text-blue-800 mt-1">
                        {currentUserRequest.adminNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Application Form */}
        {!isAdmin &&
          (!currentUserRequest || currentUserRequest.status !== "pending") && (
            <div className="mb-8">
              <WriterRequestForm onClose={() => navigate("/dashboard")} />
            </div>
          )}

        {/* Admin Panel */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Request List */}
            <div className="space-y-4">
              {filteredRequests.length === 0 ? (
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No pending requests
                  </h3>
                  <p className="text-gray-600">
                    All requests have been processed.
                  </p>
                </div>
              ) : (
                filteredRequests.map((request) => (
                  <div
                    key={`${request.source}-${request.id}`}
                    className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {/* Profile Picture */}
                        <div className="flex-shrink-0">
                          {request.profilePicture ? (
                            <img
                              className="h-12 w-12 rounded-full object-cover"
                              src={request.profilePicture}
                              alt={request.displayName}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                              <User className="h-6 w-6 text-blue-600" />
                            </div>
                          )}
                        </div>

                        {/* Request Info */}
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {request.displayName}
                            </h3>
                            <div
                              className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-xs ${getStatusColor(
                                request.status
                              )}`}
                            >
                              {getStatusIcon(request.status)}
                              <span className="font-medium capitalize">
                                {request.status}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {request.source === "new"
                                ? "New System"
                                : "Legacy"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600 mb-3">
                            <div className="flex items-center space-x-2">
                              <Mail className="h-4 w-4" />
                              <span>{request.email}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                Submitted{" "}
                                {formatDistanceToNow(request.requestedAt)} ago
                              </span>
                            </div>
                            {request.processedAt && (
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>
                                  Processed{" "}
                                  {formatDistanceToNow(request.processedAt)} ago
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Additional Info for New System */}
                          {request.source === "new" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                              {request.proposedTitle && (
                                <div className="flex items-center space-x-2">
                                  <FileText className="h-4 w-4" />
                                  <span className="truncate">
                                    {request.proposedTitle}
                                  </span>
                                </div>
                              )}
                              {request.targetAudience && (
                                <div className="flex items-center space-x-2">
                                  <Users className="h-4 w-4" />
                                  <span className="capitalize">
                                    {request.targetAudience.replace("-", " ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Admin Note */}
                          {request.adminNote && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-start space-x-2">
                                <MessageSquare className="h-4 w-4 text-yellow-600 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-yellow-900">
                                    Admin Note
                                  </p>
                                  <p className="text-sm text-yellow-800 mt-1">
                                    {request.adminNote}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="text-sm">View</span>
                        </button>

                        {request.status === "pending" && (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                handleProcessRequest(request, "approve")
                              }
                              disabled={processingId === request.id}
                              className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              <span className="text-sm">Approve</span>
                            </button>
                            <button
                              onClick={() =>
                                handleProcessRequest(request, "reject")
                              }
                              disabled={processingId === request.id}
                              className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                              <span className="text-sm">Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Request Detail Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Request Details
                  </h3>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* User Info */}
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-xl">
                    {selectedRequest.profilePicture ? (
                      <img
                        className="h-16 w-16 rounded-full object-cover"
                        src={selectedRequest.profilePicture}
                        alt={selectedRequest.displayName}
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-8 w-8 text-blue-600" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900">
                        {selectedRequest.displayName}
                      </h4>
                      <p className="text-gray-600">{selectedRequest.email}</p>
                      <div className="flex items-center space-x-3 mt-2">
                        <div
                          className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-sm ${getStatusColor(
                            selectedRequest.status
                          )}`}
                        >
                          {getStatusIcon(selectedRequest.status)}
                          <span className="font-medium capitalize">
                            {selectedRequest.status}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          {selectedRequest.source === "new"
                            ? "New System"
                            : "Legacy System"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">
                        Request Information
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span>
                            Submitted:{" "}
                            {format(selectedRequest.requestedAt, "PPP")}
                          </span>
                        </div>
                        {selectedRequest.processedAt && (
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span>
                              Processed:{" "}
                              {format(selectedRequest.processedAt, "PPP")}
                            </span>
                          </div>
                        )}
                        {selectedRequest.requestId && (
                          <div className="flex items-center space-x-2">
                            <Tag className="h-4 w-4 text-gray-500" />
                            <span>Request ID: {selectedRequest.requestId}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* New System Details */}
                    {selectedRequest.source === "new" && (
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-3">
                          Application Details
                        </h5>
                        <div className="space-y-3 text-sm">
                          {selectedRequest.qualifications && (
                            <div>
                              <span className="font-medium text-gray-700">
                                Qualifications:
                              </span>
                              <p className="text-gray-600 mt-1">
                                {selectedRequest.qualifications}
                              </p>
                            </div>
                          )}
                          {selectedRequest.proposedTitle && (
                            <div>
                              <span className="font-medium text-gray-700">
                                Proposed Title:
                              </span>
                              <p className="text-gray-600 mt-1">
                                {selectedRequest.proposedTitle}
                              </p>
                            </div>
                          )}
                          {selectedRequest.targetAudience && (
                            <div>
                              <span className="font-medium text-gray-700">
                                Target Audience:
                              </span>
                              <p className="text-gray-600 mt-1 capitalize">
                                {selectedRequest.targetAudience.replace(
                                  "-",
                                  " "
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Areas of Interest */}
                  {selectedRequest.areasOfInterest &&
                    selectedRequest.areasOfInterest.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-gray-900 mb-3">
                          Areas of Interest
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {selectedRequest.areasOfInterest.map(
                            (area, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                              >
                                {area}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {/* Brief Description */}
                  {selectedRequest.briefDescription && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">
                        Brief Description
                      </h5>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {selectedRequest.briefDescription}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Admin Note */}
                  {selectedRequest.adminNote && (
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-3">
                        Admin Note
                      </h5>
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
                          {selectedRequest.adminNote}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Section */}
                  {selectedRequest.status === "pending" && (
                    <div className="border-t pt-6">
                      <h5 className="font-semibold text-gray-900 mb-3">
                        Admin Actions
                      </h5>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Admin Notes (Optional)
                          </label>
                          <textarea
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Add notes about your decision..."
                          />
                        </div>

                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() =>
                              handleProcessRequest(selectedRequest, "approve")
                            }
                            disabled={processingId === selectedRequest.id}
                            className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {processingId === selectedRequest.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <CheckCircle className="h-5 w-5" />
                            )}
                            <span>Approve Request</span>
                          </button>

                          <button
                            onClick={() =>
                              handleProcessRequest(selectedRequest, "reject")
                            }
                            disabled={processingId === selectedRequest.id}
                            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {processingId === selectedRequest.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <XCircle className="h-5 w-5" />
                            )}
                            <span>Reject Request</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
