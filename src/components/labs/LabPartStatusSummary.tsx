import React from 'react';
import { LabPart, PartSubmission } from '../../types';

interface LabPartStatusSummaryProps {
  labId: string;
  labTitle: string;
  labParts: LabPart[];
  partSubmissions: Record<string, PartSubmission>;
  labProgress?: Record<string, { completed: boolean; checkoffType?: string; updatedAt?: string }>;
  progressLoading?: boolean;
}

const LabPartStatusSummary: React.FC<LabPartStatusSummaryProps> = ({
  labId,
  labTitle,
  labParts,
  partSubmissions,
  labProgress = {},
  progressLoading = false
}) => {
  // Function to handle clicking on a part
  const handlePartClick = (partId: string) => {
    // Find the element to scroll to
    const element = document.getElementById(`lab-part-${partId}`);
    
    if (element) {
      // Scroll to the element smoothly
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };
  // Get status text and color for a part
  const getPartStatus = (partId: string) => {
    // Show loading state
    if (progressLoading) {
      return {
        text: 'Loading...',
        cardBg: 'bg-gray-50 dark:bg-gray-800/50',
        badgeBg: 'bg-white dark:bg-gray-700',
        textColor: 'text-gray-500 dark:text-gray-400',
        borderColor: 'border-gray-200 dark:border-gray-700',
        isLoading: true
      };
    }
    
    const submission = partSubmissions[partId];
    const progress = labProgress[partId];
    
    // Check progress first for all labs (source of truth for completion)
    // This handles both in-lab checkoffs (manual) and approved video submissions
    if (progress?.completed) {
      return {
        text: 'Approved',
        cardBg: 'bg-green-50 dark:bg-green-900/20',
        badgeBg: 'bg-white dark:bg-green-900/50',
        textColor: 'text-green-700 dark:text-green-300',
        borderColor: 'border-green-200 dark:border-green-800'
      };
    }
    
    // For lab0 (in-lab checkoffs), if not completed, show in-lab checkoff required
    if (labId === 'lab0') {
      return {
        text: 'Checkoff in lab',
        cardBg: 'bg-blue-50 dark:bg-blue-900/20',
        badgeBg: 'bg-white dark:bg-blue-900/50',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-800'
      };
    }
    
    if (!submission) {
      return {
        text: 'Not submitted',
        cardBg: 'bg-gray-50 dark:bg-gray-800/50',
        badgeBg: 'bg-white dark:bg-gray-700',
        textColor: 'text-gray-600 dark:text-gray-400',
        borderColor: 'border-gray-200 dark:border-gray-700'
      };
    }
    
    switch (submission.status) {
      case 'pending':
        return {
          text: 'Under review',
          cardBg: 'bg-yellow-50 dark:bg-yellow-900/20',
          badgeBg: 'bg-white dark:bg-yellow-900/50',
          textColor: 'text-yellow-700 dark:text-yellow-300',
          borderColor: 'border-yellow-200 dark:border-yellow-800'
        };
      case 'approved':
        return {
          text: 'Accepted',
          cardBg: 'bg-green-50 dark:bg-green-900/20',
          badgeBg: 'bg-white dark:bg-green-900/50',
          textColor: 'text-green-700 dark:text-green-300',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'rejected':
        return {
          text: 'Rejected',
          cardBg: 'bg-red-50 dark:bg-red-900/20',
          badgeBg: 'bg-white dark:bg-red-900/50',
          textColor: 'text-red-700 dark:text-red-300',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      default:
        return {
          text: 'Not submitted',
          cardBg: 'bg-gray-50 dark:bg-gray-800/50',
          badgeBg: 'bg-white dark:bg-gray-700',
          textColor: 'text-gray-600 dark:text-gray-400',
          borderColor: 'border-gray-200 dark:border-gray-700'
        };
    }
  };


  // Sort parts by order
  const sortedParts = [...labParts].sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-lg p-4 mb-6 sticky top-4 border dark:border-gray-700">
      <h2 className="text-xl font-bold mb-4 text-primary-700 dark:text-primary-300 border-b dark:border-gray-700 pb-2">
        Lab Progress
      </h2>
      
      <div className="mb-3">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">{labTitle}</h3>
      </div>
      
      <div className="space-y-3">
        {sortedParts.map((part) => {
          const status = getPartStatus(part.partId);
          
          return (
            <div
              key={part.partId}
              className={`border ${status.borderColor} rounded-md p-3 ${status.cardBg} cursor-pointer hover:shadow-md transition-all duration-200`}
              onClick={() => handlePartClick(part.partId)}
            >
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    Part {part.order}: {part.title}
                  </span>
                  {part.isExtraCredit && (
                    <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex-shrink-0">
                      EC
                    </span>
                  )}
                  {part.points !== undefined && part.points > 0 && (
                    <span className={`text-xs font-medium flex-shrink-0 ${
                      part.isExtraCredit 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {part.isExtraCredit ? '+' : ''}{part.points} pts
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold h-7 w-[100px] rounded-full flex items-center justify-center shrink-0 ${status.badgeBg} ${status.textColor} border ${status.borderColor} shadow-sm`}>
                  {status.text}
                </span>
              </div>
              
              {partSubmissions[part.partId]?.feedback && (
                <div className="mt-2 text-sm italic">
                  {partSubmissions[part.partId].feedback}
                </div>
              )}
            </div>
          );
        })}
        
        {sortedParts.length === 0 && (
          <div className="text-gray-500 text-center py-4">
            No lab parts found
          </div>
        )}
      </div>
    </div>
  );
};

export default LabPartStatusSummary;