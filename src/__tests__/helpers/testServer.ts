import express, { Express, Request, Response } from 'express';
import { Server } from 'http';

interface MockResponse {
  status: number;
  data: any;
  delay?: number;
}

interface MockEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  response: MockResponse | ((req: Request) => MockResponse);
}

/**
 * Test server for E2E testing
 */
export class TestServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private requestLog: Array<{ method: string; path: string; body: any; headers: any }> = [];

  constructor(port: number = 0) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    
    // Log all requests
    this.app.use((req, res, next) => {
      this.requestLog.push({
        method: req.method,
        path: req.path,
        body: req.body,
        headers: req.headers
      });
      next();
    });

    // Handle mocked endpoints
    this.app.use((req, res) => {
      const key = `${req.method}:${req.path}`;
      const endpoint = this.endpoints.get(key);

      if (!endpoint) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const response = typeof endpoint.response === 'function' 
        ? endpoint.response(req)
        : endpoint.response;

      // Simulate delay if specified
      const sendResponse = () => {
        res.status(response.status).json(response.data);
      };

      if (response.delay) {
        setTimeout(sendResponse, response.delay);
      } else {
        sendResponse();
      }
    });
  }

  /**
   * Mock an endpoint
   */
  public mock(method: MockEndpoint['method'], path: string, response: MockResponse | ((req: Request) => MockResponse)): void {
    const key = `${method}:${path}`;
    this.endpoints.set(key, { method, path, response });
  }

  /**
   * Mock POST /search endpoint for Exa API
   */
  public mockExaSearch(response: any, status: number = 200): void {
    this.mock('POST', '/search', {
      status,
      data: response
    });
  }

  /**
   * Mock POST /contents endpoint for Exa API
   */
  public mockExaContents(response: any, status: number = 200): void {
    this.mock('POST', '/contents', {
      status,
      data: response
    });
  }

  /**
   * Start the test server
   */
  public async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        const actualPort = (this.server!.address() as any).port;
        this.port = actualPort;
        resolve(actualPort);
      });
    });
  }

  /**
   * Stop the test server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the server URL
   */
  public getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Clear all mocks and request log
   */
  public clear(): void {
    this.endpoints.clear();
    this.requestLog = [];
  }

  /**
   * Get request log
   */
  public getRequestLog(): typeof this.requestLog {
    return [...this.requestLog];
  }

  /**
   * Get requests by path
   */
  public getRequestsByPath(path: string): typeof this.requestLog {
    return this.requestLog.filter(r => r.path === path);
  }

  /**
   * Assert request was made
   */
  public assertRequestMade(method: string, path: string, times: number = 1): void {
    const requests = this.requestLog.filter(r => r.method === method && r.path === path);
    if (requests.length !== times) {
      throw new Error(`Expected ${times} ${method} requests to ${path}, but got ${requests.length}`);
    }
  }
}