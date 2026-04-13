import React, { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import { useParams, Link } from 'react-router-dom';
import { API_ENDPOINT } from '../aws-config';
import { StudentDetail, PartSubmission } from '../types';

const StudentDetailPage: React.FC = () => {
  const { studentName } = useParams<{ studentName: string }>();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'checkoffs'>('overview');
  const [editingGrade, setEditingGrade] = useState<{ labId: string, grade: number | null }>({ labId: '', grade: null });
  const [partSubmissions, setPartSubmissions] = useState<Record<string, PartSubmission>>({});

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadData = async () => {
      if (!studentName) return;

      try {
        setLoading(true);
        setError(null);

        const idToken = localStorage.getItem('idToken');
        if (!idToken) {
          throw new Error('No authentication token found');
        }

        // Fetch student details
        const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/progress/${encodeURIComponent(studentName)}`;
        const response = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${idToken}` },
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error('Failed to fetch student details');
        }

        const data = await response.json();

        // Only update state if component is still mounted
        if (!isMounted) return;

        // Transform backend response
        const transformedStudent: StudentDetail = {
          name: data.student?.name || data.name || studentName,
          fullName: data.student?.fullName || data.fullName,
          section: data.student?.section || data.section || '',
          hasAccount: data.student?.hasAccount || data.hasAccount || false,
          progress: (data.labs || data.progress || []).map((lab: any) => {
            const sections = lab.structuredContent?.sections || [];
            const instructionSections = sections.filter((s: any) => s.type === 'instructions');

            // Build a map of part completion status from lab.parts (if any exist)
            const progressMap: Record<string, any> = {};
            (lab.parts || []).forEach((part: any) => {
              const partId = part.partId || part.progressId?.split('#')[1] || '';
              if (partId) {
                progressMap[partId] = part;
              }
            });

            // Extract parts from structuredContent.sections (type === 'instructions')
            // and merge with any completion data from progressMap
            const transformedParts = instructionSections
              .filter((section: any) => {
                // Only include sections that look like parts (have "Part X" in title or id starts with "part")
                const hasPartInTitle = section.title?.match(/Part\s+(\d+(?:\.\d+)?)/i);
                const hasPartId = section.id?.startsWith('part');
                return hasPartInTitle || hasPartId;
              })
              .map((section: any) => {
                // Extract part number from title or id
                const partMatch = section.title?.match(/Part\s+(\d+(?:\.\d+)?)/i);
                const partId = partMatch ? `part${partMatch[1]}` : section.id;
                const isExtraCredit = section.isExtraCredit || (partMatch && partMatch[1].includes('.'));
                
                // Get any existing progress data for this part
                const progress = progressMap[partId] || {};
                
                return {
                  partId,
                  title: section.title || (isExtraCredit ? `${partId} (Extra Credit)` : partId),
                  description: '',
                  completed: progress.completed || false,
                  completedAt: progress.completedAt,
                  checkoffType: progress.checkoffType || 'pending',
                  lastModifiedByName: progress.lastModifiedByName || null,
                  videoUrl: progress.videoUrl,
                  submissionId: progress.submissionId,
                  submissionStatus: progress.submissionStatus,
                  points: section.points || 0,
                  isExtraCredit: isExtraCredit || false
                };
              });

            return {
              labId: lab.labId,
              title: lab.title,
              status: lab.status || (lab.locked ? 'locked' : 'unlocked'),
              completed: lab.completed || false,
              grade: lab.grade ?? null,
              totalGrade: lab.totalGrade ?? null,
              earlyBirdPoints: lab.earlyBirdPoints ?? 0,
              parts: transformedParts
            };
          })
        };

        setStudent(transformedStudent);

        // Also fetch part submissions (non-blocking)
        fetchPartSubmissions(studentName);

      } catch (err) {
        if (!isMounted) return;
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        console.error('Error fetching student details:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [studentName]);
  
  const fetchPartSubmissions = async (name: string) => {
    try {
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      // Fix the URL by ensuring no double slashes
      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions?studentId=${encodeURIComponent(name)}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch part submissions');
      }
      
      const data = await response.json();
      
      // Convert array to record keyed by partId for easy lookup
      const submissionsRecord: Record<string, PartSubmission> = {};
      data.forEach((submission: PartSubmission) => {
        const key = `${submission.labId}#${submission.partId}`;
        submissionsRecord[key] = submission;
      });
      
      setPartSubmissions(submissionsRecord);
    } catch (err) {
      console.error('Error fetching part submissions:', err);
      // Don't set error state here to avoid blocking the main UI
    }
  };

  const handleGradeChange = (e: React.ChangeEvent<HTMLInputElement>, labId: string) => {
    const value = e.target.value;
    const grade = value === '' ? null : Number(value);
    setEditingGrade({ labId, grade });
  };

  const saveGrade = async (labId: string) => {
    if (!student) return;
    
    try {
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      // Fix the URL by ensuring no double slashes
      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/progress/${encodeURIComponent(student.name)}`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          labId,
          grade: editingGrade.grade
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update grade');
      }
      
      // Update local state
      setStudent(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          progress: prev.progress.map(lab => 
            lab.labId === labId 
              ? { ...lab, grade: editingGrade.grade } 
              : lab
          )
        };
      });
      
      // Reset editing state
      setEditingGrade({ labId: '', grade: null });
      
    } catch (err) {
      console.error('Error updating grade:', err);
      alert('Failed to update grade: ' + (err as Error).message);
    }
  };

  const toggleCheckoff = async (labId: string, partId: string, currentStatus: boolean) => {
    if (!student) return;
    
    try {
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const checkoffType = 'in-lab'; // Default to in-lab checkoff
      const newStatus = !currentStatus;
      
      // Fix the URL by ensuring no double slashes
      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/progress/${encodeURIComponent(student.name)}`;
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          labId,
          partId,
          completed: newStatus,
          checkoffType: newStatus ? checkoffType : 'pending'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update checkoff status');
      }
      
      // Update local state
      setStudent(prev => {
        if (!prev) return null;
        
        return {
          ...prev,
          progress: prev.progress.map(lab => 
            lab.labId === labId 
              ? { 
                  ...lab, 
                  parts: lab.parts.map(part => 
                    part.partId === partId 
                      ? { 
                          ...part, 
                          completed: newStatus,
                          checkoffType: newStatus ? checkoffType : 'pending',
                          completedAt: newStatus ? new Date().toISOString() : undefined
                        } 
                      : part
                  )
                } 
              : lab
          )
        };
      });
      
    } catch (err) {
      console.error('Error updating checkoff status:', err);
      alert('Failed to update checkoff status: ' + (err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-6">
          <p className="font-bold">Error</p>
          <p>{error || 'Student not found'}</p>
        </div>
        <Link to="/people" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          &larr; Back to People
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-6">
        <Link to="/people" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
          &larr; Back to People
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">
              {student.fullName || student.name}
              {student.fullName && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-3">({student.name})</span>}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 rounded-full text-sm font-medium">
                Section {student.section}
              </span>
              {student.hasAccount ? (
                <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full text-sm font-medium">
                  Account Active
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                  No Account
                </span>
              )}
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <div className="flex space-x-2">
              <button 
                className={`px-4 py-2 rounded-md ${activeTab === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button 
                className={`px-4 py-2 rounded-md ${activeTab === 'checkoffs' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                onClick={() => setActiveTab('checkoffs')}
              >
                Check Offs
              </button>
            </div>
          </div>
        </div>
        
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Lab Progress</h2>
            <div className="space-y-4">
              {student.progress.map((lab) => {
                // For locked labs, show only locked badge
                if (lab.status === 'locked') {
                  return (
                    <div key={lab.labId} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{lab.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{lab.labId}</p>
                        </div>
                        <span className="px-3 py-1 text-sm font-semibold rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Locked
                        </span>
                      </div>
                    </div>
                  );
                }

                // Calculate points for unlocked labs
                const regularParts = lab.parts.filter(p => !p.isExtraCredit);
                const extraCreditParts = lab.parts.filter(p => p.isExtraCredit);
                
                const totalBasePoints = regularParts.reduce((sum, p) => sum + (p.points || 0), 0);
                const earnedBasePoints = regularParts
                  .filter(p => p.completed)
                  .reduce((sum, p) => sum + (p.points || 0), 0);
                
                const earnedExtraPoints = extraCreditParts
                  .filter(p => p.completed)
                  .reduce((sum, p) => sum + (p.points || 0), 0);
                
                const progressPercentage = totalBasePoints > 0 
                  ? Math.round((earnedBasePoints / totalBasePoints) * 100) 
                  : 0;

                return (
                  <div key={lab.labId} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                    {/* Lab Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{lab.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{lab.labId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Grade editing */}
                        {editingGrade.labId === lab.labId ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              min="0"
                              max="150"
                              className="w-16 px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              value={editingGrade.grade === null ? '' : editingGrade.grade}
                              onChange={(e) => handleGradeChange(e, lab.labId)}
                            />
                            <button
                              className="text-green-600 hover:text-green-700 dark:text-green-400"
                              onClick={() => saveGrade(lab.labId)}
                            >
                              Save
                            </button>
                            <button
                              className="text-gray-500 hover:text-gray-600 dark:text-gray-400"
                              onClick={() => setEditingGrade({ labId: '', grade: null })}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            onClick={() => setEditingGrade({ labId: lab.labId, grade: lab.grade })}
                          >
                            Grade: {lab.totalGrade !== null && lab.totalGrade !== undefined
                              ? `${lab.totalGrade}%`
                              : (totalBasePoints > 0 
                                ? `${Math.round(((earnedBasePoints + earnedExtraPoints) / totalBasePoints) * 100) + (lab.earlyBirdPoints || 0)}%`
                                : (lab.grade !== null ? lab.grade : 'N/A'))}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Early Bird Points Display (if any) */}
                    {lab.earlyBirdPoints !== undefined && lab.earlyBirdPoints > 0 && (
                      <div className="mb-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        <span>+{lab.earlyBirdPoints} Early Bird Bonus</span>
                      </div>
                    )}

                    {/* Progress Bar */}
                    {totalBasePoints > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Progress</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {earnedBasePoints}/{totalBasePoints} pts
                            {earnedExtraPoints > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                (+{earnedExtraPoints} EC)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Parts List */}
                    <div className="space-y-2">
                      {lab.parts.map((part) => (
                        <div 
                          key={part.partId}
                          className={`flex items-center justify-between p-2 rounded-md ${
                            part.completed 
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                              : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {part.completed ? (
                              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-500" />
                            )}
                            <span className={`text-sm ${part.completed ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                              Part {part.partId.replace('part', '')}: {part.title || 'Untitled'}
                            </span>
                            {part.isExtraCredit && (
                              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                                EC
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {part.points !== undefined && part.points > 0 && (
                              <span className={`text-sm font-medium ${
                                part.isExtraCredit 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}>
                                {part.isExtraCredit ? '+' : ''}{part.points} pts
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {lab.parts.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No parts defined for this lab</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {activeTab === 'checkoffs' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Lab Check Offs</h2>
            
            {student.progress.map((lab) => (
              <div key={lab.labId} className="mb-8">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium dark:text-white">{lab.title}</h3>
                  <div className="flex items-center">
                    <span className="mr-2 text-sm dark:text-gray-300">Grade:</span>
                    {editingGrade.labId === lab.labId ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-16 px-2 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          value={editingGrade.grade === null ? '' : editingGrade.grade}
                          onChange={(e) => handleGradeChange(e, lab.labId)}
                        />
                        <button
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 text-sm"
                          onClick={() => saveGrade(lab.labId)}
                        >
                          Save
                        </button>
                        <button
                          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 text-sm"
                          onClick={() => setEditingGrade({ labId: '', grade: null })}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="font-medium dark:text-white">
                          {(() => {
                            const regularParts = lab.parts.filter(p => !p.isExtraCredit);
                            const extraCreditParts = lab.parts.filter(p => p.isExtraCredit);
                            const totalBasePoints = regularParts.reduce((sum, p) => sum + (p.points || 0), 0);
                            const earnedBasePoints = regularParts.filter(p => p.completed).reduce((sum, p) => sum + (p.points || 0), 0);
                            const earnedExtraPoints = extraCreditParts.filter(p => p.completed).reduce((sum, p) => sum + (p.points || 0), 0);
                             if (lab.totalGrade !== null && lab.totalGrade !== undefined) {
                               return `${lab.totalGrade}%`;
                             }
                             if (totalBasePoints > 0) {
                               return `${Math.round(((earnedBasePoints + earnedExtraPoints) / totalBasePoints) * 100) + (lab.earlyBirdPoints || 0)}%`;
                             }
                             return lab.grade !== null ? lab.grade : 'N/A';
                          })()}
                        </span>
                        <button
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                          onClick={() => setEditingGrade({ labId: lab.labId, grade: lab.grade })}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                  {lab.parts.length > 0 ? (
                    <div className="space-y-4">
                      {lab.parts.map((part) => (
                        <div key={part.partId} className="flex flex-col md:flex-row justify-between items-start md:items-center p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm">
                          <div>
                            <div className="font-medium dark:text-white">{part.partId}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {part.completed ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400">Completed</span>
                                  {part.completedAt && (
                                    <span className="ml-2">
                                      on {new Date(part.completedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  <span className="ml-2">
                                    via {part.checkoffType === 'video' ? 'Video Submission' : 
                                        part.checkoffType === 'inlab' || part.checkoffType === 'in-lab' ? 'In-Lab Queue' : 
                                        part.checkoffType === 'queue' ? 'Lab Queue' : 'In-Lab Check Off'}
                                  </span>
                                  {part.lastModifiedByName && (
                                    <span className="ml-1 text-gray-600 dark:text-gray-500">
                                      by {part.lastModifiedByName}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-600 dark:text-gray-400">Not completed</span>
                              )}
                            </div>
                            
                            {/* Show video submission status if available */}
                            {(() => {
                              const submissionKey = `${lab.labId}#${part.partId}`;
                              const submission = partSubmissions[submissionKey];
                              
                              if (submission) {
                                return (
                                  <div className="mt-2">
                                    <div className="flex items-center">
                                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                        submission.status === 'pending' ? 'bg-yellow-500' :
                                        submission.status === 'approved' ? 'bg-green-500' :
                                        'bg-red-500'
                                      }`}></span>
                                      <span className="text-sm dark:text-gray-300">
                                        Video submission {submission.status}
                                        {submission.submittedAt && (
                                          <span className="ml-1 text-gray-500 dark:text-gray-400">
                                            ({new Date(submission.submittedAt).toLocaleDateString()})
                                          </span>
                                        )}
                                        {submission.reviewedByName && submission.reviewedAt && (
                                          <span className="ml-1 text-gray-500 dark:text-gray-400">
                                            • {submission.status === 'approved' ? 'Approved' : 'Rejected'} by {submission.reviewedByName}
                                          </span>
                                        )}
                                      </span>
                                    </div>

                                    {submission.videoUrl && (
                                      <div className="mt-3">
                                        <h4 className="text-sm font-medium mb-1 dark:text-white">Video Submission</h4>
                                        <VideoPlayer videoUrl={submission.videoUrl} />
                                      </div>
                                    )}
                                    
                                    {submission.feedback && (
                                      <div className="mt-1 text-sm italic text-gray-600 dark:text-gray-400">
                                        "{submission.feedback}"
                                      </div>
                                    )}
                                  </div>
                                );
                              } else if (part.videoUrl) {
                                return (
                                  <div className="mt-3">
                                    <h4 className="text-sm font-medium mb-1 dark:text-white">Video Submission</h4>
                                    <VideoPlayer videoUrl={part.videoUrl} />
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}
                          </div>
                          
                          <div className="mt-2 md:mt-0">
                            <button
                              className={`px-3 py-1 rounded-md ${
                                part.completed 
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50' 
                                  : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                              }`}
                              onClick={() => toggleCheckoff(lab.labId, part.partId, part.completed)}
                            >
                              {part.completed ? 'Remove Check Off' : 'Mark as Completed'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      No parts defined for this lab.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDetailPage;