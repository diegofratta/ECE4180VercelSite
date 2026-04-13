import React from 'react';
import { LabContent } from '../../../types';
import LabSection from './LabSection';

interface StructuredLabContentProps {
  content: LabContent;
}

const StructuredLabContent: React.FC<StructuredLabContentProps> = ({ content }) => {
  // Sort sections by order
  const sortedSections = [...content.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="structured-lab-content bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <div className="mb-8">
        {sortedSections.map((section) => (
          <LabSection key={section.id} section={section} />
        ))}
      </div>
      
      {content.resources && content.resources.length > 0 && (
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-xl font-bold mb-4 text-primary-700 dark:text-primary-300">
            Additional Resources
          </h3>
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-lg shadow-inner">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {content.resources.map((resource) => (
                <li key={resource.id} className="py-4">
                  <div>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-lg flex items-center"
                    >
                      <span className="w-6 h-6 mr-3 inline-flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-500 dark:text-blue-300 rounded-full">
                        {resource.type === 'document' && 'D'}
                        {resource.type === 'image' && 'I'}
                        {resource.type === 'video' && 'V'}
                        {resource.type === 'link' && 'L'}
                      </span>
                      {resource.title}
                    </a>
                    {resource.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1 ml-9">{resource.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StructuredLabContent;