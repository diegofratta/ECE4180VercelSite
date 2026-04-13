import React from 'react';
import { Lab, LabSection } from '../../../types';
import SectionEditor from './SectionEditor';
import { v4 as uuidv4 } from 'uuid';

interface LabBuilderProps {
  lab: Lab;
  onChange: (updatedLab: Lab) => void;
}

const LabBuilder: React.FC<LabBuilderProps> = ({ lab, onChange }) => {
  // Ensure structuredContent exists
  const sections = lab.structuredContent?.sections || [];

  const handleUpdateSection = (index: number, updatedSection: LabSection) => {
    const newSections = [...sections];
    newSections[index] = updatedSection;
    
    onChange({
      ...lab,
      structuredContent: {
        ...lab.structuredContent,
        sections: newSections,
        // Preserve resources if they exist
        resources: lab.structuredContent?.resources || [],
      },
    });
  };

  const handleDeleteSection = (index: number) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    
    const newSections = [...sections];
    newSections.splice(index, 1);
    
    onChange({
      ...lab,
      structuredContent: {
        ...lab.structuredContent,
        sections: newSections,
        resources: lab.structuredContent?.resources || [],
      },
    });
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sections.length - 1) return;

    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    
    // Update order property
    newSections.forEach((section, idx) => {
      section.order = idx + 1;
    });

    onChange({
      ...lab,
      structuredContent: {
        ...lab.structuredContent,
        sections: newSections,
        resources: lab.structuredContent?.resources || [],
      },
    });
  };

  const handleAddSection = () => {
    const newSection: LabSection = {
      id: uuidv4(),
      type: 'custom',
      title: 'New Section',
      content: [],
      order: sections.length + 1,
    };
    
    onChange({
      ...lab,
      structuredContent: {
        ...lab.structuredContent,
        sections: [...sections, newSection],
        resources: lab.structuredContent?.resources || [],
      },
    });
  };

  return (
    <div className="lab-builder space-y-8">
      <div className="sections-container">
        {sections.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No sections yet</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new section to this lab.</p>
            <div className="mt-6">
              <button
                onClick={handleAddSection}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add First Section
              </button>
            </div>
          </div>
        ) : (
          sections.map((section, index) => (
            <SectionEditor
              key={section.id || index}
              section={section}
              onChange={(updatedSection) => handleUpdateSection(index, updatedSection)}
              onDelete={() => handleDeleteSection(index)}
              onMoveUp={() => handleMoveSection(index, 'up')}
              onMoveDown={() => handleMoveSection(index, 'down')}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
            />
          ))
        )}
      </div>

      {sections.length > 0 && (
        <div className="flex justify-center mt-8 pb-8">
          <button
            onClick={handleAddSection}
            className="inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <svg className="-ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add New Section
          </button>
        </div>
      )}
    </div>
  );
};

export default LabBuilder;
