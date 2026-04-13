import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Guide } from '../types';
import { API_ENDPOINT } from '../aws-config';
import GuideCard from '../components/guides/GuideCard';

type SortOption = 'tag' | 'title' | 'newest' | 'oldest';

const GuidesPage: React.FC = () => {
  const { authState } = useAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('tag');
  const [filterTag, setFilterTag] = useState<string>('all');

  const isStaff = authState.user?.role === 'staff';

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}guides`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch guides');
      }
      
      const data = await response.json();
      setGuides(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching guides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    const tags = guides
      .map((g) => g.tag?.trim())
      .filter((t): t is string => !!t);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [guides]);

  // Filter and sort guides
  const sortedGuides = useMemo(() => {
    let filtered = filterTag === 'all'
      ? [...guides]
      : guides.filter((g) => g.tag?.trim() === filterTag);

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'tag': {
          const tagA = a.tag?.trim() || '';
          const tagB = b.tag?.trim() || '';
          const cmp = tagA.localeCompare(tagB, undefined, { numeric: true });
          return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
        }
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [guides, sortBy, filterTag]);

  if (loading && guides.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3 mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded mt-4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Guides</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Specialized tutorials and setup guides for embedded systems development.
          </p>
        </div>
        
        {/* Staff: New Guide Button */}
        {isStaff && (
          <Link
            to="/guides/new"
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Guide
          </Link>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 gap-4 mb-8 animate-slide-up">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{guides.length}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Available Guides</p>
          </div>
        </div>
      </div>

      {/* Filter & Sort Controls */}
      {guides.length > 0 && (
        <div className="mb-8 animate-slide-up animation-delay-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Tag Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-1">Filter:</span>
              <button
                onClick={() => setFilterTag('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  filterTag === 'all'
                    ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    filterTag === tag
                      ? 'bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="tag">Tag</option>
                <option value="title">A–Z</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          {/* Filtered count */}
          {filterTag !== 'all' && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Showing {sortedGuides.length} of {guides.length} guides
            </p>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Error Loading Guides</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}
      
      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide-up animation-delay-100">
        {sortedGuides.map((guide, index) => (
          <div 
            key={guide.guideId} 
            className="relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <GuideCard
              guide={guide}
              isStaff={isStaff}
            />
          </div>
        ))}
      </div>
      
      {/* Empty State */}
      {guides.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No guides available yet.</p>
          {isStaff && (
            <Link
              to="/guides/new"
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Guide
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default GuidesPage;
