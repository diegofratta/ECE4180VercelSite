import React from 'react';
import { Link } from 'react-router-dom';
import { Lab, LabStatus } from '../../types';

interface LabCardProps {
  lab: Lab;
  status?: LabStatus;
  isStaff?: boolean;
  viewAsStudent?: boolean;
}

const LabCard: React.FC<LabCardProps> = ({ lab, status, isStaff = false, viewAsStudent = false }) => {
  const isLockedByProperty = lab.locked === true;
  const isLockedByStatus = !status || status.status === 'locked';
  const isLockedStatus = isLockedByProperty || isLockedByStatus;
  const isLocked = isStaff && !viewAsStudent ? false : isLockedStatus;
  const isCompleted = status?.completed;
  const hasSubmission = status?.submissionStatus;
  const showLockIndicator = isLockedStatus;

  const getStatusBadge = () => {
    if (isLocked) {
      return (
        <span className="badge-locked flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Locked
        </span>
      );
    }

    if (isCompleted) {
      return (
        <span className="badge-success flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Completed
        </span>
      );
    }

    if (hasSubmission) {
      const submissionStatus = status?.submissionStatus;
      
      if (submissionStatus === 'approved') {
        return (
          <span className="badge-success flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approved
          </span>
        );
      }
      
      if (submissionStatus === 'rejected') {
        return (
          <span className="badge-error flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Rejected
          </span>
        );
      }
      
      return (
        <span className="badge-warning flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending
        </span>
      );
    }

    return (
      <span className="badge-primary flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-secondary-500 animate-pulse-soft"></span>
        In Progress
      </span>
    );
  };

  // Extract lab number from labId
  const labNumber = lab.labId.replace('lab', '');

  return (
    <div 
      className={`group relative card h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
        showLockIndicator 
          ? 'border-gray-300 dark:border-gray-700 opacity-75 hover:opacity-100' 
          : 'border-gt-gold/30 hover:border-gt-gold'
      }`}
    >
      {/* Lab Number Badge */}
      <div className={`absolute -top-3 -left-3 w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-lg shadow-lg transition-all duration-300 ${
        showLockIndicator 
          ? 'bg-gray-400 dark:bg-gray-600 text-white' 
          : 'bg-gradient-gt text-gt-gold group-hover:scale-110'
      }`}>
        {labNumber}
      </div>

      {/* Lock Indicator */}
      {showLockIndicator && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-display font-bold text-secondary-700 dark:text-white pr-8">
            {lab.title}
          </h3>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-grow">
          {lab.description}
        </p>

        {/* Status Badge */}
        <div className="mb-4">
          <div className="flex flex-col gap-2">
            <div>{getStatusBadge()}</div>
            {lab.dueDate && (
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Due: {new Date(lab.dueDate.split('T')[0] + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            )}
            
            {/* Grade Display */}
            {(lab.grade !== undefined && lab.grade !== null) && (
               <div className="flex items-center gap-2 mt-1">
                 <span className={`text-sm font-bold ${
                   lab.grade >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                   lab.grade >= 80 ? 'text-blue-600 dark:text-blue-400' :
                   'text-gray-600 dark:text-gray-400'
                 }`}>
                   Grade: {lab.grade}%
                 </span>
                 {(lab.earlyBirdPoints || 0) > 0 && (
                   <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 font-medium" title="Early Bird Bonus applied">
                     +{lab.earlyBirdPoints}% Early Bird
                   </span>
                 )}
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {isLocked ? (
            <div className="flex-1">
              <button 
                disabled 
                className="btn w-full bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Locked
              </button>
              <p className="text-xs text-center text-gray-400 mt-1">
                Wait for instructor
              </p>
            </div>
          ) : (
            <Link 
              to={`/labs/${lab.labId}`} 
              className="btn-primary flex-1 text-center"
            >
              {isStaff && !viewAsStudent && showLockIndicator 
                ? 'View Locked' 
                : isCompleted 
                  ? 'Review' 
                  : 'Continue'
              }
            </Link>
          )}
          
          {isStaff && !viewAsStudent && (
            <Link
              to={`/labs/${lab.labId}/edit`}
              className="btn bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              title="Edit Lab Content"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
          )}
        </div>
        
        {status?.unlockedAt && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Unlocked {new Date(status.unlockedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default LabCard;
