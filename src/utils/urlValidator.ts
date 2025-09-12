import { URL } from 'url';
import { structuredLogger } from './pinoLogger.js';

/**
 * URL validation configuration
 */
export interface URLValidationConfig {
  allowedProtocols?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowPrivateIPs?: boolean;
  allowLocalhost?: boolean;
  maxRedirects?: number;
}

/**
 * Default configuration for URL validation
 */
const DEFAULT_CONFIG: Required<URLValidationConfig> = {
  allowedProtocols: ['http', 'https'],
  allowedDomains: [],
  blockedDomains: [],
  allowPrivateIPs: false,
  allowLocalhost: false,
  maxRedirects: 5
};

/**
 * URL validation error
 */
export class URLValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'URLValidationError';
  }
}

/**
 * URL validator for SSRF protection
 */
export class URLValidator {
  private readonly config: Required<URLValidationConfig>;
  private readonly logger = structuredLogger.child({ component: 'URLValidator' });
  
  // Private IP ranges (RFC 1918)
  private readonly privateIPRanges = [
    /^10\./,                     // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,               // 192.168.0.0/16
    /^127\./,                    // 127.0.0.0/8 (loopback)
    /^169\.254\./,               // 169.254.0.0/16 (link-local)
    /^::1$/,                     // IPv6 loopback
    /^fe80:/i,                   // IPv6 link-local
    /^fc00:/i,                   // IPv6 unique local
    /^fd00:/i                    // IPv6 unique local
  ];
  
