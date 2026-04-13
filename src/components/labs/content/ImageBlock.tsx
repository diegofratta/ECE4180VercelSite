import React from 'react';

interface ImageBlockProps {
  url?: string;
  caption?: string;
  scale?: number; // percentage of container width (default 100)
}

const ImageBlock: React.FC<ImageBlockProps> = ({ url, caption, scale = 100 }) => {
  if (!url) {
    return null;
  }

  return (
    <div className="my-4 flex flex-col items-center">
      <img
        src={url}
        alt={caption || 'Lab image'}
        className="h-auto rounded-lg shadow-md"
        style={{ width: `${scale}%`, maxWidth: '100%' }}
      />
      {caption && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center italic">
          {caption}
        </p>
      )}
    </div>
  );
};

export default ImageBlock;
