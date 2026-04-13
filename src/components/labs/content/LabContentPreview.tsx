import React, { useState, useEffect } from 'react';
import { Lab, LabContent } from '../../../types';
import StructuredLabContent from './StructuredLabContent';

interface LabContentPreviewProps {
  jsonContent: string;
}

const LabContentPreview: React.FC<LabContentPreviewProps> = ({ jsonContent }) => {
  const [parsedContent, setParsedContent] = useState<LabContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Try to parse the JSON content
      const parsedLab = JSON.parse(jsonContent) as Lab;
      
      // Check if the parsed content has the structuredContent property
      if (parsedLab && parsedLab.structuredContent) {
        setParsedContent(parsedLab.structuredContent);
        setError(null);
      } else {
        setError('The JSON does not contain valid structuredContent');
        setParsedContent(null);
      }
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      setParsedContent(null);
    }
  }, [jsonContent]);

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4">
        <p className="font-bold">Preview Error</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!parsedContent) {
    return (
      <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-300 p-4 mb-4">
        <p>No valid content to preview</p>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="bg-gray-100 dark:bg-gray-800 p-4 mb-4 rounded-lg">
        <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">Content Preview</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          This is a preview of how the lab content will appear to students.
        </p>
      </div>
      
      <StructuredLabContent content={parsedContent} />
    </div>
  );
};

export default LabContentPreview;