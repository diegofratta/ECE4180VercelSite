import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../../contexts/AuthContext';
import { UploadProgress } from '../../types';
import { API_ENDPOINT } from '../../aws-config';

interface VideoUploaderProps {
  labId: string;
  onUploadComplete: (fileKey: string) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ labId, onUploadComplete }) => {
  const { authState } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    fileName: '',
    progress: 0,
    status: 'idle'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check if file is a video
      if (!selectedFile.type.startsWith('video/')) {
        setUploadProgress({
          fileName: selectedFile.name,
          progress: 0,
          status: 'error',
          error: 'Please select a video file'
        });
        return;
      }

      // Check file size (limit to 500MB)
      if (selectedFile.size > 500 * 1024 * 1024) {
        setUploadProgress({
          fileName: selectedFile.name,
          progress: 0,
          status: 'error',
          error: 'File size exceeds 500MB limit'
        });
        return;
      }

      setFile(selectedFile);
      setUploadProgress({
        fileName: selectedFile.name,
        progress: 0,
        status: 'idle'
      });
    }
  };

  const handleUpload = async () => {
    if (!file || !labId) return;

    try {
      setUploadProgress({
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });

      // Step 1: Get a presigned URL from the API
      const token = localStorage.getItem('idToken');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const presignedUrlResponse = await fetch(`${API_ENDPOINT}/submissions/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          labId
        })
      });

      if (!presignedUrlResponse.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadUrl, fileKey } = await presignedUrlResponse.json();

      // Step 2: Upload the file to S3 using the presigned URL
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => ({
            ...prev,
            progress: percentComplete
          }));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          // Step 3: Create submission record
          const createSubmissionResponse = await fetch(`${API_ENDPOINT}/submissions/submit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              labId,
              fileKey,
              notes
            })
          });

          if (!createSubmissionResponse.ok) {
            throw new Error('Failed to create submission record');
          }

          setUploadProgress({
            fileName: file.name,
            progress: 100,
            status: 'success'
          });

          // Reset form
          setFile(null);
          setNotes('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

          // Notify parent component
          onUploadComplete(fileKey);
        } else {
          throw new Error('Upload failed');
        }
      };

      xhr.onerror = () => {
        setUploadProgress(prev => ({
          ...prev,
          status: 'error',
          error: 'Upload failed'
        }));
      };

      xhr.send(file);
    } catch (error) {
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        error: (error as Error).message
      }));
    }
  };

  const resetUpload = () => {
    setFile(null);
    setUploadProgress({
      fileName: '',
      progress: 0,
      status: 'idle'
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4">Submit Video Demonstration</h3>
      
      {uploadProgress.status === 'success' ? (
        <div className="bg-green-100 border-l-4 border-green-500 p-4 mb-4">
          <p className="text-green-700">
            Video uploaded successfully! Your submission is now pending review.
          </p>
          <button 
            onClick={resetUpload}
            className="mt-2 text-sm text-green-700 underline"
          >
            Upload another video
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {uploadProgress.status === 'error' && (
            <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-red-700">{uploadProgress.error}</p>
            </div>
          )}
          
          <div>
            <label htmlFor="video-file" className="label">
              Select Video File
            </label>
            <input
              ref={fileInputRef}
              id="video-file"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 dark:text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-primary-50 file:text-primary-700
                dark:file:!bg-gray-700 dark:file:text-gray-200
                hover:file:bg-primary-100 dark:hover:file:!bg-gray-600"
              disabled={uploadProgress.status === 'uploading'}
            />
            <p className="mt-1 text-xs text-gray-500">
              Max file size: 500MB. Supported formats: MP4, MOV, AVI, etc.
            </p>
          </div>
          
          {file && (
            <>
              <div>
                <label htmlFor="notes" className="label">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full h-24"
                  placeholder="Add any notes about your submission..."
                  disabled={uploadProgress.status === 'uploading'}
                />
              </div>
              
              {uploadProgress.status === 'uploading' && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-primary-600 h-2.5 rounded-full" 
                      style={{ width: `${uploadProgress.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Uploading: {uploadProgress.progress}%
                  </p>
                </div>
              )}
              
              <div className="flex space-x-4">
                <button
                  onClick={handleUpload}
                  disabled={uploadProgress.status === 'uploading'}
                  className="btn-primary"
                >
                  {uploadProgress.status === 'uploading' ? 'Uploading...' : 'Upload Video'}
                </button>
                
                <button
                  onClick={resetUpload}
                  disabled={uploadProgress.status === 'uploading'}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
