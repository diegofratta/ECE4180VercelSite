/**
 * File validation utilities for image and video uploads
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Validates an image file for upload
 * 
 * @param file - The file to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateFile(file: File): ValidationResult {
  // Extract file extension
  const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';

  // Validate MIME type and extension
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Please select an image file (jpg, png, gif, webp, svg)',
    };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Image size exceeds 10MB limit',
    };
  }

  // File is valid
  return {
    valid: true,
  };
}

const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

const MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024; // 200MB in bytes

/**
 * Validates a video file for upload
 *
 * @param file - The file to validate
 * @returns ValidationResult with valid flag and optional error message
 */
export function validateVideoFile(file: File): ValidationResult {
  // Extract file extension
  const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';

  // Validate MIME type and extension
  if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type) || !ALLOWED_VIDEO_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Please select a video file (mp4, webm, mov)',
    };
  }

  // Validate file size
  if (file.size > MAX_VIDEO_FILE_SIZE) {
    return {
      valid: false,
      error: 'Video size exceeds 200MB limit',
    };
  }

  // File is valid
  return {
    valid: true,
  };
}
