import React from 'react';
import { LabContentBlock } from '../../../types';
import TextBlock from './TextBlock';
import ImageBlock from './ImageBlock';
import CodeBlock from './CodeBlock';
import NoteBlock from './NoteBlock';
import LinkBlock from './LinkBlock';
import VideoPlayer from '../../VideoPlayer';

interface ContentBlockProps {
  block: LabContentBlock;
}

const ContentBlock: React.FC<ContentBlockProps> = ({ block }) => {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content} />;
    case 'image':
      return <ImageBlock url={block.url} caption={block.caption} scale={block.scale} />;
    case 'code':
      return <CodeBlock content={block.content} language={block.language} />;
    case 'note':
      return <NoteBlock content={block.content} type="note" />;
    case 'warning':
      return <NoteBlock content={block.content} type="warning" />;
    case 'video':
      return <VideoPlayer videoUrl={block.url} />;
    case 'link':
      return <LinkBlock url={block.url} content={block.content} />;
    case 'diagram':
      // For now, treat diagrams as images
      return <ImageBlock url={block.url} caption={block.caption} scale={block.scale} />;
    default:
      return <div>Unknown content type</div>;
  }
};

export default ContentBlock;
