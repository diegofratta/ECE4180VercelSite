import React from 'react';
import ReactMarkdown from 'react-markdown';

interface NoteBlockProps {
  content: string;
  type: 'note' | 'warning';
}

const NoteBlock: React.FC<NoteBlockProps> = ({ content, type }) => {
  const isWarning = type === 'warning';
  
  return (
    <div className={`my-4 p-4 rounded-md border-l-4 ${
      isWarning 
        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 dark:border-yellow-600' 
        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
    }`}>
      <div className="flex items-center mb-2">
        <div className={`w-5 h-5 flex items-center justify-center rounded-full ${
          isWarning 
            ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200' 
            : 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
        }`}>
          {isWarning ? '!' : 'i'}
        </div>
        <h4 className={`ml-2 font-medium ${
          isWarning ? 'text-yellow-800 dark:text-yellow-200' : 'text-blue-800 dark:text-blue-200'
        }`}>
          {isWarning ? 'Warning' : 'Note'}
        </h4>
      </div>
      <div className={`prose max-w-none ${
        isWarning ? 'text-yellow-700 dark:text-yellow-300' : 'text-blue-700 dark:text-blue-300'
      }`}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default NoteBlock;