// Performance optimization utilities for InfoNest
import { UserProfile, CachedPermissions } from '../contexts/AuthContext';

// Debounce utility for search and input operations
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility for scroll and resize events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Memoization utility for expensive computations
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  getKey?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

// Lazy loading utility for components
export const createLazyComponent = <T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: React.ComponentType
) => {
  return React.lazy(importFunc);
};

// Performance monitoring utilities
export class PerformanceMonitor {
  private static measurements = new Map<string, number>();
  
  static startMeasurement(name: string): void {
    this.measurements.set(name, performance.now());
  }
  
  static endMeasurement(name: string): number {
    const start = this.measurements.get(name);
    if (!start) {
      console.warn(`No measurement started for: ${name}`);
      return 0;
    }
    
    const duration = performance.now() - start;
    this.measurements.delete(name);
    
    // Log slow operations (> 100ms)
    if (duration > 100) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }
  
  static measureAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
    this.startMeasurement(name);
    return asyncFn().finally(() => {
      this.endMeasurement(name);
    });
  }
}

// Cache management for frequently accessed data
export class DataCache {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  static set<T>(key: string, data: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }
  
  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }
  
  static clear(): void {
    this.cache.clear();
  }
  
  static clearExpired(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Optimized permission checker
export const createPermissionChecker = (permissions: CachedPermissions) => {
  return {
    canCreateArticles: () => permissions.canCreateArticles,
    canManageUsers: () => permissions.canManageUsers,
    canAccessAdmin: () => permissions.canAccessAdmin,
    canEditAnyArticle: () => permissions.canEditAnyArticle,
    canDeleteArticles: () => permissions.canDeleteArticles,
    canApproveWriters: () => permissions.canApproveWriters,
    canViewAnalytics: () => permissions.canViewAnalytics,
    getDashboardRoute: () => permissions.dashboardRoute,
  };
};

// Batch operations utility
export class BatchProcessor {
  private static batches = new Map<string, { items: any[]; timeout: NodeJS.Timeout }>();
  
  static addToBatch<T>(
    batchKey: string,
    item: T,
    processor: (items: T[]) => void,
    delay: number = 100
  ): void {
    const existing = this.batches.get(batchKey);
    
    if (existing) {
      existing.items.push(item);
      clearTimeout(existing.timeout);
    } else {
      this.batches.set(batchKey, {
        items: [item],
        timeout: setTimeout(() => {}, delay)
      });
    }
    
    const batch = this.batches.get(batchKey)!;
    batch.timeout = setTimeout(() => {
      processor(batch.items);
      this.batches.delete(batchKey);
    }, delay);
  }
}

// Image optimization utilities
export const optimizeImage = (url: string, width?: number, height?: number): string => {
  if (!url) return '';
  
  // For Firebase Storage URLs, we can add resize parameters
  if (url.includes('firebasestorage.googleapis.com')) {
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    
    const separator = url.includes('?') ? '&' : '?';
    return params.toString() ? `${url}${separator}${params.toString()}` : url;
  }
  
  return url;
};

// Preload critical resources
export const preloadCriticalResources = (): void => {
  // Preload critical fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.href = '/fonts/inter.woff2';
  fontLink.as = 'font';
  fontLink.type = 'font/woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);
  
  // Preload critical images
  const heroImage = new Image();
  heroImage.src = '/image.png';
};

// Initialize performance optimizations
export const initializePerformanceOptimizations = (): void => {
  // Clear expired cache entries every 5 minutes
  setInterval(() => {
    DataCache.clearExpired();
  }, 5 * 60 * 1000);
  
  // Preload critical resources
  preloadCriticalResources();
  
  // Monitor performance
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Log navigation timing
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        console.log('Page load performance:', {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          totalTime: navigation.loadEventEnd - navigation.fetchStart
        });
      }, 0);
    });
  }
};