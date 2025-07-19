import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import {
  BookOpen,
  PenTool,
  UserCheck,
  UserX,
  ChevronDown,
  BarChart3,
  Settings,
  Search,
  Tag,
  Edit,
} from "lucide-react";
import { Article } from "../lib/articles";
import { ArticleCard } from "../components/ArticleCard";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { firestore } from "../lib/firebase";
import { debounce, DataCache, PerformanceMonitor } from "../lib/performanceOptimizer";

interface AdminDashboardData {
  publishedArticles: Article[];
  totalUsers: number;
  pendingWriterRequests: number;
  activeWriters: number;
  removedWriters: number;
  totalArticles: number;
  recentArticles: Article[];
  availableCategories: string[];
  topTags: { tag: string; count: number }[];
  systemStats: {
    totalArticles: number;
    totalCategories: number;
    totalTags: number;
  };
}

export const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Debounced search function
  const debouncedSearch = debounce((query: string) => {
    setSearchQuery(query);
  }, 300);
  // Listen for cross-component updates
  useEffect(() => {
    const handleWriterRequestProcessed = (event: CustomEvent) => {
      console.log("AdminDashboard: Writer request processed", event.detail);
      // The real-time listeners will automatically update the counts
    };

    window.addEventListener(
      "writerRequestProcessed",
      handleWriterRequestProcessed as EventListener
    );

    return () => {
      window.removeEventListener(
        "writerRequestProcessed",
        handleWriterRequestProcessed as EventListener
      );
    };
  }, []);

  // Load admin dashboard data with real-time updates
  useEffect(() => {
    if (!userProfile) return;

    PerformanceMonitor.startMeasurement('adminDashboard_dataLoad');
    
    // Try to get cached data first
    const cachedData = DataCache.get<AdminDashboardData>('adminDashboard_data');
    if (cachedData) {
      setDashboardData(cachedData);
      setLoading(false);
    }
    // Articles subscription
    const articlesQuery = query(
      collection(firestore, "articles"),
      where("status", "==", "published")
    );

    const unsubscribeArticles = onSnapshot(articlesQuery, (snapshot) => {
      const articles: Article[] = [];
      const categoriesSet = new Set<string>();
      const tagsMap = new Map<string, number>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const article = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
          publishedAt: data.publishedAt?.toDate(),
        } as Article;
        articles.push(article);

        if (data.category) categoriesSet.add(data.category);
        if (data.tags) {
          data.tags.forEach((tag: string) => {
            tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1);
          });
        }
      });

      // Sort articles by createdAt in memory
      articles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const recentArticles = articles.slice(0, 6);

      // Create top tags array
      const topTags = Array.from(tagsMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Users subscription
      const usersQuery = query(collection(firestore, "users"));
      const unsubscribeUsers = onSnapshot(usersQuery, (usersSnapshot) => {
        let totalUsers = 0;
        let legacyPendingRequests = 0;
        let activeWriters = 0;
        let removedWriters = 0;

        usersSnapshot.forEach((doc) => {
          totalUsers++;
          const userData = doc.data();

          // Count pending writer requests from legacy system
          if (userData.requestedWriterAccess && userData.role === "user") {
            legacyPendingRequests++;
          }

          // Count active writers
          if (userData.role === "infowriter") {
            activeWriters++;
          }

          // Count removed writers (users who previously had infowriter role but now don't)
          if (
            userData.previousRoles &&
            userData.previousRoles.includes(userData.uid || doc.id) &&
            userData.role !== "infowriter" &&
            userData.privilegesRemovedAt
          ) {
            removedWriters++;
          }
        });

        // Subscribe to new writerRequests collection for pending requests
        const writerRequestsQuery = query(
          collection(firestore, "writerRequests"),
          where("status", "==", "pending")
        );

        const unsubscribeWriterRequests = onSnapshot(
          writerRequestsQuery,
          (writerRequestsSnapshot) => {
            const newSystemPendingRequests = writerRequestsSnapshot.size;
            const totalPendingRequests =
              legacyPendingRequests + newSystemPendingRequests;

            const newData = {
              publishedArticles: articles,
              totalUsers,
              pendingWriterRequests: totalPendingRequests,
              activeWriters,
              removedWriters,
              totalArticles: articles.length,
              recentArticles,
              availableCategories: Array.from(categoriesSet),
              topTags,
              systemStats: {
                totalArticles: articles.length,
                totalCategories: categoriesSet.size,
                totalTags: tagsMap.size,
              },
            };
            
            setDashboardData(newData);
            DataCache.set('adminDashboard_data', newData, 2 * 60 * 1000); // Cache for 2 minutes
            setLoading(false);
            PerformanceMonitor.endMeasurement('adminDashboard_dataLoad');
          }
        );

        return () => unsubscribeWriterRequests();
      });

      return () => unsubscribeUsers();
    });

    return () => unsubscribeArticles();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Unable to load admin dashboard
        </h2>
        <p className="text-gray-600">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Search Engine */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        <div className="space-y-4">
          {/* Search Bar with Category Filter */}
          <div className="flex gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => debouncedSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Category Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">All Categories</option>
                {dashboardData.availableCategories
                  .slice(0, 8)
                  .map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Top 10 Real-time Tags */}
          <div className="flex flex-wrap gap-2">
            {dashboardData.topTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
                className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedTag === tag
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:text-purple-700"
                }`}
              >
                <Tag className="h-3 w-3" />
                <span>{tag}</span>
                <span className="text-xs opacity-75">({count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions Dropdown - InfoWriter Style */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        <div className="space-y-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:to-purple-100 transition-all duration-200"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">
                  Manage platform and user administration
                </p>
              </div>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Accordion-style dropdown content */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isDropdownOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="space-y-3 pt-2">
              {/* Total Articles - Informational Display */}
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Total Articles</p>
                  <p className="text-sm text-gray-600">
                    Published articles on the platform
                  </p>
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-lg font-bold">
                  {dashboardData?.systemStats.totalArticles || 0}
                </span>
              </div>

              <Link
                to="/admin/writer-requests"
                className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
              >
                <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors">
                  <PenTool className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    InfoWriter Requests
                  </p>
                  <p className="text-sm text-gray-600">
                    Review and approve writer applications
                  </p>
                </div>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm font-medium">
                  {dashboardData?.pendingWriterRequests || 0}
                </span>
              </Link>

              <Link
                to="/admin/active-writers"
                className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
              >
                <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                  <UserCheck className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Active Writers</p>
                  <p className="text-sm text-gray-600">
                    Manage current InfoWriter privileges
                  </p>
                </div>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                  {dashboardData?.activeWriters || 0}
                </span>
              </Link>

              <Link
                to="/admin/removed-writers"
                className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
              >
                <div className="bg-red-100 p-2 rounded-lg group-hover:bg-red-200 transition-colors">
                  <UserX className="h-4 w-4 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Removed Writers</p>
                  <p className="text-sm text-gray-600">
                    View and restore writer privileges
                  </p>
                </div>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                  {dashboardData?.removedWriters || 0}
                </span>
              </Link>

              <Link
                to="/personal-dashboard"
                className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
              >
                <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <Edit className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    Personal Dashboard
                  </p>
                  <p className="text-sm text-gray-600">
                    Create and manage your own articles
                  </p>
                </div>
              </Link>

              <Link
                to="/admin/system"
                className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
              >
                <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-gray-200 transition-colors">
                  <Settings className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">System Settings</p>
                  <p className="text-sm text-gray-600">
                    Configure platform settings
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Articles */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        {!dashboardData.publishedArticles ||
        dashboardData.publishedArticles.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No articles yet
            </h3>
            <p className="text-gray-600">
              Articles will appear here once published.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData.publishedArticles
              .sort((a, b) => (b.views || 0) - (a.views || 0))
              .slice(0, 6)
              .map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  variant="compact"
                  showActions={true}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
