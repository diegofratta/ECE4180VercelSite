import React from 'react';

interface LinkBlockProps {
  url?: string;
  content?: string;
}

const LinkBlock: React.FC<LinkBlockProps> = ({ url, content }) => {
  if (!url) {
    return null;
  }

  return (
    <div className="my-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {content || url}
      </a>
    </div>
  );
};

export default LinkBlock;
