import React, { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';

interface VideoPlayerProps {
  videoUrl: string | undefined;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl = '', className = '' }) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [playError, setPlayError] = useState(false);

  // Extract filename from URL for display
  const getFilenameFromUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      const filename = parts[parts.length - 1];
      
      if (filename && filename.includes('.')) {
        return decodeURIComponent(filename);
      }
      return 'video file';
    } catch (e) {
      return 'video file';
    }
  };

  // Initialize Video.js player
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    // Reset error state on new URL
    setPlayError(false);

    // Make sure Video.js player container exists
    if (!playerRef.current) {
      // Create a video element inside the container
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered', 'vjs-theme-city');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, {
        controls: true,
        responsive: true,
        fluid: true,
        preload: 'metadata',
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        sources: [{
          src: videoUrl,
          type: 'video/mp4'
        }],
        html5: {
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        }
      }, () => {
        console.log('Video.js player is ready');
      });

      // Handle errors
      player.on('error', () => {
        console.error('Video.js playback error');
        setPlayError(true);
      });
    } else {
      // Update existing player source
      const player = playerRef.current;
      player.src({ src: videoUrl, type: 'video/mp4' });
      player.load();
    }
  }, [videoUrl]);

  // Dispose player on unmount
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  if (!videoUrl) {
    return (
      <div className="bg-yellow-100 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded-md">
        <p className="text-yellow-700 dark:text-yellow-200">No video available</p>
      </div>
    );
  }

  return (
    <div className={`video-player bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="flex flex-col items-center">
        {/* Video.js Player Container */}
        {!playError && (
          <div 
            ref={videoRef} 
            className="w-full max-w-3xl rounded-md overflow-hidden"
            data-vjs-player
          />
        )}

        {/* Fallback notice if playback fails */}
        {playError && (
          <div className="w-full max-w-3xl mb-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded">
            Video playback failed. Use Download or Open in New Tab below.
          </div>
        )}

        {/* Title / filename */}
        <p className="text-gray-600 dark:text-gray-300 text-center my-3">
          {getFilenameFromUrl(videoUrl)}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center"
            download
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Video
          </a>
          
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in New Tab
          </a>
        </div>
        
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm flex items-center"
        >
          {showInfo ? 'Hide Info' : 'Show Info'}
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ml-1 transform ${showInfo ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showInfo && (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-md w-full text-sm">
            <p className="text-gray-700 dark:text-gray-200 mb-1"><strong>Note:</strong> If you're having trouble viewing the video in your browser:</p>
            <ol className="list-decimal pl-5 text-gray-600 dark:text-gray-300">
              <li>Try downloading the video and opening it with your computer's video player</li>
              <li>Make sure you have the correct codecs installed for this video format</li>
              <li>Some browsers may have restrictions on playing certain video formats</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;