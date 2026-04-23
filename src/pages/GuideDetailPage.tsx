import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Guide, GuideSection } from '../types';
import { API_ENDPOINT } from '../aws-config';
import ReactMarkdown from 'react-markdown';
import LabSection from '../components/labs/content/LabSection';
import { isStaffLevel } from '../utils/roles';

const GuideDetailPage: React.FC = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const { authState } = useAuth();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isStaff = isStaffLevel(authState.user);

  const fetchGuideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}guides/${guideId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch guide details');
      }
      
      const data = await response.json();
      setGuide(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching guide details:', err);
    } finally {
      setLoading(false);
    }
  }, [guideId]);
  
  useEffect(() => {
    fetchGuideDetails();
  }, [fetchGuideDetails]);

  // Render a guide section (reusing lab content block components)
  const renderSection = (section: GuideSection, index: number) => {
    // Convert GuideSection to LabSection format for reuse
    const labSectionFormat = {
      ...section,
      type: section.type as 'introduction' | 'objectives' | 'requirements' | 'instructions' | 'submission' | 'custom' | 'overview',
    };
    
    return (
      <LabSection key={section.id || index} section={labSectionFormat} />
    );
  };

  // Loading State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
        </div>
        <div className="card mb-8 animate-pulse">
          <div className="h-8 w-2/3 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
          <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
        <div className="card animate-pulse">
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">Error Loading Guide</h3>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
        <Link 
          to="/guides" 
          className="btn-primary inline-flex items-center gap-2 mt-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Guides
        </Link>
      </div>
    );
  }

  // Not Found State
  if (!guide && !loading && !error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-1">Guide Not Found</h3>
              <p className="text-amber-700 dark:text-amber-300">The requested guide could not be found.</p>
            </div>
          </div>
        </div>
        <Link 
          to="/guides" 
          className="btn-primary inline-flex items-center gap-2 mt-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Guides
        </Link>
      </div>
    );
  }

  // Main Guide Content
  if (guide) {
    return (
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Guides</span>
          </Link>
        </div>
        
        {/* Guide Header */}
        <div className="card mb-8 overflow-hidden animate-slide-up">
          <div>
            <h1 className="font-display text-3xl font-bold text-secondary-700 dark:text-white mb-2">
              {guide.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{guide.description}</p>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Staff Edit Button */}
              {isStaff && (
                <Link
                  to={`/guides/${guide.guideId}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-sm font-medium">Edit Guide</span>
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="animate-slide-up animation-delay-100">
          {guide.structuredContent ? (
            <div className="space-y-6">
              {guide.structuredContent.sections
                .sort((a, b) => a.order - b.order)
                .map((section, index) => renderSection(section, index))}
            </div>
          ) : guide.content ? (
            <div className="card">
              <div className="prose dark:prose-invert max-w-none markdown-content">
                <ReactMarkdown>{guide.content}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-center py-12">
              <svg className="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-amber-700 dark:text-amber-300 font-medium">No content available for this guide yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Fallback
  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/guides" className="btn-primary inline-flex items-center gap-2 mt-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Guides
      </Link>
    </div>
  );
};

export default GuideDetailPage;
