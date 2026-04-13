import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lab, LabStatus, LabPart, PartSubmission } from '../types';
import { API_ENDPOINT } from '../aws-config';
import ReactMarkdown from 'react-markdown';
import EnhancedLabContent from '../components/labs/content/EnhancedLabContent';
import LabPartStatusSummary from '../components/labs/LabPartStatusSummary';

const LabDetailPage: React.FC = () => {
  const { labId } = useParams<{ labId: string }>();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [lab, setLab] = useState<(Lab & Partial<LabStatus>) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isStudent = authState.user?.role === 'student';
  const [labParts, setLabParts] = useState<LabPart[]>([]);
  const [partSubmissions, setPartSubmissions] = useState<Record<string, PartSubmission>>({});
  const [labProgress, setLabProgress] = useState<Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string }>>({});
  const [progressLoading, setProgressLoading] = useState(true);
  
  const handleLabPartsUpdate = useCallback((parts: LabPart[]) => {
    setLabParts(parts);
  }, []);
  
  const handlePartSubmissionsUpdate = useCallback((submissions: Record<string, PartSubmission>) => {
    setPartSubmissions(submissions);
  }, []);

  const handleLabProgressUpdate = useCallback((progress: Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string }>) => {
    setLabProgress(progress);
    setProgressLoading(false);
  }, []);

  const fetchLabDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}labs/${labId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json();
          console.error('Lab access denied:', errorData);
          sessionStorage.setItem('labAccessError',
            errorData.message || 'This lab is currently locked. Please wait for your instructor to unlock it.');
          navigate('/labs', { replace: true });
          return;
        }
        throw new Error('Failed to fetch lab details');
      }
      
      const data = await response.json();
      setLab(data);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching lab details:', err);
    } finally {
      setLoading(false);
    }
  }, [labId, navigate]);
  
  useEffect(() => {
    fetchLabDetails();
  }, [fetchLabDetails]);
  
  useEffect(() => {
    if (lab && isStudent && lab.locked) {
      sessionStorage.setItem('labAccessError',
        'This lab is currently locked. Please wait for your instructor to unlock it.');
      navigate('/labs', { replace: true });
    }
  }, [lab, isStudent, navigate]);

  useEffect(() => {
    if (!loading && !lab && !error) {
      setError('Lab not found');
    }
  }, [loading, lab, error]);

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
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="card animate-pulse">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-gray-200 dark:bg-gray-800 rounded"></div>
                ))}
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="card animate-pulse">
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
                ))}
              </div>
            </div>
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
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">Error Loading Lab</h3>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
        <Link 
          to="/labs" 
          className="btn-primary inline-flex items-center gap-2 mt-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Labs
        </Link>
      </div>
    );
  }

  // Not Found State
  if (!lab && !loading && !error) {
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
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-1">Lab Not Found</h3>
              <p className="text-amber-700 dark:text-amber-300">The requested lab could not be found.</p>
            </div>
          </div>
        </div>
        <Link 
          to="/labs" 
          className="btn-primary inline-flex items-center gap-2 mt-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Labs
        </Link>
      </div>
    );
  }

  // Main Lab Content
  if (lab) {
    const labNumber = lab.labId.replace('lab', '');
    
    return (
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/labs"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-secondary-600 dark:text-gray-400 dark:hover:text-gt-gold transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Labs</span>
          </Link>
        </div>
        
        {/* Lab Header */}
        <div className="card mb-8 overflow-hidden animate-slide-up">
          <div className="flex items-start gap-6">
            {/* Lab Number Badge */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-gt flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="font-display font-bold text-gt-gold text-2xl">{labNumber}</span>
            </div>
            
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-secondary-700 dark:text-white mb-2">
                {lab.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{lab.description}</p>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Status Badge */}
                {lab.status === 'locked' ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">This lab is locked</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Lab is unlocked</span>
                  </div>
                )}

                {/* Due Date Badge */}
                {lab.dueDate && (
                   <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Due: {new Date(lab.dueDate.split('T')[0] + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-slide-up animation-delay-100">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {lab.structuredContent && (
              <div className="sticky top-24">
                <LabPartStatusSummary
                  labId={lab.labId}
                  labTitle={lab.title}
                  labParts={labParts}
                  partSubmissions={partSubmissions}
                  labProgress={labProgress}
                  progressLoading={progressLoading}
                />
              </div>
            )}
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            {lab.structuredContent ? (
              <EnhancedLabContent
                content={lab.structuredContent}
                labId={lab.labId}
                onLabPartsUpdate={handleLabPartsUpdate}
                onPartSubmissionsUpdate={handlePartSubmissionsUpdate}
                onLabProgressUpdate={handleLabProgressUpdate}
              />
            ) : lab.content ? (

              <div className="card">
                <div className="prose dark:prose-invert max-w-none markdown-content">
                  <ReactMarkdown>{lab.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-center py-12">
                <svg className="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-amber-700 dark:text-amber-300 font-medium">No content available for this lab yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Fallback
  return (
    <div className="max-w-4xl mx-auto">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <p className="text-amber-700 dark:text-amber-300">{error || "Lab not found"}</p>
        </div>
      )}
      <Link to="/labs" className="btn-primary inline-flex items-center gap-2 mt-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Labs
      </Link>
    </div>
  );
};

export default LabDetailPage;