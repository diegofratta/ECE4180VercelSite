import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINT } from '../aws-config';
import PartnerStatusCard from '../components/PartnerStatusCard';

// Define a custom interface for the progress data structure
interface ProgressData {
  student: {
    name: string;
    section: string;
    hasAccount: boolean;
  };
  labs: {
    labId: string;
    title: string;
    status: 'locked' | 'unlocked';
    completed: boolean;
    totalGrade: number;
    basePointsEarned: number;
    basePointsTotal: number;
    extraCreditEarned: number;
    earlyBirdPoints: number;
    parts: {
      partId: string;
      title?: string;
      description?: string;
      points?: number;
      isExtraCredit?: boolean;
      completed: boolean;
      completedAt?: string;
      checkoffType?: string;
      submissionStatus?: string;
      lastModifiedByName?: string;
    }[];
  }[];
}

const MyGradesPage: React.FC = () => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<ProgressData | null>(null);

  useEffect(() => {
    // Redirect if not authenticated
    if (!authState.isAuthenticated) {
      navigate('/signin');
      return;
    }

    // Fetch labs and progress data
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('idToken');
        if (!token) {
          throw new Error('No authentication token found');
        }

        // Fetch student progress
        const studentId = authState.user?.username || '';
        const studentIdFromToken = authState.user?.studentId || '';
        
        const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT.slice(0, -1) : API_ENDPOINT;
        
        let progressResponse;
        if (studentIdFromToken) {
          progressResponse = await fetch(`${baseUrl}/progress/${encodeURIComponent(studentIdFromToken)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
        
        if (!progressResponse || !progressResponse.ok) {
          progressResponse = await fetch(`${baseUrl}/progress/${encodeURIComponent(studentId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }

        if (!progressResponse.ok) {
          throw new Error('Failed to fetch progress data');
        }

        const data = await progressResponse.json();
        // Transform API response: API returns { progress: [...] } but interface expects { labs: [...] }
        const transformedData: ProgressData = {
          student: {
            name: data.name || '',
            section: data.section || '',
            hasAccount: data.hasAccount || false,
          },
          labs: data.progress || [],
        };
        setProgressData(transformedData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authState.isAuthenticated, authState.user, navigate]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">My Grades</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your lab progress and partner up with classmates
        </p>
      </div>
      
      {/* Partner Status Card */}
      <PartnerStatusCard />
      
      {progressData && progressData.labs && progressData.labs.length > 0 ? (
        <div className="space-y-6">
          {progressData.labs.map((lab) => (
            <div key={lab.labId} className="card overflow-hidden">
              {/* Lab Header */}
              <div className="bg-gradient-gt p-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">{lab.title}</h2>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                    lab.status === 'locked' 
                      ? 'bg-gray-500/30 text-gray-200' 
                      : 'bg-green-500/30 text-green-200'
                  }`}>
                    {lab.status === 'locked' ? 'Locked' : 'Unlocked'}
                  </span>
                </div>
              </div>
              
              {/* Lab Content */}
              <div className="p-5">
                {/* Progress Summary */}
                <div className="flex flex-wrap gap-4 mb-5 pb-5 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Progress:</span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                      lab.completed 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {lab.completed ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                  
                  {lab.basePointsTotal > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Grade:</span>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        lab.totalGrade >= 100 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        lab.totalGrade >= 90 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {lab.totalGrade}%
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Lab Parts */}
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Lab Parts
                </h3>
                
                {lab.parts && lab.parts.length > 0 ? (
                  <div className="space-y-3">
                    {lab.parts.map((part, index) => (
                      <div 
                        key={part.partId || index} 
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          part.completed 
                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10' 
                            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkmark Icon */}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            part.completed 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                          }`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          
                          <div>
                            <span className="font-medium text-secondary-700 dark:text-white">
                              {part.title || (part.partId ? part.partId.replace('part', 'Part ') : `Part ${index + 1}`)}
                            </span>
                            {part.completedAt && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Completed {new Date(part.completedAt).toLocaleDateString()}
                                {part.lastModifiedByName && (
                                  <span> • Approved by {part.lastModifiedByName}</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          part.completed 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {part.completed ? 'Completed' : 'Not Started'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 italic">No parts available for this lab.</p>
                )}
                
                {/* Go to Lab Button */}
                <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/labs/${lab.labId}`)}
                    className="btn-primary"
                    disabled={lab.status === 'locked'}
                  >
                    {lab.status === 'locked' ? 'Lab Locked' : 'Go to Lab'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center">
          <div className="text-gray-400 dark:text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No Progress Yet</h3>
          <p className="text-gray-500 dark:text-gray-400">
            You haven't started any labs yet. Head to the Labs page to begin!
          </p>
          <button
            onClick={() => navigate('/labs')}
            className="btn-primary mt-4"
          >
            View Labs
          </button>
        </div>
      )}
    </div>
  );
};

export default MyGradesPage;