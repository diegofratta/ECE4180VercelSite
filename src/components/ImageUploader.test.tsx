import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUploader from './ImageUploader';
import { API_ENDPOINT } from '../aws-config';

// Mock the API_ENDPOINT
jest.mock('../aws-config', () => ({
  API_ENDPOINT: 'http://localhost:3000/api',
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public status = 0;
  public upload = {
    onprogress: null as ((event: ProgressEvent) => void) | null,
  };
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  private method = '';
  private url = '';
  private headers: Record<string, string> = {};

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body?: any) {
    // Simulate successful upload
    setTimeout(() => {
      // Simulate progress events
      if (this.upload.onprogress) {
        this.upload.onprogress(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: 50,
            total: 100,
          })
        );
        this.upload.onprogress(
          new ProgressEvent('progress', {
            lengthComputable: true,
            loaded: 100,
            total: 100,
          })
        );
      }

      // Simulate successful completion
      this.status = 200;
      if (this.onload) {
        this.onload();
      }
    }, 100);
  }
}

describe('ImageUploader - Upload Orchestration (Task 2.4)', () => {
  let originalXMLHttpRequest: typeof XMLHttpRequest;

  beforeEach(() => {
    // Store original XMLHttpRequest
    originalXMLHttpRequest = window.XMLHttpRequest;
    // Replace with mock
    (window as any).XMLHttpRequest = MockXMLHttpRequest;
    
    // Set up localStorage with a token
    mockLocalStorage.setItem('idToken', 'test-token');
    
    // Mock fetch for presigned URL request
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // Restore original XMLHttpRequest
    window.XMLHttpRequest = originalXMLHttpRequest;
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  test('should coordinate complete upload process successfully', async () => {
    const mockOnUploadComplete = jest.fn();
    const mockOnUploadStart = jest.fn();

    // Mock successful presigned URL response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
        publicUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
      }),
    });

    render(
      <ImageUploader
        onUploadComplete={mockOnUploadComplete}
        onUploadStart={mockOnUploadStart}
      />
    );

    // Create a test file
    const file = new File(['test image content'], 'test.jpg', {
      type: 'image/jpeg',
    });

    // Get file input and upload button
    const fileInput = screen.getByRole('button', { name: /upload image/i });
    
    // Click to open file picker (we'll simulate file selection directly)
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Simulate file selection
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(hiddenInput);

    // Wait for file to be selected
    await waitFor(() => {
      expect(screen.getByText(/selected: test\.jpg/i)).toBeInTheDocument();
    });

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /^upload$/i });
    fireEvent.click(uploadButton);

    // Verify onUploadStart was called
    expect(mockOnUploadStart).toHaveBeenCalledTimes(1);

    // Verify presigned URL request was made
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_ENDPOINT}/images/presigned-url`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify({
            fileName: 'test.jpg',
            fileType: 'image/jpeg',
          }),
        })
      );
    });

    // Wait for upload to complete
    await waitFor(
      () => {
        expect(mockOnUploadComplete).toHaveBeenCalledWith(
          'https://s3.amazonaws.com/test-bucket/images/test.jpg'
        );
      },
      { timeout: 3000 }
    );

    // Verify success message is shown
    expect(screen.getByText(/upload complete!/i)).toBeInTheDocument();
  });

  test('should handle presigned URL request errors', async () => {
    const mockOnUploadError = jest.fn();

    // Mock failed presigned URL response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(
      <ImageUploader
        onUploadComplete={jest.fn()}
        onUploadError={mockOnUploadError}
      />
    );

    // Create and select a test file
    const file = new File(['test image content'], 'test.jpg', {
      type: 'image/jpeg',
    });

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(hiddenInput);

    // Wait for file to be selected
    await waitFor(() => {
      expect(screen.getByText(/selected: test\.jpg/i)).toBeInTheDocument();
    });

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /^upload$/i });
    fireEvent.click(uploadButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/failed to get upload url\. please try again\./i)).toBeInTheDocument();
    });

    // Verify error callback was called
    expect(mockOnUploadError).toHaveBeenCalledWith('Failed to get upload URL. Please try again.');
  });

  test('should update component state throughout upload process', async () => {
    const mockOnUploadComplete = jest.fn();

    // Mock successful presigned URL response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
        publicUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
      }),
    });

    render(<ImageUploader onUploadComplete={mockOnUploadComplete} />);

    // Create and select a test file
    const file = new File(['test image content'], 'test.jpg', {
      type: 'image/jpeg',
    });

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(hiddenInput);

    // Verify idle state with file selected
    await waitFor(() => {
      expect(screen.getByText(/selected: test\.jpg/i)).toBeInTheDocument();
    });

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /^upload$/i });
    fireEvent.click(uploadButton);

    // Verify uploading state
    await waitFor(() => {
      expect(screen.getByText(/uploading\.\.\./i)).toBeInTheDocument();
    });

    // Verify progress bar appears
    await waitFor(() => {
      expect(screen.getByText(/uploading: \d+%/i)).toBeInTheDocument();
    });

    // Wait for success state
    await waitFor(
      () => {
        expect(screen.getByText(/upload complete!/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  test('should handle S3 upload errors', async () => {
    const mockOnUploadError = jest.fn();

    // Mock successful presigned URL response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploadUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
        publicUrl: 'https://s3.amazonaws.com/test-bucket/images/test.jpg',
      }),
    });

    // Create a mock XHR that fails
    class FailingMockXMLHttpRequest extends MockXMLHttpRequest {
      send(body?: any) {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 100);
      }
    }

    (window as any).XMLHttpRequest = FailingMockXMLHttpRequest;

    render(
      <ImageUploader
        onUploadComplete={jest.fn()}
        onUploadError={mockOnUploadError}
      />
    );

    // Create and select a test file
    const file = new File(['test image content'], 'test.jpg', {
      type: 'image/jpeg',
    });

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
      writable: false,
    });
    fireEvent.change(hiddenInput);

    // Wait for file to be selected
    await waitFor(() => {
      expect(screen.getByText(/selected: test\.jpg/i)).toBeInTheDocument();
    });

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /^upload$/i });
    fireEvent.click(uploadButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/upload failed\. please try again\./i)).toBeInTheDocument();
    });

    // Verify error callback was called
    expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed. Please try again.');
  });

  test('should not upload if no file is selected', async () => {
    const mockOnUploadComplete = jest.fn();
    const mockOnUploadStart = jest.fn();

    render(
      <ImageUploader
        onUploadComplete={mockOnUploadComplete}
        onUploadStart={mockOnUploadStart}
      />
    );

    // Try to trigger upload without selecting a file
    const uploadButton = screen.getByRole('button', { name: /upload image/i });
    fireEvent.click(uploadButton);

    // Wait a bit to ensure no upload happens
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify no upload was initiated
    expect(mockOnUploadStart).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockOnUploadComplete).not.toHaveBeenCalled();
  });
});
