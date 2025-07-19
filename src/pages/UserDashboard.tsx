import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  BookOpen,
  Star,
  PenTool,
  MessageCircle,
  ChevronDown,
  Folder,
  TrendingUp,
  ArrowRight,
  User as UserIcon,
  Search,
  Filter,
  Tag,
} from "lucide-react";
import { getPublishedArticles, Article } from "../lib/articles";
import { ArticleCard } from "../components/ArticleCard";
import { onSnapshot, collection, query, where } from "firebase/firestore";
import { firestore } from "../lib/firebase";
import { debounce, DataCache, PerformanceMonitor } from "../lib/performanceOptimizer";

interface DashboardData {
  publishedArticles: Article[];
  availableCategories: string[];
  recentArticles: Article[];
  topTags: { tag: string; count: number }[];
}

export const UserDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string>("");

  // Debounced search function
  const debouncedSearch = debounce((query: string) => {
    setSearchQuery(query);
  }, 300);
  // Load dashboard data with real-time updates
  useEffect(() => {
    if (!userProfile) return;

    PerformanceMonitor.startMeasurement('userDashboard_dataLoad');
    
    // Try to get cached data first
    const cachedData = DataCache.get<DashboardData>('userDashboard_data');
    if (cachedData) {
      setDashboardData(cachedData);
      setLoading(false);
    }
    const articlesQuery = query(
      collection(firestore, "articles"),
      where("status", "==", "published")
    );

    const unsubscribe = onSnapshot(articlesQuery, (snapshot) => {
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

        // Collect categories and tags
        article.categories?.forEach((cat) => categoriesSet.add(cat));
        article.tags?.forEach((tag) => {
          tagsMap.set(tag, (tagsMap.get(tag) || 0) + 1);
        });
      });

      // Sort articles by createdAt in memory
      articles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const availableCategories = Array.from(categoriesSet).sort();
      const recentArticles = articles.slice(0, 6);

      // Get top 10 tags sorted by count
      const topTags = Array.from(tagsMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const newData = {
        publishedArticles: articles,
        availableCategories,
        recentArticles,
        topTags,
      };
      
      setDashboardData(newData);
      DataCache.set('userDashboard_data', newData, 2 * 60 * 1000); // Cache for 2 minutes
      setLoading(false);
      PerformanceMonitor.endMeasurement('userDashboard_dataLoad');
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Filter articles based on search query, selected category, and selected tag
  useEffect(() => {
    if (!dashboardData) return;

    PerformanceMonitor.startMeasurement('userDashboard_filtering');
    let filtered = dashboardData.publishedArticles;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.content.toLowerCase().includes(query) ||
          article.excerpt.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((article) =>
        article.categories?.includes(selectedCategory)
      );
    }

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter((article) =>
        article.tags?.includes(selectedTag)
      );
    }

    setFilteredArticles(filtered.slice(0, 6));
    PerformanceMonitor.endMeasurement('userDashboard_filtering');
  }, [dashboardData, selectedCategory, searchQuery, selectedTag]);

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
          Unable to load dashboard
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

      {/* Dashboard Dropdown */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        <div className="space-y-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl hover:from-blue-100 hover:to-purple-100 transition-all duration-200"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 rounded-lg">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h3 className="font-medium text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">
                  Access your saved content and features
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
            <div className="bg-gray-50 rounded-xl border border-gray-200">
              <div className="p-3 space-y-2">
                <Link
                  to="/saved-articles"
                  className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
                >
                  <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Star className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-blue-700">
                      Saved Articles
                    </span>
                    <p className="text-xs text-gray-600">
                      View your bookmarked content
                    </p>
                  </div>
                </Link>

                <Link
                  to="/writer-request"
                  className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
                >
                  <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                    <PenTool className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-purple-700">
                      Apply for InfoWriter
                    </span>
                    <p className="text-xs text-gray-600">
                      Request content creation access
                    </p>
                  </div>
                </Link>

                <Link
                  to="/chats"
                  className="flex items-center space-x-3 p-3 hover:bg-white rounded-lg transition-colors duration-150 group"
                >
                  <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                    <MessageCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 group-hover:text-green-700">
                      Chats
                    </span>
                    <p className="text-xs text-gray-600">
                      Connect with other users
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Articles */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedCategory
              ? `Articles in "${selectedCategory}"`
              : "Recent Articles"}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            <span>{filteredArticles.length} articles</span>
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedCategory
                ? "No articles in this category"
                : "No articles yet"}
            </h3>
            <p className="text-gray-600">
              {selectedCategory
                ? "Try selecting a different category or clear the filter."
                : "Be the first to contribute to the knowledge base!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                variant="default"
                showActions={true}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
