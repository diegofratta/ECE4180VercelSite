import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LabCard from '../components/labs/LabCard';
import { Lab, LabStatus } from '../types';
import { API_ENDPOINT } from '../aws-config';
import ConfirmationPopup from '../components/ConfirmationPopup';

const LabsPage: React.FC = () => {
  const { authState, viewAsStudent } = useAuth();
  const [labs, setLabs] = useState<(Lab & Partial<LabStatus>)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'lock' | 'unlock'>('unlock');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isStaff = authState.user?.role === 'staff';
  
  const processedLabs = useMemo(() => {
    return labs.map((lab: Lab & Partial<LabStatus>) => {
      const isLocked = lab.locked !== undefined ? lab.locked : (lab.labId !== 'lab0');
      return {
        ...lab,
        locked: isLocked,
        status: isLocked ? 'locked' : 'unlocked',
        completed: lab.completed || false
      };
    });
  }, [labs]);

  // Stats
  const stats = useMemo(() => {
    const total = processedLabs.length;
    const unlocked = processedLabs.filter(l => l.status === 'unlocked').length;
    const completed = processedLabs.filter(l => l.completed).length;
    return { total, unlocked, completed };
  }, [processedLabs]);

  useEffect(() => {
    fetchLabs();
    
    const labAccessError = sessionStorage.getItem('labAccessError');
    if (labAccessError) {
      setError(labAccessError);
      sessionStorage.removeItem('labAccessError');
    }
  }, [isStaff, viewAsStudent]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}labs`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch labs');
      }
      
      const data = await response.json();
      
      const labsWithStatus = data.map((lab: Lab & Partial<LabStatus>) => {
        if (lab.locked === undefined) {
          lab.locked = lab.labId === 'lab0' ? false : true;
        }
        return {
          ...lab,
          status: lab.locked ? 'locked' : 'unlocked'
        };
      });
      
      setLabs(labsWithStatus);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching labs:', err);
    } finally {
      setLoading(false);
    }
  };

  const showUnlockConfirmation = (labId: string) => {
    setSelectedLabId(labId);
    setConfirmationAction('unlock');
    setShowConfirmation(true);
  };
  
  const showLockConfirmation = (labId: string) => {
    setSelectedLabId(labId);
    setConfirmationAction('lock');
    setShowConfirmation(true);
  };
  
  const handleConfirmAction = async () => {
    if (!selectedLabId) return;
    
    if (confirmationAction === 'unlock') {
      await handleUnlockLabForAll(selectedLabId);
    } else {
      await handleLockLabForAll(selectedLabId);
    }
    
    setShowConfirmation(false);
  };
  
  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setSelectedLabId(null);
  };

  const handleUnlockLabForAll = async (labId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const url = `${baseUrl}labs/${labId}/unlock`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlock lab');
      }
      
      setLabs(prevLabs =>
        prevLabs.map(lab =>
          lab.labId === labId
            ? { ...lab, locked: false, status: 'unlocked' }
            : lab
        )
      );
      
      setSuccessMessage('Lab unlocked successfully!');
      setShowSuccess(true);
      
      await fetchLabs();
    } catch (err) {
      setError((err as Error).message);
      console.error('Error unlocking lab:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLockLabForAll = async (labId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const url = `${baseUrl}labs/${labId}/lock`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to lock lab');
      }
      
      setLabs(prevLabs =>
        prevLabs.map(lab =>
          lab.labId === labId
            ? { ...lab, locked: true, status: 'locked' }
            : lab
        )
      );
      
      setSuccessMessage('Lab locked successfully!');
      setShowSuccess(true);
      
      await fetchLabs();
    } catch (err) {
      setError((err as Error).message);
      console.error('Error locking lab:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && labs.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 animate-pulse">
          <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded-xl w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-96"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      <div className="mb-8 animate-fade-in">
        <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Labs</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Complete each lab assignment by submitting video demonstrations of your work.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8 animate-slide-up">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary-100 dark:bg-secondary-900/50 flex items-center justify-center">
            <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.total}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Labs</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gt-gold/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-gt-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.unlocked}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Unlocked</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-secondary-700 dark:text-white">{stats.completed}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3 animate-shake">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">Access Restricted</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
          </div>
        </div>
      )}
      
      {/* Lab Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-slide-up animation-delay-100">
        {processedLabs.map((lab, index) => (
          <div 
            key={lab.labId} 
            className="relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <LabCard
              lab={lab}
              status={lab as unknown as LabStatus}
              isStaff={isStaff}
              viewAsStudent={viewAsStudent}
            />
            
            {/* Staff Lock/Unlock Button */}
            {isStaff && !viewAsStudent && (
              <div className="absolute -top-2 -right-2 z-10">
                {lab.status === 'locked' ? (
                  <button
                    onClick={() => showUnlockConfirmation(lab.labId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                    Unlock
                  </button>
                ) : (
                  <button
                    onClick={() => showLockConfirmation(lab.labId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Lock
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Empty State */}
      {labs.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">No labs available yet.</p>
        </div>
      )}
      
      {/* Confirmation Popup */}
      <ConfirmationPopup
        isOpen={showConfirmation}
        title={confirmationAction === 'unlock' ? 'Unlock Lab for All Students' : 'Lock Lab for All Students'}
        message={
          confirmationAction === 'unlock'
            ? 'This will unlock the lab for ALL students. Are you sure?'
            : 'This will lock the lab for ALL students. Are you sure?'
        }
        confirmText={confirmationAction === 'unlock' ? 'Unlock Lab' : 'Lock Lab'}
        confirmButtonColor={confirmationAction === 'unlock' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelConfirmation}
      />
      
      {/* Success Popup */}
      <ConfirmationPopup
        isOpen={showSuccess}
        title="Success"
        message={successMessage}
        confirmText="OK"
        confirmButtonColor="bg-emerald-500 hover:bg-emerald-600"
        onConfirm={() => setShowSuccess(false)}
        onCancel={() => setShowSuccess(false)}
        isSuccess={true}
      />
    </div>
  );
};

export default LabsPage;
