import React from 'react';
import { Link } from 'react-router-dom';
import { Guide } from '../../types';

interface GuideCardProps {
  guide: Guide;
  isStaff?: boolean;
}

const GuideCard: React.FC<GuideCardProps> = ({ guide, isStaff = false }) => {
  // Use the tag field for displaying, show nothing if not set
  const hasTag = guide.tag && guide.tag.trim().length > 0;

  return (
    <div 
      className="group relative card h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-purple-300/30 hover:border-purple-500"
    >
      {/* Guide Tag Badge - Only show if tag is set */}
      {hasTag && (
        <div className="absolute -top-3 -left-3 px-3 py-1.5 rounded-xl flex items-center justify-center font-display font-bold text-xs shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-500 to-purple-700 text-white group-hover:scale-110 whitespace-nowrap">
          {guide.tag}
        </div>
      )}

      {/* Content */}
      <div className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-display font-bold text-secondary-700 dark:text-white pr-8">
            {guide.title}
          </h3>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 flex-grow">
          {guide.description}
        </p>

        {/* Always Available Badge */}
        <div className="mb-4">
          <span className="badge-success flex items-center gap-1.5 w-fit">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Available
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Link 
            to={`/guides/${guide.guideId}`} 
            className="btn-primary flex-1 text-center"
          >
            View Guide
          </Link>
          
          {isStaff && (
            <Link
              to={`/guides/${guide.guideId}/edit`}
              className="btn bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
              title="Edit Guide Content"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Link>
          )}
        </div>
        
        {guide.updatedAt && (
          <p className="text-xs text-gray-400 text-center mt-2">
            Updated {new Date(guide.updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default GuideCard;
