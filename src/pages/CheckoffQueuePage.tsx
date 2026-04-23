import React, { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PartSubmission, QueueFilters, Partner } from '../types';
import { API_ENDPOINT } from '../aws-config';
import PartnerCheckoffModal from '../components/PartnerCheckoffModal';
import { isStaffLevel } from '../utils/roles';

const CheckoffQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [queue, setQueue] = useState<PartSubmission[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<PartSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [filters, setFilters] = useState<QueueFilters>({
    status: 'pending',
    sortBy: 'submittedAt',
    sortDirection: 'asc'
  });
  const [stats, setStats] = useState({
    totalCount: 0,
    pendingCount: 0
  });

  // Partner checkoff state
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [pendingPartnerCheckoff, setPendingPartnerCheckoff] = useState<{
    submissionId: string;
    partnerInfo: Partner;
  } | null>(null);
  const [studentPartners, setStudentPartners] = useState<Record<string, Partner | null>>({});

  const formatDisplayName = (submission: PartSubmission): string => {
    return submission.fullName || submission.username;
  };

  const getNameStatusIndicator = (submission: PartSubmission): string => {
    return !submission.fullName ? ' (name not set)' : '';
  };

  const fetchSubmissionById = async (submissionId: string) => {
    const token = localStorage.getItem('idToken');
    if (!token) throw new Error('No authentication token found');
    const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/${submissionId}`;
    const response = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch submission');
    return response.json();
  };

  useEffect(() => {
    if (authState.isAuthenticated && !isStaffLevel(authState.user)) {
      navigate('/');
    }
  }, [authState, navigate]);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');
      
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.labId) queryParams.append('labId', filters.labId);
      if (filters.partId) queryParams.append('partId', filters.partId);
      if (filters.studentId) queryParams.append('studentId', filters.studentId);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortDirection) queryParams.append('sortDirection', filters.sortDirection);
      
      try {
        const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/queue?${queryParams.toString()}`;
        
        const response = await fetch(apiUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          if (response.status === 404) {
            return await fetchAllSubmissions(token);
          }
          throw new Error('Failed to fetch submission queue');
        }
        
        const data = await response.json();
        setQueue(data.items || []);
        setStats({
          totalCount: data.totalCount || 0,
          pendingCount: data.pendingCount || 0
        });
        
        if (data.items && data.items.length > 0) {
          try {
            const refreshed = await fetchSubmissionById(data.items[0].submissionId);
            setCurrentSubmission(refreshed);
          } catch {
            setCurrentSubmission(data.items[0]);
          }
        } else {
          setCurrentSubmission(null);
        }
      } catch (err) {
        return await fetchAllSubmissions(token);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllSubmissions = async (token: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
      if (filters.sortDirection) queryParams.append('sortDirection', filters.sortDirection);

      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions?${queryParams.toString()}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch submissions');

      const data = await response.json();
      let filteredSubmissions = data;
      
      if (filters.status && filters.status !== 'all') {
        filteredSubmissions = data.filter((s: PartSubmission) => s.status === filters.status);
      }

      const sortField = filters.sortBy || 'submittedAt';
      const sortDirection = filters.sortDirection || 'asc';

      filteredSubmissions.sort((a: PartSubmission, b: PartSubmission) => {
        const aValue = new Date(a[sortField as keyof PartSubmission] as string).getTime();
        const bValue = new Date(b[sortField as keyof PartSubmission] as string).getTime();
        return sortDirection === 'desc' ? bValue - aValue : aValue - bValue;
      });

      const pendingCount = data.filter((s: PartSubmission) => s.status === 'pending').length;

      setQueue(filteredSubmissions);
      setStats({ totalCount: data.length, pendingCount });

      if (filteredSubmissions.length > 0) {
        setCurrentSubmission(filteredSubmissions[0]);
      } else {
        setCurrentSubmission(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState.isAuthenticated, filters]);

  const fetchStudentPartner = async (username: string): Promise<Partner | null> => {
    // Return cached partner if available
    if (studentPartners[username] !== undefined) {
      return studentPartners[username];
    }

    try {
      const token = localStorage.getItem('idToken');
      if (!token) return null;

      const response = await fetch(`${API_ENDPOINT}/students/${username}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const partner = data.partner || null;
        
        // Update cache
        setStudentPartners(prev => ({
          ...prev,
          [username]: partner
        }));
        
        return partner;
      }
    } catch (err) {
      console.error('Error fetching partner:', err);
    }
    
    // Cache null on error/not found to avoid refetching
    setStudentPartners(prev => ({ ...prev, [username]: null }));
    return null;
  };

  const handlePartnerCheckoffConfirm = async (alsoCheckoffPartner: boolean) => {
    if (!pendingPartnerCheckoff) return;
    
    await executeApprove(pendingPartnerCheckoff.submissionId, alsoCheckoffPartner);
    setPartnerModalOpen(false);
    setPendingPartnerCheckoff(null);
  };

  const handlePartnerCheckoffCancel = () => {
    setPartnerModalOpen(false);
    setPendingPartnerCheckoff(null);
  };

  const executeApprove = async (submissionId: string, alsoCheckoffPartner: boolean = false) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/${submissionId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'approved',
          feedback: feedback.trim() || 'Great job!',
          alsoCheckoffPartner
        })
      });

      if (!response.ok) throw new Error('Failed to approve submission');

      const currentIndex = queue.findIndex(item => item.submissionId === submissionId);
      const updatedQueue = queue.filter(item => item.submissionId !== submissionId);
      setQueue(updatedQueue);

      if (updatedQueue.length > 0) {
        const nextSubmission = currentIndex < updatedQueue.length ? updatedQueue[currentIndex] : updatedQueue[0];
        try {
          const refreshed = await fetchSubmissionById(nextSubmission.submissionId);
          setCurrentSubmission(refreshed);
        } catch {
          setCurrentSubmission(nextSubmission);
        }
      } else {
        setCurrentSubmission(null);
      }

      setFeedback('');
      setStats(prev => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!currentSubmission || actionLoading) return;
    
    // Set loading immediately
    setActionLoading(true);

    // Check for partner
    const username = currentSubmission.username || currentSubmission.studentId;
    const partner = await fetchStudentPartner(username);

    if (partner && partner.hasAccount) {
      setActionLoading(false); // Stop loading to show modal
      // Show modal
      setPendingPartnerCheckoff({
        submissionId: currentSubmission.submissionId,
        partnerInfo: partner
      });
      setPartnerModalOpen(true);
    } else {
      // Proceed directly - executeApprove will set loading again which is fine
      await executeApprove(currentSubmission.submissionId);
    }
  };

  const handleReject = async () => {
    if (!currentSubmission) return;

    if (!feedback.trim()) {
      setError('Please provide feedback explaining why the submission was rejected');
      return;
    }

    try {
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/${currentSubmission.submissionId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'rejected', feedback })
      });

      if (!response.ok) throw new Error('Failed to reject submission');

      const currentIndex = queue.findIndex(item => item.submissionId === currentSubmission.submissionId);
      const updatedQueue = queue.filter(item => item.submissionId !== currentSubmission.submissionId);
      setQueue(updatedQueue);

      if (updatedQueue.length > 0) {
        const nextSubmission = currentIndex < updatedQueue.length ? updatedQueue[currentIndex] : updatedQueue[0];
        try {
          const refreshed = await fetchSubmissionById(nextSubmission.submissionId);
          setCurrentSubmission(refreshed);
        } catch {
          setCurrentSubmission(nextSubmission);
        }
      } else {
        setCurrentSubmission(null);
      }

      setFeedback('');
      setStats(prev => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDismiss = async () => {
    if (!currentSubmission || actionLoading) return;

    setActionLoading(true);
    try {
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions/${currentSubmission.submissionId}`;
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'dismissed', feedback: feedback || 'Dismissed — student was already checked off.' })
      });

      if (!response.ok) throw new Error('Failed to dismiss submission');

      const currentIndex = queue.findIndex(item => item.submissionId === currentSubmission.submissionId);
      const updatedQueue = queue.filter(item => item.submissionId !== currentSubmission.submissionId);
      setQueue(updatedQueue);

      if (updatedQueue.length > 0) {
        const nextSubmission = currentIndex < updatedQueue.length ? updatedQueue[currentIndex] : updatedQueue[0];
        try {
          const refreshed = await fetchSubmissionById(nextSubmission.submissionId);
          setCurrentSubmission(refreshed);
        } catch {
          setCurrentSubmission(nextSubmission);
        }
      } else {
        setCurrentSubmission(null);
      }

      setFeedback('');
      setStats(prev => ({ ...prev, pendingCount: Math.max(0, prev.pendingCount - 1) }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFilterChange = (key: keyof QueueFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const selectSubmission = (submission: PartSubmission) => {
    fetchSubmissionById(submission.submissionId)
      .then((refreshed) => setCurrentSubmission(refreshed))
      .catch(() => setCurrentSubmission(submission));
    setFeedback('');
  };

  // Loading State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card animate-pulse">
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 card animate-pulse">
            <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-xl mb-4"></div>
            <div className="h-6 w-1/2 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
            <div className="h-4 w-1/3 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Checkoff Queue</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and grade student video submissions
        </p>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.pendingCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending Review</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 py-4">
          <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.totalCount}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Submissions</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar - Queue */}
        <div className="space-y-4">
          {/* Filters */}
          <div className="card">
            <h3 className="font-semibold text-secondary-700 dark:text-white mb-3">Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="label text-xs">Status</label>
                <select
                  className="input text-sm py-2"
                  value={filters.status || 'pending'}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Sort By</label>
                <select
                  className="input text-sm py-2"
                  value={filters.sortBy || 'submittedAt'}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                >
                  <option value="submittedAt">Submitted</option>
                  <option value="updatedAt">Updated</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Order</label>
                <select
                  className="input text-sm py-2"
                  value={filters.sortDirection || 'asc'}
                  onChange={(e) => handleFilterChange('sortDirection', e.target.value)}
                >
                  <option value="asc">Oldest First</option>
                  <option value="desc">Newest First</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Queue List */}
          <div className="card overflow-hidden p-0">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-secondary-700 dark:text-white">Queue</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{queue.length} submissions</p>
            </div>
            
            {queue.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No submissions in queue</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                {queue.map((submission) => (
                  <button
                    key={submission.submissionId}
                    onClick={() => selectSubmission(submission)}
                    className={`w-full p-4 text-left border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
                      currentSubmission?.submissionId === submission.submissionId
                        ? 'bg-secondary-50 dark:bg-secondary-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-secondary-700 dark:text-white text-sm truncate pr-2">
                        {formatDisplayName(submission)}
                      </span>
                      <span className={`badge text-[10px] flex-shrink-0 ${
                        submission.status === 'pending' ? 'badge-warning' :
                        submission.status === 'approved' ? 'badge-success' : 'badge-error'
                      }`}>
                        {submission.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Lab {submission.labId.replace('lab', '')} • Part {submission.partId.replace('part', '')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Main Content - Submission Review */}
        <div className="lg:col-span-2">
          {currentSubmission ? (
            <div className="card">
              {/* Submission Header */}
              <div className="mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-display font-bold text-secondary-700 dark:text-white flex items-center gap-2">
                      {formatDisplayName(currentSubmission)}
                      <span className="text-xs text-gray-400 font-normal">{getNameStatusIndicator(currentSubmission)}</span>
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Lab {currentSubmission.labId.replace('lab', '')} • Part {currentSubmission.partId.replace('part', '')}
                    </p>
                  </div>
                  <span className={`badge ${
                    currentSubmission.status === 'pending' ? 'badge-warning' :
                    currentSubmission.status === 'approved' ? 'badge-success' :
                    currentSubmission.status === 'dismissed' ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'badge-error'
                  }`}>
                    {currentSubmission.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Submitted {new Date(currentSubmission.submittedAt).toLocaleString()}
                </p>
                {currentSubmission.status !== 'pending' && currentSubmission.reviewedByName && currentSubmission.reviewedAt && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {currentSubmission.status === 'approved' ? 'Approved' : currentSubmission.status === 'dismissed' ? 'Dismissed' : 'Rejected'} by {currentSubmission.reviewedByName} on {new Date(currentSubmission.reviewedAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Already Checked Off Warning */}
              {currentSubmission.alreadyCheckedOff && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                        This student was already checked off
                        {currentSubmission.checkoffType && ` (${currentSubmission.checkoffType})`}
                        {currentSubmission.checkedOffBy && ` by ${currentSubmission.checkedOffBy}`}.
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        You can dismiss this video submission to clean it up without affecting the existing checkoff.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Player */}
              <div className="mb-6">
                <VideoPlayer
                  videoUrl={currentSubmission.videoUrl}
                  className="rounded-xl overflow-hidden"
                />
              </div>
              
              {/* Student Notes */}
              {currentSubmission.notes && (
                <div className="mb-6 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <h4 className="text-sm font-semibold text-secondary-700 dark:text-white mb-2">Student Notes</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{currentSubmission.notes}</p>
                </div>
              )}

              {/* Existing Feedback (if already reviewed) */}
              {currentSubmission.status !== 'pending' && currentSubmission.feedback && (
                <div className={`mb-6 p-4 rounded-xl border-l-4 ${
                  currentSubmission.status === 'approved'
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-400'
                }`}>
                  <h4 className="text-sm font-semibold text-secondary-700 dark:text-white mb-2">
                    Previous Feedback
                    {currentSubmission.reviewedByName && (
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                        from {currentSubmission.reviewedByName}
                      </span>
                    )}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm italic">"{currentSubmission.feedback}"</p>
                </div>
              )}

              {/* Feedback */}
              <div className="mb-6">
                <label className="label">Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="input min-h-[100px] resize-none"
                  placeholder="Provide feedback for the student..."
                />
                <p className="text-xs text-gray-400 mt-1">{feedback.length} characters</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className={`btn-success flex-1 py-3 ${actionLoading ? 'opacity-75 cursor-wait' : ''}`}
                >
                  {actionLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Wait...
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </>
                  )}
                </button>
                <button
                  onClick={handleReject}
                  className="btn-danger flex-1 py-3"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={actionLoading}
                  className={`flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center transition-colors ${
                    currentSubmission.alreadyCheckedOff
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  } ${actionLoading ? 'opacity-75 cursor-wait' : ''}`}
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Dismiss
                </button>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-semibold text-secondary-700 dark:text-white mb-2">No Submission Selected</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {queue.length > 0 
                  ? 'Select a submission from the queue to review'
                  : 'There are no submissions in the queue'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Partner Checkoff Modal */}
      {partnerModalOpen && pendingPartnerCheckoff && currentSubmission && (
        <PartnerCheckoffModal
          isOpen={partnerModalOpen}
          studentName={formatDisplayName(currentSubmission)}
          partnerName={pendingPartnerCheckoff.partnerInfo.fullName || pendingPartnerCheckoff.partnerInfo.studentId}
          onConfirm={handlePartnerCheckoffConfirm}
          onCancel={handlePartnerCheckoffCancel}
        />
      )}
    </div>
  );
};

export default CheckoffQueuePage;