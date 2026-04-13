import { validateFile, ValidationResult } from './fileValidation';

describe('validateFile', () => {
  // Helper function to create a mock File object
  const createMockFile = (
    name: string,
    type: string,
    size: number
  ): File => {
    const blob = new Blob(['x'.repeat(size)], { type });
    return new File([blob], name, { type });
  };

  describe('valid image files', () => {
    it('should accept valid JPEG file with .jpg extension', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid JPEG file with .jpeg extension', () => {
      const file = createMockFile('test.jpeg', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid PNG file', () => {
      const file = createMockFile('test.png', 'image/png', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid GIF file', () => {
      const file = createMockFile('test.gif', 'image/gif', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid WebP file', () => {
      const file = createMockFile('test.webp', 'image/webp', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid SVG file', () => {
      const file = createMockFile('test.svg', 'image/svg+xml', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept file at maximum size (10MB)', () => {
      const maxSize = 10 * 1024 * 1024;
      const file = createMockFile('test.jpg', 'image/jpeg', maxSize);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept file just under maximum size', () => {
      const size = 10 * 1024 * 1024 - 1;
      const file = createMockFile('test.jpg', 'image/jpeg', size);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('invalid file types', () => {
    it('should reject file with invalid MIME type', () => {
      const file = createMockFile('test.txt', 'text/plain', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select an image file (jpg, png, gif, webp, svg)');
    });

    it('should reject PDF file', () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select an image file (jpg, png, gif, webp, svg)');
    });

    it('should reject file with valid MIME type but invalid extension', () => {
      const file = createMockFile('test.txt', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select an image file (jpg, png, gif, webp, svg)');
    });

    it('should reject file with valid extension but invalid MIME type', () => {
      const file = createMockFile('test.jpg', 'text/plain', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select an image file (jpg, png, gif, webp, svg)');
    });

    it('should reject file with no extension', () => {
      const file = createMockFile('test', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Please select an image file (jpg, png, gif, webp, svg)');
    });

    it('should handle uppercase extensions (case-insensitive)', () => {
      const file = createMockFile('test.JPG', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('file size validation', () => {
    it('should reject file exceeding 10MB limit', () => {
      const size = 10 * 1024 * 1024 + 1;
      const file = createMockFile('test.jpg', 'image/jpeg', size);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image size exceeds 10MB limit');
    });

    it('should reject file significantly over 10MB limit', () => {
      const size = 20 * 1024 * 1024;
      const file = createMockFile('test.jpg', 'image/jpeg', size);
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image size exceeds 10MB limit');
    });
  });

  describe('edge cases', () => {
    it('should accept zero-byte file (empty file)', () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 0);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle file with multiple dots in name', () => {
      const file = createMockFile('test.image.final.jpg', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle file with spaces in name', () => {
      const file = createMockFile('my test image.jpg', 'image/jpeg', 1024);
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
