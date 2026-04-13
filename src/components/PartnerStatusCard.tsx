import React, { useState, useEffect } from 'react';
import { API_ENDPOINT } from '../aws-config';
import { PartnerInfo, SelectableStudent } from '../types';

interface PartnerStatusCardProps {
  onPartnerChange?: () => void;
}

const PartnerStatusCard: React.FC<PartnerStatusCardProps> = ({ onPartnerChange }) => {
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [students, setStudents] = useState<SelectableStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNew] = useState(() => !localStorage.getItem('partner_feature_seen'));

  // Mark feature as seen after first view
  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => {
        localStorage.setItem('partner_feature_seen', 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const fetchPartnerInfo = async () => {
    try {
      const token = localStorage.getItem('idToken');
      if (!token) return;

      const response = await fetch(`${API_ENDPOINT}/partners`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPartnerInfo(data);
      }
    } catch (err) {
      console.error('Error fetching partner info:', err);
      setError('Failed to load partner info');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('idToken');
      if (!token) return;

      const response = await fetch(`${API_ENDPOINT}/partners/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  useEffect(() => {
    fetchPartnerInfo();
  }, []);

  useEffect(() => {
    if (showStudentPicker && students.length === 0) {
      fetchStudents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [showStudentPicker]);

  const sendRequest = async (toStudentId: string) => {
    setActionLoading(`send-${toStudentId}`);
    try {
      const token = localStorage.getItem('idToken');
      const response = await fetch(`${API_ENDPOINT}/partners/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ toStudentId })
      });

      if (response.ok) {
        await fetchPartnerInfo();
        setShowStudentPicker(false);
        setSearchQuery('');
        onPartnerChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send request');
      }
    } catch (err) {
      setError('Failed to send request');
    } finally {
      setActionLoading(null);
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'decline' | 'cancel') => {
    setActionLoading(`${action}-${requestId}`);
    try {
      const token = localStorage.getItem('idToken');
      const response = await fetch(`${API_ENDPOINT}/partners/request/${requestId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        await fetchPartnerInfo();
        onPartnerChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update request');
      }
    } catch (err) {
      setError('Failed to update request');
    } finally {
      setActionLoading(null);
    }
  };

  const removePartner = async () => {
    if (!window.confirm('Are you sure you want to remove your partner?')) return;
    
    setActionLoading('remove');
    try {
      const token = localStorage.getItem('idToken');
      const response = await fetch(`${API_ENDPOINT}/partners/current`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchPartnerInfo();
        onPartnerChange?.();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove partner');
      }
    } catch (err) {
      setError('Failed to remove partner');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="card p-6 mb-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden mb-6 relative">
      {/* NEW Badge */}
      {isNew && (
        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-primary-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse z-10">
          NEW
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-gt p-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Lab Partner
        </h2>
        <p className="text-gt-gold/80 text-sm mt-1">
          Team up with a classmate for lab work
        </p>
      </div>

      <div className="p-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-2 rounded-lg mb-4 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold hover:text-red-900 dark:hover:text-red-300">×</button>
          </div>
        )}

        {/* Current Partner Section */}
        {partnerInfo?.hasPartner ? (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Your Partner</p>
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                  {partnerInfo.currentPartner?.fullName?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-medium text-green-800 dark:text-green-300">{partnerInfo.currentPartner?.fullName}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Section {partnerInfo.currentPartner?.section}</p>
                </div>
              </div>
              <button
                onClick={removePartner}
                disabled={actionLoading === 'remove'}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === 'remove' ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Incoming Requests */}
            {partnerInfo?.incomingRequests && partnerInfo.incomingRequests.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Incoming Requests</p>
                <div className="space-y-2">
                  {partnerInfo.incomingRequests.map(req => (
                    <div key={req.requestId} className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                      <span className="font-medium text-yellow-800 dark:text-yellow-300">{req.fromStudentName}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToRequest(req.requestId, 'accept')}
                          disabled={actionLoading === `accept-${req.requestId}`}
                          className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === `accept-${req.requestId}` ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => respondToRequest(req.requestId, 'decline')}
                          disabled={actionLoading === `decline-${req.requestId}`}
                          className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
                        >
                          {actionLoading === `decline-${req.requestId}` ? '...' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing Requests */}
            {partnerInfo?.outgoingRequests && partnerInfo.outgoingRequests.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Pending Outgoing Requests</p>
                <div className="space-y-2">
                  {partnerInfo.outgoingRequests.map(req => (
                    <div key={req.requestId} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <span className="text-blue-800 dark:text-blue-300">
                        Waiting for <span className="font-medium">{req.toStudentName}</span> to respond
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-500 dark:text-blue-400 text-sm hidden sm:inline">Pending</span>
                        <button
                          onClick={() => respondToRequest(req.requestId, 'cancel')}
                          disabled={actionLoading === `cancel-${req.requestId}`}
                          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-sm font-medium transition-colors"
                        >
                          {actionLoading === `cancel-${req.requestId}` ? '...' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No partner, no requests - show find partner button */}
            {(!partnerInfo?.outgoingRequests || partnerInfo.outgoingRequests.length === 0) && (
              <div className="text-center py-6">
                <div className="text-gray-400 dark:text-gray-500 mb-4">
                  <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">You don't have a lab partner yet</p>
                <button
                  onClick={() => setShowStudentPicker(true)}
                  className="btn-primary"
                >
                  Find a Partner
                </button>
              </div>
            )}
          </>
        )}

        {/* Student Picker Modal */}
        {showStudentPicker && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden animate-scale-in">
              <div className="bg-gradient-gt p-4 flex justify-between items-center">
                <h3 className="font-semibold text-white">Select a Partner</h3>
                <button 
                  onClick={() => { setShowStudentPicker(false); setSearchQuery(''); }}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
              
              <div className="overflow-y-auto max-h-80">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    {students.length === 0 ? 'Loading students...' : 'No students found'}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredStudents.map(student => (
                      <li key={student.studentId} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-secondary-700 dark:text-white">{student.fullName}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Section {student.section}
                              {student.hasPartner && (
                                <span className="ml-2 text-orange-600 dark:text-orange-400">(has partner)</span>
                              )}
                            </p>
                          </div>
                          <button
                            onClick={() => sendRequest(student.studentId)}
                            disabled={student.hasPartner || actionLoading === `send-${student.studentId}`}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              student.hasPartner
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                          >
                            {actionLoading === `send-${student.studentId}` ? 'Sending...' : 'Request'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerStatusCard;
