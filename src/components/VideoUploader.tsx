import React, { useState, useRef } from 'react';
import { API_ENDPOINT } from '../aws-config';
import { validateVideoFile } from '../utils/fileValidation';

interface VideoUploaderProps {
  onUploadComplete: (videoUrl: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
}

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({
  onUploadComplete,
  onUploadStart,
  onUploadError,
}) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file using the validateVideoFile utility
    const validationResult = validateVideoFile(selectedFile);

    if (!validationResult.valid) {
      console.error('Video validation failed:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        error: validationResult.error,
      });

      setUploadState({
        file: null,
        progress: 0,
        status: 'error',
        error: validationResult.error,
      });
      return;
    }

    // File is valid - set it and immediately start upload
    setUploadState({
      file: selectedFile,
      progress: 0,
      status: 'idle',
    });

    // Automatically start upload after file selection
    setTimeout(() => {
      handleUploadWithFile(selectedFile);
    }, 0);
  };

  const handleUploadWithFile = async (file: File) => {
    if (!file) return;

    try {
      setUploadState((prev) => ({
        ...prev,
        progress: 0,
        status: 'uploading',
      }));

      if (onUploadStart) {
        onUploadStart();
      }

      // Step 1: Get presigned URL from API
      const token = localStorage.getItem('idToken');

      if (!token) {
        throw new Error('Not authenticated. Please log in.');
      }

      console.log('Requesting presigned URL for video...', {
        fileName: file.name,
        fileType: file.type,
        endpoint: `${API_ENDPOINT}/images/presigned-url`,
      });

      const presignedUrlResponse = await fetch(`${API_ENDPOINT}/images/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignedUrlResponse.ok) {
        const errorText = await presignedUrlResponse.text();
        const errorDetails = {
          status: presignedUrlResponse.status,
          statusText: presignedUrlResponse.statusText,
          fileName: file.name,
          fileType: file.type,
          responseBody: errorText,
        };
        console.error('Failed to get presigned URL:', errorDetails);

        if (presignedUrlResponse.status === 403) {
          throw new Error('You do not have permission to upload videos. Staff access required.');
        } else if (presignedUrlResponse.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        throw new Error(`Failed to get upload URL: ${presignedUrlResponse.statusText}`);
      }

      const { uploadUrl, publicUrl } = await presignedUrlResponse.json();
      console.log('Presigned URL received:', { publicUrl });

      // Step 2: Upload file to S3 using presigned URL
      console.log('Starting S3 video upload...');
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log('Upload progress:', percentComplete + '%');
          setUploadState((prev) => ({
            ...prev,
            progress: percentComplete,
          }));
        }
      };

      xhr.onload = () => {
        console.log('S3 upload response:', {
          status: xhr.status,
          statusText: xhr.statusText,
          publicUrl: publicUrl,
        });

        if (xhr.status === 200) {
          setUploadState({
            file: null,
            progress: 100,
            status: 'success',
          });

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          console.log('Calling onUploadComplete with URL:', publicUrl);
          onUploadComplete(publicUrl);
        } else {
          throw new Error(`Upload failed with status ${xhr.status}. Please try again.`);
        }
      };

      xhr.onerror = () => {
        const errorMsg = 'Upload failed. Please try again.';
        console.error('S3 upload failed:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadUrl: uploadUrl,
          xhrStatus: xhr.status,
          xhrStatusText: xhr.statusText,
        });
        setUploadState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMsg,
        }));
        if (onUploadError) {
          onUploadError(errorMsg);
        }
      };

      xhr.send(file);
    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error('Video upload error:', {
        error: error,
        errorMessage: errorMsg,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        stack: (error as Error).stack,
      });
      setUploadState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
      if (onUploadError) {
        onUploadError(errorMsg);
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="inline-flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploadState.status === 'uploading'}
      />

      <button
        onClick={handleButtonClick}
        disabled={uploadState.status === 'uploading'}
        className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
        type="button"
      >
        {uploadState.status === 'uploading'
          ? 'Uploading...'
          : 'Choose & Upload Video'}
      </button>

      {uploadState.status === 'uploading' && (
        <div className="mt-2 w-full">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-teal-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Uploading: {uploadState.progress}%
          </p>
        </div>
      )}

      {uploadState.status === 'error' && uploadState.error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {uploadState.error}
        </div>
      )}

      {uploadState.status === 'success' && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
          Upload complete!
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
