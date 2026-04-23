import React, { useState, useEffect, useMemo } from 'react';
import { LabContent, LabPart, PartSubmission } from '../../../types';
import LabSection from './LabSection';
import VideoPartUploader from '../../submissions/VideoPartUploader';
import VideoPlayer from '../../VideoPlayer';
import { API_ENDPOINT } from '../../../aws-config';
import { useAuth } from '../../../contexts/AuthContext';
import { isStaffLevel } from '../../../utils/roles';

interface EnhancedLabContentProps {
  content: LabContent;
  labId: string;
  onLabPartsUpdate?: (parts: LabPart[]) => void;
  onPartSubmissionsUpdate?: (submissions: Record<string, PartSubmission>) => void;
  onLabProgressUpdate?: (progress: Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string }>) => void;
}

const EnhancedLabContent: React.FC<EnhancedLabContentProps> = ({
  content,
  labId,
  onLabPartsUpdate,
  onPartSubmissionsUpdate,
  onLabProgressUpdate
}) => {
  const { authState } = useAuth();
  const [labParts, setLabParts] = useState<LabPart[]>([]);
  const [partSubmissions, setPartSubmissions] = useState<Record<string, PartSubmission>>({});
  const [labProgress, setLabProgress] = useState<Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string; lastModifiedByName?: string }>>({}); 
  const [progressLoading, setProgressLoading] = useState(true);
  
  // Sort sections by order - memoized to prevent recreation on every render
  const sortedSections = useMemo(() => {
    return [...content.sections].sort((a, b) => a.order - b.order);
  }, [content.sections]);
  
  // Extract lab parts from the content
  // Look for sections with type 'instructions' that might contain parts
  const instructionSections = useMemo(() => {
    return sortedSections.filter(section => section.type === 'instructions');
  }, [sortedSections]);
  
  // Extract parts from section titles
  const extractedParts = useMemo(() => {
    return instructionSections.map((section, index) => {
      // Try to extract part number and title from section title
      // Example: "Part 1: Digital Output" -> { partId: "part1", title: "Digital Output" }
      // Also handles decimal part numbers like "Part 2.5: Assembly" and different separators like "Part 1 - Title"
      const partMatch = section.title.match(/Part\s+(\d+(?:\.\d+)?)[:\s-]+\s*(.*)/i);
      
      const partNumber = partMatch ? partMatch[1] : String(index + 1);
      const partTitle = partMatch 
        ? (partMatch[2] || `Part ${partMatch[1]}`)
        : section.title;
      
      // Derive extra credit from section flag or .5 suffix in part number
      const isExtraCredit = section.isExtraCredit || 
        (partMatch && partMatch[1].includes('.'));
      
      return {
        partId: `part${partNumber}`,
        title: partTitle,
        description: typeof section.content === 'string'
          ? section.content.substring(0, 100) + '...'
          : `Part ${partNumber} of the lab`,
        order: parseFloat(partNumber),
        requiresCheckoff: true,
        checkoffType: labId === 'lab0' ? 'none' : 'video' as 'video' | 'none' | 'in-lab',
        points: section.points || 0,
        isExtraCredit: isExtraCredit || false
      };
    });
  }, [instructionSections, labId]);
  
  // Update lab parts when they change
  useEffect(() => {
    setLabParts(extractedParts);
    
    // Notify parent component about lab parts
    if (onLabPartsUpdate) {
      onLabPartsUpdate(extractedParts);
    }
  }, [extractedParts, onLabPartsUpdate]);
  
  // Fetch existing submissions for this lab
  useEffect(() => {
    // Skip the effect if we don't have necessary data
    if (!labId || !authState.isAuthenticated) return;
    
    const fetchPartSubmissions = async () => {
      
      try {
        const token = localStorage.getItem('idToken');
        
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        // Fix the URL by ensuring no double slashes
        let apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions?labId=${labId}`;
        
        // IMPORTANT: If user is staff, we MUST explicitly filter by their ID to see their own submissions.
        // Otherwise the backend 'getAllSubmissions' returns ALL submissions for this lab from ALL students,
        // which causes random students' statuses to appear in the UI.
        if (isStaffLevel(authState.user)) {
          const userId = authState.user?.studentId || authState.user?.username;
          if (userId) {
            apiUrl += `&studentId=${encodeURIComponent(userId)}`;
          }
        }
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch part submissions');
        }
        
        const data = await response.json();
        
        // Convert array to record keyed by partId for easy lookup
        const submissionsRecord: Record<string, PartSubmission> = {};
        data.forEach((submission: PartSubmission) => {
          submissionsRecord[submission.partId] = submission;
        });
        
        setPartSubmissions(submissionsRecord);
        
        // Notify parent component about part submissions
        if (onPartSubmissionsUpdate) {
          onPartSubmissionsUpdate(submissionsRecord);
        }
      } catch (err) {
        console.error('Error fetching part submissions:', err);
        // Don't set error state or loading state here to avoid UI issues
      }
    };
    
    fetchPartSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, authState.isAuthenticated, onPartSubmissionsUpdate]);

  // Fetch lab progress for in-lab checkoffs (especially for lab0)
  useEffect(() => {
    // Skip the effect if we don't have necessary data
    if (!labId || !authState.isAuthenticated) return;
    
    const fetchLabProgress = async () => {
      try {
        const token = localStorage.getItem('idToken');
        
        if (!token) {
          return;
        }
        
        // Get the student's progress for this lab
        const studentId = authState.user?.studentId || authState.user?.username;
        if (!studentId) return;
        
        const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/progress/${studentId}`;
        
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error('Failed to fetch lab progress');
          return;
        }
        
        const data = await response.json();
        
        // Find the lab in the response and extract parts progress
        const labData = data.labs?.find((l: any) => l.labId === labId);
        
        if (labData && labData.parts) {
          const progressRecord: Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string; lastModifiedByName?: string }> = {};
          labData.parts.forEach((part: any) => {
            const partId = part.partId || part.progressId?.split('#')[1];
            if (partId) {
              progressRecord[partId] = {
                completed: part.completed || false,
                checkoffType: part.checkoffType || 'pending',
                updatedAt: part.updatedAt,
                lastModifiedByName: part.lastModifiedByName || null
              };
            }
          });
          setLabProgress(progressRecord);
          
          // Notify parent about lab progress
          if (onLabProgressUpdate) {
            onLabProgressUpdate(progressRecord);
          }
        }
        setProgressLoading(false);
      } catch (err) {
        console.error('Error fetching lab progress:', err);
        setProgressLoading(false);
      }
    };
    
    fetchLabProgress();
  }, [labId, authState.isAuthenticated, authState.user, onLabProgressUpdate]);


  
  const handleUploadComplete = (partId: string, submissionId: string, fileKey: string = '') => {
    // Create the updated submission object
    const updatedSubmission = {
      ...partSubmissions[partId],
      submissionId,
      fileKey,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as PartSubmission;
    
    // Update the local state with the new submission
    const updatedSubmissions = {
      ...partSubmissions,
      [partId]: updatedSubmission
    };
    
    setPartSubmissions(updatedSubmissions);
    
    // Notify parent component about part submissions
    if (onPartSubmissionsUpdate) {
      onPartSubmissionsUpdate(updatedSubmissions);
    }
  };

  const handleDeleteSubmission = async (partId: string) => {
    const submission = partSubmissions[partId];
    if (!submission) return;

    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/${submission.submissionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete submission');
      }

      // Update local state - remove submission
      const updatedSubmissions = { ...partSubmissions };
      delete updatedSubmissions[partId];
      setPartSubmissions(updatedSubmissions);

      // Update progress state - reset completion status
      if (labProgress[partId]) {
         const updatedProgress = { ...labProgress };
         updatedProgress[partId] = {
             ...updatedProgress[partId],
             completed: false,
             checkoffType: 'pending'
         };
         setLabProgress(updatedProgress);
         
         if (onLabProgressUpdate) onLabProgressUpdate(updatedProgress);
      }
      
      if (onPartSubmissionsUpdate) onPartSubmissionsUpdate(updatedSubmissions);

    } catch (err) {
      console.error('Error deleting submission:', err);
      alert('Failed to delete submission');
    }
  };
  
  // Render submission status for a part
  const renderSubmissionStatus = (partId: string) => {
    const submission = partSubmissions[partId];
    const progress = labProgress[partId];
    
    // Show loading state while fetching progress
    if (progressLoading) {
      return (
        <div className="bg-gray-100 dark:bg-gray-800/50 border-l-4 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 p-4 rounded-md mb-4 animate-pulse">
          <div className="flex items-center">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
            <p className="font-medium">Loading status...</p>
          </div>
        </div>
      );
    }
    
    // Check if the part is completed in the progress table (source of truth for checkoffs)
    // This handles both in-lab checkoffs (manual) and approved video submissions
    if (progress?.completed) {
      return (
        <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-400 text-green-700 dark:text-green-300 p-4 rounded-md mb-4">
          <p className="font-medium">
            {progress.checkoffType === 'in-lab' ? '✓ In-lab checkoff approved!' : '✓ Checkoff approved!'}
          </p>
          <p className="text-sm">
            {progress.updatedAt 
              ? `Approved on ${new Date(progress.updatedAt).toLocaleDateString()}`
              : 'This part has been checked off'}
            {progress.lastModifiedByName && (
              <span className="ml-1">by {progress.lastModifiedByName}</span>
            )}
          </p>
          {submission?.feedback && (
            <p className="mt-2 italic">"{submission.feedback}"</p>
          )}
        </div>
      );
    }
    
    // For lab0 (in-lab checkoffs only), if not completed, show the in-lab checkoff message
    if (labId === 'lab0') {
      return (
        <div className="bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-400 text-blue-700 dark:text-blue-300 p-4 rounded-md mb-4">
          <p className="font-medium">In-person checkoff required</p>
          <p className="text-sm">This part requires an in-person checkoff from a TA or instructor</p>
        </div>
      );
    }
    
    if (!submission) {
      return null;
    }
    
    switch (submission.status) {
      case 'pending':
        return (
          <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-400 text-yellow-700 dark:text-yellow-300 p-4 rounded-md mb-4">
            <p className="font-medium">Submission pending review</p>
            <p className="text-sm">Submitted on {new Date(submission.submittedAt).toLocaleDateString()}</p>
            
            {/* Show video player if URL is available */}
            {submission.videoUrl && (
              <div className="mt-4">
                <VideoPlayer videoUrl={submission.videoUrl} />
              </div>
            )}
            
            <div className="mt-3">
                <button 
                    onClick={() => handleDeleteSubmission(partId)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium flex items-center transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Submission
                </button>
            </div>
          </div>
        );
      case 'approved':
        return (
          <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-400 text-green-700 dark:text-green-300 p-4 rounded-md mb-4">
            <p className="font-medium">Submission approved!</p>
            <p className="text-sm">
              Approved on {new Date(submission.updatedAt).toLocaleDateString()}
              {submission.reviewedByName && (
                <span className="ml-1">by {submission.reviewedByName}</span>
              )}
            </p>
            {submission.feedback && (
              <p className="mt-2 italic">"{submission.feedback}"</p>
            )}
            
            {/* Show video player if URL is available */}
            {submission.videoUrl && (
              <div className="mt-4">
                <VideoPlayer videoUrl={submission.videoUrl} />
              </div>
            )}
          </div>
        );
      case 'rejected':
        return (
          <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-400 text-red-700 dark:text-red-300 p-4 rounded-md mb-4">
            <p className="font-medium">Submission rejected</p>
            <p className="text-sm">
              Rejected on {new Date(submission.updatedAt).toLocaleDateString()}
              {submission.reviewedByName && (
                <span className="ml-1">by {submission.reviewedByName}</span>
              )}
            </p>
            {submission.feedback && (
              <p className="mt-2 italic">"{submission.feedback}"</p>
            )}
            
            {/* Show video player if URL is available */}
            {submission.videoUrl && (
              <div className="mt-4">
                <VideoPlayer videoUrl={submission.videoUrl} />
              </div>
            )}
            
            <div className="mt-3">
                <button 
                    onClick={() => handleDeleteSubmission(partId)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium flex items-center transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Submission
                </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="structured-lab-content bg-white dark:bg-surface-dark-alt rounded-lg shadow-md dark:shadow-lg p-6 dark:border dark:border-gray-700">
      <div className="mb-8">
        {sortedSections.map((section) => (
          <div key={section.id}>
            <LabSection section={section} />
            
            {/* Check if this section corresponds to a lab part that needs a video submission */}
            {section.type === 'instructions' && labParts.some(part => 
              part.title === section.title.replace(/Part\s+\d+(?:\.\d+)?[\s:-]+\s*/i, '') ||
              section.title.match(new RegExp(`Part\\s+${part.order}(?:\\s|:|-)`, 'i'))
            ) && (
              <div className="mt-4 mb-8">
                {labParts
                  .filter(part => 
                    part.title === section.title.replace(/Part\s+\d+(?:\.\d+)?[\s:-]+\s*/i, '') ||
                    section.title.match(new RegExp(`Part\\s+${part.order}(?:\\s|:|-)`, 'i'))
                  )
                  .map(part => (
                    <div
                      key={part.partId}
                      id={`lab-part-${part.partId}`}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-4 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                        {labId === 'lab0' ? `Lab Checkoff for ${part.title}` : `Submit Video for ${part.title}`}
                      </h3>
                      
                      {/* Show submission status if available */}
                      {renderSubmissionStatus(part.partId)}
                      
                      {/* Only show uploader if not approved and not lab0 */}
                      {(!partSubmissions[part.partId] ||
                        partSubmissions[part.partId].status !== 'approved') &&
                        labId !== 'lab0' && (
                        <>
                          <VideoPartUploader
                            labId={labId}
                            partId={part.partId}
                            partTitle={part.title}
                            onUploadComplete={(submissionId, fileKey) =>
                              handleUploadComplete(part.partId, submissionId, fileKey)
                            }
                          />
                        </>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        ))}
      </div>
      
      {content.resources && content.resources.length > 0 && (
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-bold mb-4 text-primary-700 dark:text-primary-300">
            Additional Resources
          </h3>
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow-inner">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {content.resources.map((resource) => (
                <li key={resource.id} className="py-4">
                  <div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-lg flex items-center"
                    >
                      <span className="w-6 h-6 mr-3 inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300 rounded-full">
                        {resource.type === 'document' && 'D'}
                        {resource.type === 'image' && 'I'}
                        {resource.type === 'video' && 'V'}
                        {resource.type === 'link' && 'L'}
                      </span>
                      {resource.title}
                    </a>
                    {resource.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1 ml-9">{resource.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedLabContent;