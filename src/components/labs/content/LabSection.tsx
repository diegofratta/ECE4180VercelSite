import React from 'react';
import { LabSection as LabSectionType, LabContentBlock } from '../../../types';
import ContentBlock from './ContentBlock';

interface LabSectionProps {
  section: LabSectionType;
}

const LabSection: React.FC<LabSectionProps> = ({ section }) => {
  // Get the appropriate color based on section type
  const getSectionStyles = () => {
    switch (section.type) {
      case 'introduction':
        return { color: 'text-blue-600 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-900/40' };
      case 'objectives':
        return { color: 'text-green-600 dark:text-green-300', bgColor: 'bg-green-50 dark:bg-green-900/40' };
      case 'requirements':
        return { color: 'text-purple-600 dark:text-purple-300', bgColor: 'bg-purple-50 dark:bg-purple-900/40' };
      case 'instructions':
        return { color: 'text-indigo-600 dark:text-indigo-300', bgColor: 'bg-indigo-50 dark:bg-indigo-900/40' };
      case 'submission':
        return { color: 'text-orange-600 dark:text-orange-300', bgColor: 'bg-orange-50 dark:bg-orange-900/40' };
      default:
        return { color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-50 dark:bg-gray-800' };
    }
  };

  const { color, bgColor } = getSectionStyles();

  // Render content blocks if content is an array, otherwise render as markdown
  const renderContent = () => {
    // Add special handling for sections that typically contain lists
    const isList = section.type === 'objectives' || section.type === 'requirements';
    
    if (Array.isArray(section.content)) {
      return section.content.map((block: LabContentBlock, index: number) => {
        // For text blocks in list sections, ensure proper list formatting
        if (isList && block.type === 'text' && typeof block.content === 'string') {
          // Clone the block to avoid mutating the original
          const enhancedBlock = { ...block };
          
          // Ensure each line that should be a list item starts with a bullet point
          if (!enhancedBlock.content.includes('\n- ') && !enhancedBlock.content.includes('\n* ')) {
            enhancedBlock.content = enhancedBlock.content
              .split('\n')
              .map(line => {
                // Skip lines that are headers or already formatted
                if (line.startsWith('#') || line.trim() === '' || line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                  return line;
                }
                return '- ' + line.trim();
              })
              .join('\n');
          }
          
          return <ContentBlock key={index} block={enhancedBlock} />;
        }
        
        return <ContentBlock key={index} block={block} />;
      });
    } else {
      // If content is a string, create a text block
      return (
        <ContentBlock
          block={{
            type: 'text',
            content: section.content
          }}
        />
      );
    }
  };

  // Format the title with points if available (for instruction sections)
  const getDisplayTitle = () => {
    const title = section.title;
    
    // Only add points to instruction sections that have points defined
    if (section.type === 'instructions' && section.points !== undefined && section.points > 0) {
      if (section.isExtraCredit) {
        return `${title} (${section.points} points, extra credit)`;
      }
      return `${title} (${section.points} points)`;
    }
    
    return title;
  };

  return (
    <div className="mb-8" data-section-type={section.type}>
      <div className={`p-4 rounded-t-lg ${bgColor}`}>
        <h2 className={`text-xl font-bold ${color}`}>{getDisplayTitle()}</h2>
      </div>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-b-lg shadow-md dark:shadow-md dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700">
        {renderContent()}
      </div>
    </div>
  );
};

export default LabSection;