  // Localhost patterns
  private readonly localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0',
    'host.docker.internal'
  ];

  constructor(config: URLValidationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.logger.info({
      allowedProtocols: this.config.allowedProtocols,
      allowPrivateIPs: this.config.allowPrivateIPs,
      allowLocalhost: this.config.allowLocalhost
    }, 'URL validator initialized');
  }

  /**
   * Validate a URL for safety
   * @param urlString The URL to validate
   * @returns The validated URL object
   * @throws URLValidationError if validation fails
   */
  public validate(urlString: string): URL {
    let url: URL;
    
    // Parse URL
    try {
      url = new URL(urlString);
    } catch (error) {
      this.logger.warn({ url: urlString }, 'Invalid URL format');
      throw new URLValidationError(`Invalid URL format: ${urlString}`);
    }

    // Check protocol
    if (!this.isProtocolAllowed(url.protocol)) {
      this.logger.warn({ 
        url: urlString, 
        protocol: url.protocol 
      }, 'Protocol not allowed');
      throw new URLValidationError(
        `Protocol '${url.protocol}' not allowed. Allowed protocols: ${this.config.allowedProtocols.join(', ')}`
      );
    }

    // Check domain whitelist/blacklist
    if (!this.isDomainAllowed(url.hostname)) {
      this.logger.warn({ 
        url: urlString, 
        hostname: url.hostname 
      }, 'Domain not allowed');
      throw new URLValidationError(`Domain '${url.hostname}' is not allowed`);
    }

    // Check for localhost
    if (!this.config.allowLocalhost && this.isLocalhost(url.hostname)) {
      this.logger.warn({ 
        url: urlString, 
        hostname: url.hostname 
      }, 'Localhost URLs not allowed');
      throw new URLValidationError('Localhost URLs are not allowed');
    }

    // Check for private IPs
    if (!this.config.allowPrivateIPs && this.isPrivateIP(url.hostname)) {
      this.logger.warn({ 
        url: urlString, 
        hostname: url.hostname 
      }, 'Private IP addresses not allowed');
      throw new URLValidationError('Private IP addresses are not allowed');
    }

    // Check for suspicious patterns
    if (this.hasSuspiciousPatterns(urlString)) {
      this.logger.warn({ url: urlString }, 'URL contains suspicious patterns');
      throw new URLValidationError('URL contains suspicious patterns');
    }

    this.logger.debug({ url: urlString }, 'URL validated successfully');
    return url;
  }

  /**
   * Validate multiple URLs
   * @param urls Array of URLs to validate
   * @returns Array of validation results
   */
  public validateBatch(urls: string[]): Array<{ url: string; valid: boolean; error?: string }> {
    return urls.map(url => {
      try {
        this.validate(url);
        return { url, valid: true };
      } catch (error) {
        return { 
          url, 
          valid: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    });
  }

  /**
   * Sanitize a URL by removing potentially dangerous elements
   * @param urlString The URL to sanitize
   * @returns Sanitized URL string
   */
  public sanitize(urlString: string): string {
    try {
      const url = new URL(urlString);
      
      // Remove credentials
      url.username = '';
      url.password = '';
      
      // Remove hash (could contain sensitive data)
      url.hash = '';
      
      // Normalize the URL
      return url.toString();
    } catch {
      throw new URLValidationError(`Cannot sanitize invalid URL: ${urlString}`);
    }
  }

  /**
   * Check if protocol is allowed
   */
  private isProtocolAllowed(protocol: string): boolean {
    const normalizedProtocol = protocol.replace(':', '').toLowerCase();
    return this.config.allowedProtocols.includes(normalizedProtocol);
  }

  /**
   * Check if domain is allowed
   */
  private isDomainAllowed(hostname: string): boolean {
    const lowercaseHostname = hostname.toLowerCase();
    
    // Check blocklist first
    if (this.config.blockedDomains.length > 0) {
      for (const blocked of this.config.blockedDomains) {
        if (lowercaseHostname === blocked || lowercaseHostname.endsWith(`.${blocked}`)) {
          return false;
        }
      }
    }
    
    // Check allowlist if configured
    if (this.config.allowedDomains.length > 0) {
      for (const allowed of this.config.allowedDomains) {
        if (lowercaseHostname === allowed || lowercaseHostname.endsWith(`.${allowed}`)) {
          return true;
        }
      }
      return false; // Not in allowlist
    }
    
    return true; // No allowlist configured, allow all (except blocked)
  }

  /**
   * Check if hostname is localhost
   */
  private isLocalhost(hostname: string): boolean {
    const lowercaseHostname = hostname.toLowerCase();
    // Remove brackets from IPv6 addresses
    const cleanHostname = lowercaseHostname.replace(/^\[(.+)\]$/, '$1');
    return this.localhostPatterns.includes(cleanHostname);
  }

  /**
   * Check if hostname is a private IP
   */
  private isPrivateIP(hostname: string): boolean {
    // Skip if not an IP address
    if (!/^[\d.:]+$/.test(hostname)) {
      return false;
    }
    
    // Check against private IP ranges
    return this.privateIPRanges.some(pattern => pattern.test(hostname));
  }

  /**
   * Check for suspicious patterns in URL
   */
  private hasSuspiciousPatterns(urlString: string): boolean {
    const suspiciousPatterns = [
      /^javascript:/i,          // JavaScript protocol (at start)
      /^data:text\/html/i,      // Data URLs with HTML (at start)
      /^vbscript:/i,           // VBScript protocol (at start)
      /^file:\/\//i,           // File protocol (at start)
      /\x00/,                  // Null bytes
      /[<>]/,                  // HTML tags
      /%00/,                   // URL-encoded null bytes
      /\.\.\//                 // Directory traversal
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(urlString));
  }
}

/**
 * Global URL validator instance
 */
let globalValidator: URLValidator | null = null;

/**
 * Get or create the global URL validator
 * @param config Optional configuration (used on first call)
 */
export function getGlobalURLValidator(config?: URLValidationConfig): URLValidator {
  if (!globalValidator) {
    globalValidator = new URLValidator(config);
  }
  return globalValidator;
}

/**
 * Reset the global URL validator
 */
export function resetGlobalURLValidator(): void {
  globalValidator = null;
}

/**
 * Middleware to validate URLs in tool inputs
 */
export function validateURLInput(url: string, config?: URLValidationConfig): string {
  const validator = getGlobalURLValidator(config);
  const validatedURL = validator.validate(url);
  return validator.sanitize(validatedURL.toString());
}