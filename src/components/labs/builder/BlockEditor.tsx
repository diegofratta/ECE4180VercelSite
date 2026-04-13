import React from 'react';
import { LabContentBlock } from '../../../types';
import ImageUploader from '../../ImageUploader';
import VideoUploader from '../../VideoUploader';
import VideoPlayer from '../../VideoPlayer';

interface BlockEditorProps {
  block: LabContentBlock;
  onChange: (updatedBlock: LabContentBlock) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const handleChange = (field: keyof LabContentBlock, value: any) => {
    onChange({ ...block, [field]: value });
  };

  const renderEditor = () => {
    switch (block.type) {
      case 'text':
      case 'note':
      case 'warning':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {block.type} Content (Markdown)
            </label>
            <textarea
              value={block.content}
              onChange={(e) => handleChange('content', e.target.value)}
              className="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder={`Enter ${block.type} content...`}
            />
          </div>
        );
      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={block.url || ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://example.com/image.png"
                />
                {block.url && (
                  <button
                    onClick={() => handleChange('url', '')}
                    className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50"
                    title="Clear URL"
                  >
                    ✕
                  </button>
                )}
                <ImageUploader
                  onUploadComplete={(url) => {
                    console.log('BlockEditor received upload URL:', url);
                    handleChange('url', url);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Caption</label>
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => handleChange('caption', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Image caption"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Width: {block.scale ?? 100}%
                </label>
                {(block.scale ?? 100) !== 100 && (
                  <button
                    onClick={() => handleChange('scale', 100)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Reset to 100%
                  </button>
                )}
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={block.scale ?? 100}
                onChange={(e) => handleChange('scale', Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#2563eb' }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>10%</span>
                <span>50%</span>
                <span>100% (full width)</span>
              </div>
            </div>
            {block.url && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                <img src={block.url} alt="Preview" className="max-h-40 rounded border border-gray-200" />
              </div>
            )}
          </div>
        );
      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Video URL</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={block.url || ''}
                  onChange={(e) => handleChange('url', e.target.value)}
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://example.com/video.mp4"
                />
                {block.url && (
                  <button
                    onClick={() => handleChange('url', '')}
                    className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50"
                    title="Clear URL"
                  >
                    ✕
                  </button>
                )}
                <VideoUploader
                  onUploadComplete={(url) => {
                    console.log('BlockEditor received video upload URL:', url);
                    handleChange('url', url);
                  }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Caption</label>
              <input
                type="text"
                value={block.caption || ''}
                onChange={(e) => handleChange('caption', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Video caption"
              />
            </div>
            {block.url && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Preview:</p>
                <VideoPlayer videoUrl={block.url} />
              </div>
            )}
          </div>
        );
      case 'link':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Link URL</label>
              <input
                type="text"
                value={block.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Text</label>
              <input
                type="text"
                value={block.content}
                onChange={(e) => handleChange('content', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Click here to view the resource"
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty to display the URL itself</p>
            </div>
          </div>
        );
      case 'code':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
              <input
                type="text"
                value={block.language || ''}
                onChange={(e) => handleChange('language', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="python, javascript, cpp, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Code</label>
              <textarea
                value={block.content}
                onChange={(e) => handleChange('content', e.target.value)}
                className="w-full h-48 font-mono text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Enter code here..."
                spellCheck={false}
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="p-4 bg-gray-100 rounded text-gray-500">
            Unsupported block type: {block.type}
          </div>
        );
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm mb-4 relative hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide
            ${block.type === 'text' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : ''}
            ${block.type === 'image' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : ''}
            ${block.type === 'code' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : ''}
            ${block.type === 'note' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : ''}
            ${block.type === 'video' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : ''}
            ${block.type === 'warning' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : ''}
            ${block.type === 'link' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' : ''}
          `}>
            {block.type}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${isFirst ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
            title="Move Up"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${isLast ? 'text-gray-300 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'}`}
            title="Move Down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-2"
            title="Delete Block"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {renderEditor()}
    </div>
  );
};

export default BlockEditor;
