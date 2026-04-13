import React from 'react';
import { LabSection, LabContentBlock } from '../../../types';
import BlockEditor from './BlockEditor';

interface SectionEditorProps {
  section: LabSection;
  onChange: (updatedSection: LabSection) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  // Ensure content is an array of blocks
  const getBlocks = (): LabContentBlock[] => {
    if (Array.isArray(section.content)) {
      return section.content;
    }
    // Convert string content to a single text block
    return [{
      type: 'text',
      content: section.content || ''
    }];
  };

  const blocks = getBlocks();

  const handleUpdateBlock = (index: number, updatedBlock: LabContentBlock) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updatedBlock;
    onChange({ ...section, content: newBlocks });
  };

  const handleDeleteBlock = (index: number) => {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 1);
    onChange({ ...section, content: newBlocks });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onChange({ ...section, content: newBlocks });
  };

  const handleAddBlock = (type: LabContentBlock['type']) => {
    const newBlock: LabContentBlock = {
      type,
      content: '',
      language: type === 'code' ? 'text' : undefined,
    };
    onChange({ ...section, content: [...blocks, newBlock] });
  };

  const getSectionColor = () => {
    switch (section.type) {
      case 'introduction': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'objectives': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'requirements': return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'instructions': return 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20';
      case 'submission': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-800/50';
    }
  };

  return (
    <div className={`border-l-4 ${getSectionColor()} shadow-md rounded-r-lg mb-8 bg-white dark:bg-gray-800 transition-colors`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-grow flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-40 flex-shrink-0">
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Type</label>
            <select
              value={section.type}
              onChange={(e) => onChange({ ...section, type: e.target.value as any })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="introduction">Introduction</option>
              <option value="objectives">Objectives</option>
              <option value="requirements">Requirements</option>
              <option value="instructions">Instructions</option>
              <option value="submission">Submission</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="flex-grow">
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Title</label>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onChange({ ...section, title: e.target.value })}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Section Title"
            />
          </div>
          
          {/* Points and Extra Credit - only for instructions sections */}
          {section.type === 'instructions' && (
            <>
              <div className="w-full md:w-20 flex-shrink-0">
                <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase font-bold mb-1">Points</label>
                <input
                  type="number"
                  min="0"
                  value={section.points || ''}
                  onChange={(e) => onChange({ ...section, points: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                />
              </div>
              <div className="flex-shrink-0 flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={section.isExtraCredit || false}
                    onChange={(e) => onChange({ ...section, isExtraCredit: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Extra Credit</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-200 dark:border-gray-700 justify-end">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={`p-2 rounded hover:bg-white dark:hover:bg-gray-700 ${isFirst ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
            title="Move Section Up"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={`p-2 rounded hover:bg-white dark:hover:bg-gray-700 ${isLast ? 'text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'}`}
             title="Move Section Down"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            title="Delete Section"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700/50">
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <BlockEditor
              key={index}
              block={block}
              onChange={(updatedBlock) => handleUpdateBlock(index, updatedBlock)}
              onDelete={() => handleDeleteBlock(index)}
              onMoveUp={() => handleMoveBlock(index, 'up')}
              onMoveDown={() => handleMoveBlock(index, 'down')}
              isFirst={index === 0}
              isLast={index === blocks.length - 1}
            />
          ))}

          {blocks.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              No content blocks in this section yet.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <span className="text-sm text-gray-500 dark:text-gray-400 self-center mr-2">Add Content:</span>
          <button
            onClick={() => handleAddBlock('text')}
            className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center transition-colors shadow-sm"
          >
            <span className="mr-1">+</span> Text
          </button>
          <button
             onClick={() => handleAddBlock('image')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Image
          </button>
          <button
             onClick={() => handleAddBlock('video')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-teal-700 dark:text-teal-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Video
          </button>
          <button
             onClick={() => handleAddBlock('code')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Code
          </button>
          <button
             onClick={() => handleAddBlock('note')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-yellow-700 dark:text-yellow-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Note
          </button>
          <button
             onClick={() => handleAddBlock('warning')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-red-700 dark:text-red-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Warning
          </button>
          <button
             onClick={() => handleAddBlock('link')}
             className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm font-medium text-cyan-700 dark:text-cyan-300 flex items-center transition-colors shadow-sm"
          >
             <span className="mr-1">+</span> Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionEditor;
