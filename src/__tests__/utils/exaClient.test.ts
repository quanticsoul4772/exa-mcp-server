import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../config/index.js', () => ({
  getConfig: jest.fn(() => ({
    exa: { 
      apiKey: 'test-api-key', 
      baseUrl: 'https://api.exa.ai', 
      timeout: 25000, 
      retries: 3 
    },
    server: { name: 'test-server', version: '1.0.0' },
    logging: { level: 'ERROR', redactLogs: true },
    environment: { nodeEnv: 'test' },
    cache: { enabled: true, maxSize: 100, ttlMinutes: 5 },
    tools: { defaultNumResults: 5, defaultMaxCharacters: 3000 }
  }))
}));
jest.mock('../../utils/pinoLogger.js');

import { createExaClient } from '../../utils/exaClient.js';

describe('ExaClient', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create = jest.fn().mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    });
  });

  describe('Client Creation', () => {
    it('should create axios client with correct config', () => {
      const client = createExaClient();
      
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.exa.ai',
          timeout: 25000,
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should set up interceptors', () => {
      const client = createExaClient();
      const mockClient = mockedAxios.create();
      
      expect(mockClient.interceptors.request.use).toHaveBeenCalled();
      expect(mockClient.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Request Handling', () => {
    it('should handle successful requests', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: { results: [] } }),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      
      mockedAxios.create = jest.fn().mockReturnValue(mockClient);
      
      const client = createExaClient();
      const response = await client.get('/search');
      
      expect(mockClient.get).toHaveBeenCalledWith('/search');
      expect(response.data).toEqual({ results: [] });
    });

    it('should handle POST requests', async () => {
      const mockClient = {
        get: jest.fn(),
        post: jest.fn().mockResolvedValue({ data: { success: true } }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      
      mockedAxios.create = jest.fn().mockReturnValue(mockClient);
      
      const client = createExaClient();
      const response = await client.post('/api/endpoint', { query: 'test' });
      
      expect(mockClient.post).toHaveBeenCalledWith('/api/endpoint', { query: 'test' });
      expect(response.data).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('Network Error')),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      
      mockedAxios.create = jest.fn().mockReturnValue(mockClient);
      
      const client = createExaClient();
      
      await expect(client.get('/search')).rejects.toThrow('Network Error');
    });

    it('should handle API errors', async () => {
      const apiError = {
        response: {
          status: 400,
          data: { error: 'Bad Request' }
        }
      };
      
      const mockClient = {
        get: jest.fn().mockRejectedValue(apiError),
        post: jest.fn(),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      };
      
      mockedAxios.create = jest.fn().mockReturnValue(mockClient);
      
      const client = createExaClient();
      
      await expect(client.get('/search')).rejects.toMatchObject(apiError);
    });
  });
});