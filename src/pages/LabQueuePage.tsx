import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { QueueEntry, LabQueue, LabQueueResponse, Lab, Partner } from '../types';
import { API_ENDPOINT } from '../aws-config';
import PartnerCheckoffModal from '../components/PartnerCheckoffModal';

const LabQueuePage: React.FC = () => {
  const { authState, viewAsStudent } = useAuth();
  const [queue, setQueue] = useState<LabQueue | null>(null);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [checkoffApproved, setCheckoffApproved] = useState<{labId: string; partId: string} | null>(null);

  // Partner checkoff state
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [pendingPartnerCheckoff, setPendingPartnerCheckoff] = useState<{
    entryId: string;
    partnerInfo: Partner;
    studentName: string;
  } | null>(null);
  const [studentPartners, setStudentPartners] = useState<Record<string, Partner | null>>({});
  
  // Track previous entry to detect approval
  const previousEntryRef = useRef<QueueEntry | null>(null);
  
  // Form state for joining queue
  const [selectedQueueType, setSelectedQueueType] = useState<'checkoff' | 'help'>('checkoff');
  const [selectedLabId, setSelectedLabId] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');

  const isStaff = authState.user?.role === 'staff' && !viewAsStudent;

  // Fetch queue status
  const fetchQueue = useCallback(async () => {
    try {
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch queue');

      const data: LabQueueResponse = await response.json();
      setQueue(data.queue);
      
      // Detect if student was just approved (was in checkoff queue, now not in queue)
      const wasInCheckoffQueue = previousEntryRef.current?.queueType === 'checkoff';
      const nowNotInQueue = !data.myEntry;
      const prevEntry = previousEntryRef.current;
      
      if (wasInCheckoffQueue && nowNotInQueue && prevEntry?.labId && prevEntry?.partId) {
        // Verify the checkoff was actually recorded by checking progress
        try {
          const studentId = authState.user?.studentId;
          if (studentId) {
            const progressResponse = await fetch(
              `${API_ENDPOINT.replace(/\/$/, '')}/progress/${encodeURIComponent(studentId)}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            if (progressResponse.ok) {
              const progressData = await progressResponse.json();
              // Check if the specific part is now completed
              const lab = progressData.labs?.find((l: any) => l.labId === prevEntry.labId);
              const part = lab?.parts?.find((p: any) => p.partId === prevEntry.partId);
              
              if (part?.completed) {
                // Checkoff was actually approved!
                setCheckoffApproved({
                  labId: prevEntry.labId,
                  partId: prevEntry.partId
                });
              }
            }
          }
        } catch (verifyError) {
          console.error('Error verifying checkoff:', verifyError);
          // Don't show celebration if we can't verify
        }
      }
      
      previousEntryRef.current = data.myEntry || null;
      setMyEntry(data.myEntry || null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch labs for the dropdown
  const fetchLabs = useCallback(async () => {
    try {
      const token = localStorage.getItem('idToken');
      if (!token) return;

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/labs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Only show unlocked labs, sorted by order
        const unlockedLabs = data
          .filter((lab: Lab) => !lab.locked)
          .sort((a: Lab, b: Lab) => a.order - b.order);
        setLabs(unlockedLabs);
      }
    } catch (err) {
      console.error('Failed to fetch labs:', err);
    }
  }, []);

  // Get parts for the selected lab from structuredContent
  const getLabParts = (labId: string): { partId: string; title: string }[] => {
    const lab = labs.find(l => l.labId === labId);
    if (!lab?.structuredContent?.sections) return [];

    const instructionSections = lab.structuredContent.sections.filter(
      (s) => s.type === 'instructions'
    );

    return instructionSections
      .filter((section) => {
        // Only include sections that look like parts
        const hasPartInTitle = section.title?.match(/Part\s+(\d+(?:\.\d+)?)/i);
        const hasPartId = section.id?.startsWith('part');
        return hasPartInTitle || hasPartId;
      })
      .map((section) => {
        // Extract part number from title or id
        const partMatch = section.title?.match(/Part\s+(\d+(?:\.\d+)?)/i);
        const partNum = partMatch ? partMatch[1] : section.id.replace('part', '');
        const partId = partMatch ? `part${partMatch[1]}` : section.id;
        const isExtraCredit = section.isExtraCredit || (partMatch && partMatch[1].includes('.'));
        
        return {
          partId,
          title: isExtraCredit ? `Part ${partNum} (Extra Credit)` : `Part ${partNum}`
        };
      });
  };

  // Join queue
  const handleJoinQueue = async () => {
    try {
      setActionLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          queueType: selectedQueueType,
          labId: selectedLabId || null,
          partId: selectedPartId || null
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join queue');
      }

      setQueue(data.queue);
      setMyEntry(data.entry);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Leave queue
  const handleLeaveQueue = async () => {
    try {
      setActionLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to leave queue');
      }

      setQueue(data.queue);
      previousEntryRef.current = null; // Clear to prevent celebration trigger
      setMyEntry(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Remove entry (staff)
  const handleRemoveEntry = async (entryId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue/${entryId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove entry');
      }

      setQueue(data.queue);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch partner info
  const fetchStudentPartner = async (username: string): Promise<Partner | null> => {
    // Return cached partner if available
    if (studentPartners[username] !== undefined) {
      return studentPartners[username];
    }

    try {
      const token = localStorage.getItem('idToken');
      if (!token) return null;

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/students/${username}`, {
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
    
    // Cache null on error/not found
    setStudentPartners(prev => ({ ...prev, [username]: null }));
    return null;
  };

  const handlePartnerCheckoffConfirm = async (alsoCheckoffPartner: boolean) => {
    if (!pendingPartnerCheckoff) return;
    
    await executeMarkHelped(pendingPartnerCheckoff.entryId, alsoCheckoffPartner);
    setPartnerModalOpen(false);
    setPendingPartnerCheckoff(null);
  };

  const handlePartnerCheckoffCancel = () => {
    setPartnerModalOpen(false);
    setPendingPartnerCheckoff(null);
  };

  const executeMarkHelped = async (entryId: string, alsoCheckoffPartner: boolean = false) => {
    try {
      setActionLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue/${entryId}/helped`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ alsoCheckoffPartner })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark as helped');
      }

      setQueue(data.queue);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Mark as helped (staff)
  const handleMarkHelped = async (entry: QueueEntry) => {
    // Set loading immediately to show feedback waiting for partner check
    setActionLoading(true);

    // If checkoff queue, check for partner
    if (entry.queueType === 'checkoff' && entry.labId && entry.partId) {
      // Extract username from email
      const username = entry.studentEmail.split('@')[0];
      const partner = await fetchStudentPartner(username);

      if (partner && partner.hasAccount) {
        setActionLoading(false); // Stop loading to show modal
        setPendingPartnerCheckoff({
          entryId: entry.entryId,
          partnerInfo: partner,
          studentName: entry.studentName
        });
        setPartnerModalOpen(true);
        return;
      }
    }

    // Default flow - executeMarkHelped will set loading true again, which is fine
    await executeMarkHelped(entry.entryId);
  };

  // Clear entire queue (staff)
  const handleClearQueue = async () => {
    if (!window.confirm('Are you sure you want to clear the entire queue?')) return;
    
    try {
      setActionLoading(true);
      setError(null);
      
      const token = localStorage.getItem('idToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue/clear`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to clear queue');
      }

      await fetchQueue();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchQueue();
      fetchLabs();
      
      // Poll every 1 second for real-time updates
      const interval = setInterval(fetchQueue, 1000);
      return () => clearInterval(interval);
    }
  }, [authState.isAuthenticated, fetchQueue, fetchLabs]);

  // Format time since joined
  const formatTimeSince = (joinedAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(joinedAt).getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${minutes} mins`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // Loading State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-10 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-2"></div>
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-800 rounded mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-16 bg-gray-200 dark:bg-gray-800 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Student View - Already in queue
  if (!isStaff && myEntry) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Lab Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">You're in the queue</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="card text-center py-12">
          <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
            myEntry.queueType === 'checkoff' 
              ? 'bg-emerald-100 dark:bg-emerald-900/30' 
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            <span className="text-4xl font-display font-bold text-secondary-700 dark:text-white">
              #{myEntry.position}
            </span>
          </div>
          
          <h2 className="text-2xl font-display font-bold text-secondary-700 dark:text-white mb-2">
            {myEntry.studentName}
          </h2>
          
          <span className={`badge text-sm ${
            myEntry.queueType === 'checkoff' ? 'badge-success' : 'badge-warning'
          }`}>
            {myEntry.queueType === 'checkoff' ? 'Checkoff Queue' : 'Help Queue'}
          </span>
          
          <p className="text-gray-500 dark:text-gray-400 mt-4">
            Waiting for {formatTimeSince(myEntry.joinedAt)}
          </p>
          
          <button
            onClick={handleLeaveQueue}
            disabled={actionLoading}
            className="btn-danger mt-8 px-8"
          >
            {actionLoading ? 'Leaving...' : 'Leave Queue'}
          </button>
          
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            You can navigate to other pages — your spot in the queue is saved.
          </p>
        </div>
      </div>
    );
  }

  // Student View - Checkoff just approved celebration
  if (!isStaff && checkoffApproved) {
    const lab = labs.find(l => l.labId === checkoffApproved.labId);
    const labName = lab?.title || checkoffApproved.labId.replace('lab', 'Lab ');
    const partNum = checkoffApproved.partId.replace('part', '');
    
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card text-center py-12 relative overflow-hidden">
          {/* Celebration background effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-emerald-900/20 dark:via-gray-900 dark:to-green-900/20" />
          
          {/* Animated circles */}
          <div className="absolute top-4 left-4 w-20 h-20 bg-emerald-200/50 dark:bg-emerald-700/30 rounded-full animate-pulse" />
          <div className="absolute bottom-8 right-8 w-16 h-16 bg-green-200/50 dark:bg-green-700/30 rounded-full animate-pulse" style={{animationDelay: '0.5s'}} />
          <div className="absolute top-1/4 right-1/4 w-8 h-8 bg-emerald-300/30 dark:bg-emerald-600/30 rounded-full animate-pulse" style={{animationDelay: '1s'}} />
          
          <div className="relative z-10">
            {/* Success checkmark */}
            <div className="w-24 h-24 rounded-full mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center animate-bounce" style={{animationDuration: '1s'}}>
              <svg className="w-12 h-12 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-3xl font-display font-bold text-emerald-700 dark:text-emerald-400 mb-2">
              Checkoff Approved! 🎉
            </h2>
            
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
              {labName} - Part {partNum}
            </p>
            
            <p className="text-gray-500 dark:text-gray-500 mb-8">
              Your progress has been updated. Great work!
            </p>
            
            <button
              onClick={() => setCheckoffApproved(null)}
              className="btn-success px-8"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Student View - Not in queue
  if (!isStaff) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Lab Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">Need help or ready for a checkoff?</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}


        {/* Queue Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card flex items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{queue?.totalCheckoff || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Checkoff Queue</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 py-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{queue?.totalHelp || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Help Queue</p>
            </div>
          </div>
        </div>

        {/* Join Queue Form */}
        <div className="card">
          <h3 className="font-semibold text-secondary-700 dark:text-white mb-4">Join Queue</h3>
          
          {/* Queue Type Selection */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              type="button"
              onClick={() => setSelectedQueueType('checkoff')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedQueueType === 'checkoff'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <svg className={`w-8 h-8 mx-auto mb-2 ${
                selectedQueueType === 'checkoff' ? 'text-emerald-600' : 'text-gray-400'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`font-medium ${
                selectedQueueType === 'checkoff' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'
              }`}>Checkoff</p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedQueueType('help')}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedQueueType === 'help'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <svg className={`w-8 h-8 mx-auto mb-2 ${
                selectedQueueType === 'help' ? 'text-amber-600' : 'text-gray-400'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`font-medium ${
                selectedQueueType === 'help' ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'
              }`}>Help</p>
            </button>
          </div>

          {/* Name Display (read-only) */}
          <div className="mb-4">
            <label className="label">Your Name</label>
            <div className="input bg-gray-100 dark:bg-gray-800 cursor-not-allowed">
              {authState.user?.fullName || 'Unknown'}
            </div>
          </div>

          {/* Lab Selection (required for checkoff) */}
          {selectedQueueType === 'checkoff' && (
            <>
              <div className="mb-4">
                <label className="label">Lab <span className="text-red-500">*</span></label>
                <select
                  value={selectedLabId}
                  onChange={(e) => {
                    setSelectedLabId(e.target.value);
                    setSelectedPartId('');
                  }}
                  className="input"
                >
                  <option value="">Select a lab...</option>
                  {labs.map(lab => (
                    <option key={lab.labId} value={lab.labId}>
                      Lab {lab.labId.replace('lab', '')}: {lab.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Part Selection (required for checkoff) */}
              {selectedLabId && (
                <div className="mb-4">
                  <label className="label">Part <span className="text-red-500">*</span></label>
                  <select
                    value={selectedPartId}
                    onChange={(e) => setSelectedPartId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select a part...</option>
                    {getLabParts(selectedLabId).map(part => (
                      <option key={part.partId} value={part.partId}>{part.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <button
            onClick={handleJoinQueue}
            disabled={actionLoading || (selectedQueueType === 'checkoff' && (!selectedLabId || !selectedPartId))}
            className={`w-full py-3 ${
              selectedQueueType === 'checkoff' ? 'btn-success' : 'btn-warning'
            }`}
          >
            {actionLoading ? 'Joining...' : `Join ${selectedQueueType === 'checkoff' ? 'Checkoff' : 'Help'} Queue`}
          </button>
        </div>
      </div>
    );
  }

  // Staff View
  const renderQueueList = (entries: QueueEntry[], type: 'checkoff' | 'help') => {
    if (entries.length === 0) {
      return (
        <div className="p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No one in queue</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {entries.map((entry, index) => (
          <div key={entry.entryId} className={`p-4 ${index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 
                    ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' 
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {entry.position}
                </span>
                <div>
                  <p className="font-medium text-secondary-700 dark:text-white">{entry.studentName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimeSince(entry.joinedAt)} ago
                    {type === 'checkoff' && entry.labId && ` • Lab ${entry.labId.replace('lab', '')}`}
                    {type === 'checkoff' && entry.partId && ` Part ${entry.partId.replace('part', '')}`}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 ml-11">
              <button
                onClick={() => handleMarkHelped(entry)}
                disabled={actionLoading}
                className="btn-success text-xs py-1 px-3"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {type === 'checkoff' ? 'Accept' : 'Helped'}
              </button>
              <button
                onClick={() => handleRemoveEntry(entry.entryId)}
                disabled={actionLoading}
                className="btn-secondary text-xs py-1 px-3"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Lab Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage student help and checkoff requests
          </p>
        </div>
        <button
          onClick={handleClearQueue}
          disabled={actionLoading || (queue?.totalCheckoff === 0 && queue?.totalHelp === 0)}
          className="btn-danger"
        >
          Clear All
        </button>
      </div>

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

      {/* Queue Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checkoff Queue */}
        <div className="card overflow-hidden p-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-700 dark:text-white">Checkoff Queue</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quick verifications</p>
                </div>
              </div>
              <span className="badge badge-success">{queue?.totalCheckoff || 0}</span>
            </div>
          </div>
          {renderQueueList(queue?.checkoffQueue || [], 'checkoff')}
        </div>

        {/* Help Queue */}
        <div className="card overflow-hidden p-0">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-secondary-700 dark:text-white">Help Queue</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Need guidance</p>
                </div>
              </div>
              <span className="badge badge-warning">{queue?.totalHelp || 0}</span>
            </div>
          </div>
          {renderQueueList(queue?.helpQueue || [], 'help')}
        </div>
      </div>
      {/* Partner Checkoff Modal */}
      {partnerModalOpen && pendingPartnerCheckoff && (
        <PartnerCheckoffModal
          isOpen={partnerModalOpen}
          studentName={pendingPartnerCheckoff.studentName}
          partnerName={pendingPartnerCheckoff.partnerInfo.fullName || pendingPartnerCheckoff.partnerInfo.studentId}
          onConfirm={handlePartnerCheckoffConfirm}
          onCancel={handlePartnerCheckoffCancel}
        />
      )}
    </div>
  );
};

export default LabQueuePage;
