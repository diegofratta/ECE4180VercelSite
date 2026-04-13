import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_ENDPOINT } from '../aws-config';
import { Lab, LabGradeEntry, Partner } from '../types';
import { useAuth } from '../contexts/AuthContext';
import PartnerCheckoffModal from '../components/PartnerCheckoffModal';

// Helper to extract initials from full name
const getInitials = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

// Helper to extract last word for sorting
const getLastWord = (name: string | null | undefined): string => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
};

const GradesPage: React.FC = () => {
  const { authState } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [grades, setGrades] = useState<LabGradeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);

  // Partner checkoff modal state
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [pendingCheckoff, setPendingCheckoff] = useState<{
    studentName: string;
    partId: string;
    currentStatus: boolean;
    partnerInfo: Partner | null;
  } | null>(null);
  const [studentPartners, setStudentPartners] = useState<Record<string, Partner | null>>({});

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    if (selectedLabId) {
      fetchGrades(selectedLabId);
    } else {
      setGrades([]);
    }
  }, [selectedLabId]);

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const idToken = localStorage.getItem('idToken');
      if (!idToken) throw new Error('No authentication token found');
      
      const response = await fetch(`${API_ENDPOINT}/labs`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch labs');
      
      const data = await response.json();
      const sorted = data.sort((a: Lab, b: Lab) => a.order - b.order);
      setLabs(sorted);
      
      if (sorted.length > 0) {
        // Find the next upcoming lab (first lab with due date in the future, or fallback to first lab)
        const now = new Date();
        const upcomingLab = sorted.find((lab: Lab) => {
          if (!lab.dueDate) return false;
          return new Date(lab.dueDate.split('T')[0] + 'T00:00:00') > now;
        });
        setSelectedLabId(upcomingLab?.labId || sorted[0].labId);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectedLab = labs.find(l => l.labId === selectedLabId);

  const fetchGrades = async (labId: string) => {
    try {
      setGradesLoading(true);
      const idToken = localStorage.getItem('idToken');
      if (!idToken) throw new Error('No authentication token found');
      
      console.log('Fetching grades for lab:', labId);
      const response = await fetch(`${API_ENDPOINT}/students?mode=grades&labId=${labId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Fetch grades error response:', text);
        throw new Error(`Failed to fetch grades: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setGrades(data);
    } catch (err) {
      console.error('Error fetching grades:', err);
      setError((err as Error).message);
    } finally {
      setGradesLoading(false);
    }
  };

  const handleUpdateDueDate = async () => {
    if (!selectedLabId || !editingDueDate) return;
    
    try {
      setSavingDueDate(true);
      const idToken = localStorage.getItem('idToken');
      const response = await fetch(`${API_ENDPOINT}/labs/${selectedLabId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dueDate: editingDueDate
        })
      });

      if (!response.ok) throw new Error('Failed to update due date');
      
      // Update local state
      const updatedLabs = labs.map(l => 
        l.labId === selectedLabId ? { ...l, dueDate: editingDueDate } : l
      );
      setLabs(updatedLabs);
      setShowDueDateModal(false);
      
    } catch (err) {
      console.error('Error updating due date:', err);
      // Ideally show error toast
      alert('Failed to update due date');
    } finally {
      setSavingDueDate(false);
    }
  };


  // Fetch partner info for a student (cached in state)
  const fetchStudentPartner = async (studentName: string): Promise<Partner | null> => {
    // Check cache first
    if (studentName in studentPartners) {
      return studentPartners[studentName];
    }

    try {
      const idToken = localStorage.getItem('idToken');
      const response = await fetch(`${API_ENDPOINT}/students/${encodeURIComponent(studentName)}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const partner = data.partner || (data.partnerId ? {
          studentId: data.partnerId,
          fullName: data.partnerFullName || data.partnerId,
        } : null);
        
        setStudentPartners(prev => ({ ...prev, [studentName]: partner }));
        return partner;
      }
    } catch (err) {
      console.error('Error fetching student partner:', err);
    }
    
    setStudentPartners(prev => ({ ...prev, [studentName]: null }));
    return null;
  };

  const handleUpdateCheckoff = async (studentName: string, partId: string, currentStatus: boolean, alsoCheckoffPartner = false) => {
    const key = `${studentName}-${partId}`;
    if (updating[key]) return;
    
    setUpdating(prev => ({ ...prev, [key]: true }));
    
    // If we're checking off (not unchecking), check for partner first
    if (!currentStatus && !pendingCheckoff) {
      const partnerInfo = await fetchStudentPartner(studentName);
      if (partnerInfo) {
        setUpdating(prev => ({ ...prev, [key]: false })); // Stop spinner to show modal
        setPendingCheckoff({ studentName, partId, currentStatus, partnerInfo });
        setPartnerModalOpen(true);
        return;
      }
    }
    
    try {
      const idToken = localStorage.getItem('idToken');
      if (!idToken) throw new Error('No authentication token found');
      
      const newStatus = !currentStatus;
      
      await fetch(`${API_ENDPOINT}/progress/${encodeURIComponent(studentName)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          labId: selectedLabId,
          partId,
          completed: newStatus,
          checkoffType: newStatus ? 'in-lab' : 'pending',
          alsoCheckoffPartner
        })
      });
      
      // Update local state optimistically
      const currentUserEmail = authState.user?.username || null;
      const currentUserFullName = authState.user?.fullName || null;
      
      setGrades(prev => prev.map(entry => {
        if (entry.studentName !== studentName) return entry;
        
        const updatedParts = entry.parts.map(p => {
          if (p.partId !== partId) return p;
          return { 
            ...p, 
            completed: newStatus, 
            completedAt: newStatus ? new Date().toISOString() : undefined,
            lastModifiedBy: currentUserEmail,
            lastModifiedByName: currentUserFullName,
          };
        });
        
        const part = entry.parts.find(p => p.partId === partId);
        const points = part?.points || 0;
        const isExtra = part?.isExtraCredit || false;
        
        let newBaseEarned = entry.basePointsEarned;
        let newExtraEarned = entry.extraCreditEarned;
        
        if (isExtra) {
          newExtraEarned = newStatus ? newExtraEarned + points : newExtraEarned - points;
        } else {
          newBaseEarned = newStatus ? newBaseEarned + points : newBaseEarned - points;
        }
        
        const total = entry.basePointsTotal > 0 
          ? Math.round(((newBaseEarned + newExtraEarned) / entry.basePointsTotal) * 100) + entry.earlyBirdPoints
          : 0;
          
        return {
          ...entry,
          parts: updatedParts,
          basePointsEarned: newBaseEarned,
          extraCreditEarned: newExtraEarned,
          totalGrade: total
        };
      }));

      // If we also checked off partner, update their UI too
      if (alsoCheckoffPartner && pendingCheckoff?.partnerInfo) {
        const partnerId = pendingCheckoff.partnerInfo.studentId;
        setGrades(prev => prev.map(entry => {
          if (entry.studentName !== partnerId) return entry;
          
          const updatedParts = entry.parts.map(p => {
            if (p.partId !== partId) return p;
            return { 
              ...p, 
              completed: newStatus, 
              completedAt: newStatus ? new Date().toISOString() : undefined,
              lastModifiedBy: currentUserEmail,
              lastModifiedByName: currentUserFullName,
            };
          });
          
          const part = entry.parts.find(p => p.partId === partId);
          const points = part?.points || 0;
          const isExtra = part?.isExtraCredit || false;
          
          let newBaseEarned = entry.basePointsEarned;
          let newExtraEarned = entry.extraCreditEarned;
          
          if (isExtra) {
            newExtraEarned = newStatus ? newExtraEarned + points : newExtraEarned - points;
          } else {
            newBaseEarned = newStatus ? newBaseEarned + points : newBaseEarned - points;
          }
          
          const total = entry.basePointsTotal > 0 
            ? Math.round(((newBaseEarned + newExtraEarned) / entry.basePointsTotal) * 100) + entry.earlyBirdPoints
            : 0;
            
          return {
            ...entry,
            parts: updatedParts,
            basePointsEarned: newBaseEarned,
            extraCreditEarned: newExtraEarned,
            totalGrade: total
          };
        }));
      }
      
    } catch (err) {
      console.error('Error updating checkoff:', err);
    } finally {
      setUpdating(prev => ({ ...prev, [key]: false }));
      setPendingCheckoff(null);
    }
  };

  const handlePartnerCheckoffConfirm = (alsoCheckoffPartner: boolean) => {
    setPartnerModalOpen(false);
    if (pendingCheckoff) {
      handleUpdateCheckoff(
        pendingCheckoff.studentName,
        pendingCheckoff.partId,
        pendingCheckoff.currentStatus,
        alsoCheckoffPartner
      );
    }
  };

  const handlePartnerCheckoffCancel = () => {
    setPartnerModalOpen(false);
    setPendingCheckoff(null);
  };

  const generateCSV = () => {
    if (!selectedLab || grades.length === 0) return;

    // CSV Header: Student Name, then each part, then Total
    const headers = ['Student Name'];
    
    // Add part columns
    columns.forEach(part => {
      headers.push(`${part.partId.replace('part', 'Part ')} (${part.points}pts${part.isExtraCredit ? ' EC' : ''})`);
    });
    
    // Add total and early bird columns
    headers.push('Early Bird', 'Total Grade');

    // Build CSV rows
    const rows = [headers];
    
    sortedGrades.forEach(student => {
      const row = [student.studentFullName || student.studentName];
      
      // Add grade for each part
      columns.forEach(col => {
        const part = student.parts?.find(p => p.partId === col.partId);
        row.push(part?.completed ? col.points.toString() : '0');
      });
      
      // Add early bird and total
      row.push(student.earlyBirdPoints.toString());
      row.push(student.totalGrade.toString());
      
      rows.push(row);
    });

    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    return csvContent;
  };

  const handleExportCSV = () => {
    const csvContent = generateCSV();
    if (!csvContent) return;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${selectedLab?.title.replace(/\s+/g, '_')}_Grades_${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateEarlyBird = async (studentName: string, value: string) => {
    const points = parseInt(value);
    if (isNaN(points) || points < 0 || points > 5) return;
    
    try {
      const idToken = localStorage.getItem('idToken');
      if (!idToken) throw new Error('No authentication token found');
      
      // Optimistic update
      setGrades(prev => prev.map(entry => {
        if (entry.studentName !== studentName) return entry;
        const total = entry.basePointsTotal > 0 
          ? Math.round(((entry.basePointsEarned + entry.extraCreditEarned) / entry.basePointsTotal) * 100) + points
          : 0;
        return { ...entry, earlyBirdPoints: points, totalGrade: total };
      }));

      await fetch(`${API_ENDPOINT}/progress/${encodeURIComponent(studentName)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          labId: selectedLabId,
          earlyBirdPoints: points
        })
      });
      
    } catch (err) {
      console.error('Error updating early bird:', err);
      // Revert on error would require keeping previous state, skipping for brevity
    }
  };

  const filteredGrades = grades.filter(student => {
    if (student.section === 'Staff') return false;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      student.studentName.toLowerCase().includes(searchLower) || 
      (student.studentFullName && student.studentFullName.toLowerCase().includes(searchLower));
    const matchesSection = sectionFilter === 'all' || student.section === sectionFilter;
    return matchesSearch && matchesSection;
  });

  const sortedGrades = [...filteredGrades].sort((a, b) => {
    const nameA = a.studentFullName || a.studentName || '';
    const nameB = b.studentFullName || b.studentName || '';
    
    const lastA = getLastWord(nameA);
    const lastB = getLastWord(nameB);
    
    // Sort by last name, then first name if last names match
    const lastCompare = lastA.localeCompare(lastB);
    if (lastCompare !== 0) return lastCompare;
    
    return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
  });

  // Determine columns from the first student that has parts (or just use the first if available)
  // We assume all students have same parts structure for a lab
  const columns = grades.length > 0 && grades[0].parts.length > 0 
    ? grades[0].parts 
    : [];

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  if (loading && labs.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading labs...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 animate-fade-in">

      {/* Partner Checkoff Modal */}
      <PartnerCheckoffModal
        isOpen={partnerModalOpen}
        studentName={grades.find(g => g.studentName === pendingCheckoff?.studentName)?.studentFullName || pendingCheckoff?.studentName || ''}
        partnerName={pendingCheckoff?.partnerInfo?.fullName || pendingCheckoff?.partnerInfo?.studentId || ''}
        onConfirm={handlePartnerCheckoffConfirm}
        onCancel={handlePartnerCheckoffCancel}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="font-display text-4xl font-bold text-secondary-700 dark:text-white mb-2">Grades</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage student progress and checkoffs
          </p>
        </div>
        
        {/* Lab Selector and Actions */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
           {selectedLab && (
            <button
              onClick={() => {
                setEditingDueDate(selectedLab.dueDate || '');
                setShowDueDateModal(true);
              }}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              {selectedLab.dueDate
                ? `Due: ${new Date(selectedLab.dueDate.split('T')[0] + 'T00:00:00').toLocaleDateString()}`
                : 'Set Due Date'}
            </button>
          )}

          {selectedLab && grades.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>
          )}
          
          <select
            value={selectedLabId}
            onChange={(e) => setSelectedLabId(e.target.value)}
            disabled={gradesLoading}
            className={`input min-w-[200px] ${gradesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {labs.map(lab => (
              <option key={lab.labId} value={lab.labId}>
                {lab.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Due Date Modal */}
      {showDueDateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4 animate-scale-in">
            <h3 className="text-xl font-display font-bold text-secondary-900 dark:text-white mb-4">
              Set Due Date for {selectedLab?.title}
            </h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={editingDueDate.split('T')[0]} // Handle ISO string
                onChange={(e) => setEditingDueDate(e.target.value)}
                className="input w-full"
              />
              <p className="mt-2 text-xs text-gray-500">
                Early bird points will be automatically calculated relative to this date based on completion of all required parts.
              </p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDueDateModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateDueDate}
                disabled={savingDueDate}
                className="btn-primary"
              >
                {savingDueDate ? 'Saving...' : 'Save Due Date'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          
          <div className="flex-1 relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Students</label>
            <input
              type="text"
              placeholder="Search by name..."
              className="input w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="w-full md:w-40">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
            <select
              className="input w-full"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="all">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>
        </div>
      </div>

      {gradesLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading grades...</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    Student
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Early Bird
                  </th>
                  {columns.map(Part => (
                    <th key={Part.partId} className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">
                      {Part.partId.replace('part', 'Part ')}
                      <div className="text-[10px] lowercase font-normal">
                        {Part.points}pts {Part.isExtraCredit && '(EC)'}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedGrades.map((student, idx) => (
                  <tr key={student.studentName} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-white dark:bg-gray-800 z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-gt flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-gt-gold">
                            {(student.studentFullName || student.studentName).split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-secondary-700 dark:text-white">
                            {student.studentFullName || student.studentName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {student.section !== 'unassigned' ? `Sec ${student.section}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.totalGrade >= 100 ? 'bg-green-100 text-green-800' :
                        student.totalGrade >= 90 ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {student.totalGrade}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="number"
                        min="0"
                        max="5"
                        className="w-12 px-1 py-0.5 text-center text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        value={student.earlyBirdPoints}
                        onChange={(e) => handleUpdateEarlyBird(student.studentName, e.target.value)}
                      />
                    </td>
                    {columns.map(col => {
                      const part = student.parts?.find(p => p.partId === col.partId);
                      const isCompleted = part?.completed;
                      const isUpdating = updating[`${student.studentName}-${col.partId}`];
                      const modifierInitials = getInitials(part?.lastModifiedByName);
                      const modifierName = part?.lastModifiedByName;
                      
                      return (
                        <td key={col.partId} className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => part && handleUpdateCheckoff(student.studentName, col.partId, isCompleted || false)}
                              disabled={!part || isUpdating}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                                isCompleted
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500 dark:hover:bg-gray-600'
                              } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                            >
                              {isUpdating ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            {modifierInitials && (
                              <span 
                                className="text-[10px] text-gray-400 dark:text-gray-500 cursor-help"
                                title={modifierName || ''}
                              >
                                {modifierInitials}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/people/${encodeURIComponent(student.studentName)}`}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sortedGrades.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No students found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GradesPage;
