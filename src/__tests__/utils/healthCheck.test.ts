import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { AxiosStatic } from 'axios';

// Mock all dependencies before any imports
jest.mock('axios');
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

jest.mock('../../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    exa: {
      apiKey: 'test-key',
      baseUrl: 'https://api.exa.ai',
      timeout: 5000,
      retries: 3
    },
    cache: {
      enabled: true,
      maxSize: 100,
      ttlMinutes: 5
    },
    logging: {
      level: 'ERROR',
      redactLogs: true
    },
    environment: {
      nodeEnv: 'test'
    },
    server: {
      name: 'exa-mcp-server',
      version: '1.0.0'
    }
  }))
}));

jest.mock('../../utils/cache.js', () => ({
  getGlobalCache: jest.fn(() => ({
    getStats: jest.fn(() => ({
      hits: 50,
      misses: 50,
      size: 25,
      hitRate: 50
    })),
    isEnabled: jest.fn(() => true)
  }))
}));

jest.mock('../../utils/rateLimiter.js', () => ({
  getGlobalRateLimiter: jest.fn(() => ({
    getStatus: jest.fn(() => ({
      tokensAvailable: 10,
      maxTokens: 20,
      queueLength: 0,
      timeUntilRefill: 1000
    }))
  }))
}));

// Import modules after mocks are set up
import axios from 'axios';
import { getConfig } from '../../config/index.js';
import { getGlobalCache } from '../../utils/cache.js';
import { getGlobalRateLimiter } from '../../utils/rateLimiter.js';
import { 
  HealthCheckService, 
  getHealthCheckService, 
  checkHealth,
  getHealthReport,
  resetHealthCheckService
} from '../../utils/healthCheck.js';

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  const mockedAxios = axios as jest.Mocked<AxiosStatic>;
  const mockedGetConfig = getConfig as jest.Mock;
  const mockedGetGlobalCache = getGlobalCache as jest.Mock;
  const mockedGetGlobalRateLimiter = getGlobalRateLimiter as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    resetHealthCheckService(); // Reset global instance
    service = new HealthCheckService();
  });

  afterEach(() => {
    jest.resetAllMocks();
    resetHealthCheckService(); // Clean up global instance
  });

  describe('Basic Health Check', () => {
    it('should perform basic health check', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {}
      } as any);

      const status = await service.check();

      expect(status.healthy).toBe(true);
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.components).toBeDefined();
      expect(status.components.api).toBeDefined();
      expect(status.components.cache).toBeDefined();
      expect(status.components.rateLimiter).toBeDefined();
      expect(status.components.config).toBeDefined();
    });

    it('should return detailed health status', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: { 'x-response-time': '100ms' }
      } as any);

      const status = await service.check(true);

      expect(status.healthy).toBe(true);
      expect(status.metrics).toBeDefined();
      expect(status.metrics?.cacheHitRate).toBe(50);
      expect(status.metrics?.rateLimiterTokens).toBe(10);
      expect(status.metrics?.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Component Health Checks', () => {
    it('should check API connectivity successfully', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        headers: {}
      } as any);

      const status = await service.check();

      expect(status.components.api.healthy).toBe(true);
      expect(status.components.api.name).toBe('Exa API');
      expect(status.components.api.message).toBe('API is reachable');
    });

    it('should handle API connectivity failure', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));
      mockedAxios.head.mockRejectedValueOnce(new Error('Connection refused'));

      const status = await service.check();

      expect(status.components.api.healthy).toBe(false);
      expect(status.components.api.message).toContain('API unreachable');
      expect(status.healthy).toBe(false);
    });

    it('should check cache health', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.cache.healthy).toBe(true);
      expect(status.components.cache.name).toBe('Cache');
      expect(status.components.cache.details?.enabled).toBe(true);
      expect(status.components.cache.details?.hitRate).toBe('50.00%');
    });

    it('should check rate limiter health', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.rateLimiter.healthy).toBe(true);
      expect(status.components.rateLimiter.name).toBe('Rate Limiter');
      expect(status.components.rateLimiter.details?.tokensAvailable).toBe(10);
      expect(status.components.rateLimiter.details?.maxTokens).toBe(20);
    });

    it('should check configuration health', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.config.healthy).toBe(true);
      expect(status.components.config.name).toBe('Configuration');
      expect(status.components.config.message).toBe('Configuration is valid');
    });

    it('should detect missing API key', async () => {
      mockedGetConfig.mockReturnValueOnce({
        exa: {
          apiKey: '',
          baseUrl: 'https://api.exa.ai',
          timeout: 5000,
          retries: 3
        },
        cache: { enabled: true, maxSize: 100, ttlMinutes: 5 },
        logging: { level: 'ERROR', redactLogs: true },
        environment: { nodeEnv: 'test' },
        server: { name: 'exa-mcp-server', version: '1.0.0' }
      });

      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.config.healthy).toBe(false);
      expect(status.components.config.message).toBe('API key not configured');
    });
  });

  describe('Status Caching', () => {
    it('should cache recent health status', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      // First call - should hit API
      const status1 = await service.getStatus(60000);
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Second call within cache time - should use cache
      const status2 = await service.getStatus(60000);
      expect(axios.get).toHaveBeenCalledTimes(1);

      expect(status1.timestamp).toEqual(status2.timestamp);
    });

    it('should refresh status when cache expires', async () => {
      mockedAxios.get.mockResolvedValue({ status: 200, headers: {} } as any);

      // First call
      await service.getStatus(0); // 0ms cache time
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Second call - should hit API again
      await service.getStatus(0);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Health Report Formatting', () => {
    it('should format health status correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check(true);
      const report = service.formatStatus(status);

      expect(report).toContain('Health Check');
      expect(report).toContain('HEALTHY');
      expect(report).toContain('Components:');
      expect(report).toContain('Exa API');
      expect(report).toContain('Cache');
      expect(report).toContain('Rate Limiter');
      expect(report).toContain('Configuration');
    });

    it('should format unhealthy status', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Failed'));
      mockedAxios.head.mockRejectedValueOnce(new Error('Failed'));

      const status = await service.check();
      const report = service.formatStatus(status);

      expect(report).toContain('UNHEALTHY');
      expect(report).toContain('❌');
    });

    it('should include metrics in detailed report', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check(true);
      const report = service.formatStatus(status);

      expect(report).toContain('Metrics:');
      expect(report).toContain('Uptime:');
      expect(report).toContain('Cache Hit Rate:');
      expect(report).toContain('Rate Limiter Tokens:');
    });
  });

  describe('Global Functions', () => {
    it('should get global health check service', () => {
      const service1 = getHealthCheckService();
      const service2 = getHealthCheckService();

      expect(service1).toBe(service2);
    });

    it('should perform quick health check', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await checkHealth();

      expect(status.healthy).toBe(true);
      expect(status.components).toBeDefined();
    });

    it('should get formatted health report', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const report = await getHealthReport();

      expect(report).toContain('Health Check');
      expect(report).toContain('Components:');
      expect(report).toContain('Metrics:');
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      mockedGetGlobalCache.mockImplementationOnce(() => {
        throw new Error('Cache error');
      });

      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.cache.healthy).toBe(false);
      expect(status.components.cache.message).toContain('Cache error');
    });

    it('should handle rate limiter errors gracefully', async () => {
      mockedGetGlobalRateLimiter.mockImplementationOnce(() => {
        throw new Error('Rate limiter error');
      });

      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.rateLimiter.healthy).toBe(false);
      expect(status.components.rateLimiter.message).toContain('Rate limiter error');
    });

    it('should handle config errors gracefully', async () => {
      mockedGetConfig.mockImplementationOnce(() => {
        throw new Error('Config error');
      });

      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      const status = await service.check();

      expect(status.components.config.healthy).toBe(false);
      expect(status.components.config.message).toContain('Config error');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect system metrics', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200, headers: {} } as any);

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 50 * 1024 * 1024,
        heapUsed: 30 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 1 * 1024 * 1024
      });

      const status = await service.check(true);

      expect(status.metrics).toBeDefined();
      // Memory usage is added in getMetrics() but not exposed in the interface

      jest.restoreAllMocks();
    });
  });
});