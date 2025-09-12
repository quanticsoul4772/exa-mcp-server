import { describe, it, expect, beforeEach } from '@jest/globals';
import { URLValidator, URLValidationError, getGlobalURLValidator, resetGlobalURLValidator } from '../../utils/urlValidator.js';

// Mock pinoLogger
jest.mock('../../utils/pinoLogger.js', () => ({
  structuredLogger: {
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  }
}));

describe('URLValidator', () => {
  let validator: URLValidator;

  beforeEach(() => {
    validator = new URLValidator();
    resetGlobalURLValidator();
  });

  describe('Basic validation', () => {
    it('should accept valid HTTPS URLs', () => {
      const url = validator.validate('https://example.com');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('example.com');
    });

    it('should accept valid HTTP URLs', () => {
      const url = validator.validate('http://example.com');
      expect(url.protocol).toBe('http:');
    });

    it('should reject invalid URL formats', () => {
      expect(() => validator.validate('not-a-url')).toThrow(URLValidationError);
      expect(() => validator.validate('javascript:alert(1)')).toThrow(URLValidationError);
    });

    it('should reject non-allowed protocols', () => {
      expect(() => validator.validate('ftp://example.com')).toThrow(URLValidationError);
      expect(() => validator.validate('file:///etc/passwd')).toThrow(URLValidationError);
      expect(() => validator.validate('gopher://example.com')).toThrow(URLValidationError);
    });
  });

  describe('Localhost protection', () => {
    it('should reject localhost URLs by default', () => {
      expect(() => validator.validate('http://localhost')).toThrow(URLValidationError);
      expect(() => validator.validate('http://127.0.0.1')).toThrow(URLValidationError);
      expect(() => validator.validate('http://0.0.0.0')).toThrow(URLValidationError);
    });

    it('should allow localhost when configured', () => {
      const permissiveValidator = new URLValidator({ allowLocalhost: true, allowPrivateIPs: true });
      expect(() => permissiveValidator.validate('http://localhost')).not.toThrow();
      expect(() => permissiveValidator.validate('http://127.0.0.1')).not.toThrow();
    });
  });

  describe('Private IP protection', () => {
    it('should reject private IPs by default', () => {
      expect(() => validator.validate('http://10.0.0.1')).toThrow(URLValidationError);
      expect(() => validator.validate('http://192.168.1.1')).toThrow(URLValidationError);
      expect(() => validator.validate('http://172.16.0.1')).toThrow(URLValidationError);
      expect(() => validator.validate('http://169.254.1.1')).toThrow(URLValidationError);
    });

    it('should allow private IPs when configured', () => {
      const permissiveValidator = new URLValidator({ allowPrivateIPs: true });
      expect(() => permissiveValidator.validate('http://10.0.0.1')).not.toThrow();
      expect(() => permissiveValidator.validate('http://192.168.1.1')).not.toThrow();
    });
  });

  describe('Domain filtering', () => {
    it('should respect domain allowlist', () => {
      const restrictedValidator = new URLValidator({
        allowedDomains: ['example.com', 'trusted.org']
      });

      expect(() => restrictedValidator.validate('https://example.com')).not.toThrow();
      expect(() => restrictedValidator.validate('https://api.example.com')).not.toThrow();
      expect(() => restrictedValidator.validate('https://trusted.org')).not.toThrow();
      expect(() => restrictedValidator.validate('https://untrusted.com')).toThrow(URLValidationError);
    });

    it('should respect domain blocklist', () => {
      const blockedValidator = new URLValidator({
        blockedDomains: ['evil.com', 'malware.org']
      });

      expect(() => blockedValidator.validate('https://example.com')).not.toThrow();
      expect(() => blockedValidator.validate('https://evil.com')).toThrow(URLValidationError);
      expect(() => blockedValidator.validate('https://sub.evil.com')).toThrow(URLValidationError);
      expect(() => blockedValidator.validate('https://malware.org')).toThrow(URLValidationError);
    });
  });

  describe('Suspicious patterns', () => {
    it('should reject URLs with suspicious patterns', () => {
      expect(() => validator.validate('http://example.com/<script>')).toThrow(URLValidationError);
      expect(() => validator.validate('http://example.com/../../etc/passwd')).toThrow(URLValidationError);
      expect(() => validator.validate('data:text/html,<script>alert(1)</script>')).toThrow(URLValidationError);
    });
  });

  describe('URL sanitization', () => {
    it('should sanitize URLs by removing credentials', () => {
      const sanitized = validator.sanitize('https://user:pass@example.com/path#hash');
      expect(sanitized).toBe('https://example.com/path');
      expect(sanitized).not.toContain('user');
      expect(sanitized).not.toContain('pass');
      expect(sanitized).not.toContain('#hash');
    });

    it('should sanitize valid URLs only', () => {
      expect(() => validator.sanitize('not-a-url')).toThrow(URLValidationError);
    });
  });

  describe('Batch validation', () => {
    it('should validate multiple URLs', () => {
      const urls = [
        'https://example.com',
        'http://invalid<script>',
        'https://google.com',
        'ftp://files.com'
      ];

      const results = validator.validateBatch(urls);

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
      expect(results[3].valid).toBe(false);
    });
  });

  describe('Global validator', () => {
    it('should create and return singleton instance', () => {
      const validator1 = getGlobalURLValidator();
      const validator2 = getGlobalURLValidator();
      
      expect(validator1).toBe(validator2);
    });

    it('should reset global instance', () => {
      const validator1 = getGlobalURLValidator();
      resetGlobalURLValidator();
      const validator2 = getGlobalURLValidator();
      
      expect(validator1).not.toBe(validator2);
    });
  });
});