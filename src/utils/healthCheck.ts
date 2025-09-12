import axios from 'axios';
import { getConfig } from '../config/index.js';
import { getGlobalCache } from './cache.js';
import { getGlobalRateLimiter } from './rateLimiter.js';
import { structuredLogger } from './pinoLogger.js';

/**
 * Health check status
 */
export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  components: {
    api: ComponentHealth;
    cache: ComponentHealth;
    rateLimiter: ComponentHealth;
    config: ComponentHealth;
  };
  metrics?: {
    cacheHitRate?: number;
    rateLimiterTokens?: number;
    uptime?: number;
  };
}

/**
 * Component health status
 */
export interface ComponentHealth {
  name: string;
  healthy: boolean;
  message: string;
  details?: Record<string, any>;
}

/**
 * Health check service for monitoring system status
 */
export class HealthCheckService {
  private readonly logger = structuredLogger.child({ component: 'HealthCheck' });
  private readonly startTime: Date;
  private lastHealthCheck: HealthStatus | null = null;
  
  constructor() {
    this.startTime = new Date();
  }

  /**
   * Perform a comprehensive health check
   * @param detailed Include detailed metrics
   * @returns Health status
   */
  public async check(detailed: boolean = false): Promise<HealthStatus> {
    this.logger.debug('Performing health check');
    
    const components = {
      api: await this.checkAPI(),
      cache: this.checkCache(),
      rateLimiter: this.checkRateLimiter(),
      config: this.checkConfig()
    };
    
    const healthy = Object.values(components).every(c => c.healthy);
    
    const status: HealthStatus = {
      healthy,
      timestamp: new Date(),
      components
    };
    
    if (detailed) {
      status.metrics = this.getMetrics();
    }
    
    this.lastHealthCheck = status;
    
    this.logger.info(
      { healthy, components: Object.keys(components) },
      'Health check completed'
    );
    
    return status;
  }

  /**
   * Get a quick health status (cached if recent)
   * @param maxAge Maximum age of cached result in milliseconds
   * @returns Health status
   */
  public async getStatus(maxAge: number = 60000): Promise<HealthStatus> {
    if (this.lastHealthCheck) {
      const age = Date.now() - this.lastHealthCheck.timestamp.getTime();
      if (age < maxAge) {
        this.logger.debug('Returning cached health status');
        return this.lastHealthCheck;
      }
    }
    
    return this.check();
  }

  /**
   * Check API connectivity
   */
  private async checkAPI(): Promise<ComponentHealth> {
    try {
      const config = getConfig();
      const testUrl = `${config.exa.baseUrl}/health`;
      
      // Try a simple health check endpoint (if available)
      // Otherwise, check if we can reach the API
      const response = await axios.get(testUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      }).catch(() => {
        // If health endpoint doesn't exist, try base URL
        return axios.head(config.exa.baseUrl, {
          timeout: 5000,
          validateStatus: (status) => status < 500
        });
      });
      
      return {
        name: 'Exa API',
        healthy: true,
        message: 'API is reachable',
        details: {
          baseUrl: config.exa.baseUrl,
          responseTime: response.headers['x-response-time']
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        name: 'Exa API',
        healthy: false,
        message: `API unreachable: ${message}`
      };
    }
  }

  /**
   * Check cache system
   */
  private checkCache(): ComponentHealth {
    try {
      const cache = getGlobalCache();
      const stats = cache.getStats();
      
      return {
        name: 'Cache',
        healthy: true,
        message: 'Cache is operational',
        details: {
          enabled: cache.isEnabled(),
          size: stats.size,
          hitRate: `${stats.hitRate.toFixed(2)}%`,
          hits: stats.hits,
          misses: stats.misses
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        name: 'Cache',
        healthy: false,
        message: `Cache error: ${message}`
      };
    }
  }

  /**
   * Check rate limiter
   */
  private checkRateLimiter(): ComponentHealth {
    try {
      const rateLimiter = getGlobalRateLimiter();
      const status = rateLimiter.getStatus();
      
      return {
        name: 'Rate Limiter',
        healthy: true,
        message: 'Rate limiter is operational',
        details: {
          tokensAvailable: status.tokensAvailable,
          maxTokens: status.maxTokens,
          queueLength: status.queueLength,
          timeUntilRefill: `${status.timeUntilRefill}ms`
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        name: 'Rate Limiter',
        healthy: false,
        message: `Rate limiter error: ${message}`
      };
    }
  }

  /**
   * Check configuration
   */
  private checkConfig(): ComponentHealth {
    try {
      const config = getConfig();
      
      // Check critical configuration
      const hasAPIKey = !!config.exa.apiKey && config.exa.apiKey !== 'test-api-key';
      
      if (!hasAPIKey) {
        return {
          name: 'Configuration',
          healthy: false,
          message: 'API key not configured'
        };
      }
      
      return {
        name: 'Configuration',
        healthy: true,
        message: 'Configuration is valid',
        details: {
          environment: config.environment.nodeEnv,
          logLevel: config.logging.level,
          cacheEnabled: config.cache.enabled
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        name: 'Configuration',
        healthy: false,
        message: `Configuration error: ${message}`
      };
    }
  }

  /**
   * Get system metrics
   */
  private getMetrics(): Record<string, any> {
    const uptime = Date.now() - this.startTime.getTime();
    const cache = getGlobalCache();
    const rateLimiter = getGlobalRateLimiter();
    
    return {
      uptime: Math.floor(uptime / 1000), // seconds
      cacheHitRate: cache.getStats().hitRate,
      rateLimiterTokens: rateLimiter.getStatus().tokensAvailable,
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    };
  }

  /**
   * Format health status for display
   */
  public formatStatus(status: HealthStatus): string {
    const lines: string[] = [];
    
    lines.push(`🏥 Health Check - ${status.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
    lines.push(`📅 Timestamp: ${status.timestamp.toISOString()}`);
    lines.push('');
    lines.push('Components:');
    
    for (const [key, component] of Object.entries(status.components)) {
      const icon = component.healthy ? '✅' : '❌';
      lines.push(`  ${icon} ${component.name}: ${component.message}`);
      
      if (component.details) {
        for (const [detailKey, detailValue] of Object.entries(component.details)) {
          lines.push(`     - ${detailKey}: ${detailValue}`);
        }
      }
    }
    
    if (status.metrics) {
      lines.push('');
      lines.push('Metrics:');
      lines.push(`  ⏱️  Uptime: ${status.metrics.uptime} seconds`);
      lines.push(`  📊 Cache Hit Rate: ${status.metrics.cacheHitRate?.toFixed(2)}%`);
      lines.push(`  🎫 Rate Limiter Tokens: ${status.metrics.rateLimiterTokens}`);
    }
    
    return lines.join('\n');
  }
}

/**
 * Global health check service instance
 */
let globalHealthCheck: HealthCheckService | null = null;

/**
 * Get or create the global health check service
 */
export function getHealthCheckService(): HealthCheckService {
  if (!globalHealthCheck) {
    globalHealthCheck = new HealthCheckService();
  }
  return globalHealthCheck;
}

/**
 * Perform a quick health check
 */
export async function checkHealth(detailed: boolean = false): Promise<HealthStatus> {
  const service = getHealthCheckService();
  return service.check(detailed);
}

/**
 * Get formatted health status
 */
export async function getHealthReport(): Promise<string> {
  const service = getHealthCheckService();
  const status = await service.check(true);
  return service.formatStatus(status);
}