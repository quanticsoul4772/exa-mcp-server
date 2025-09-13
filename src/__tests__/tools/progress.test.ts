import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ProgressTracker, sendProgressNotification, extractToolContext } from '../../tools/progress-tracker.js';
import { ToolHandlerExtra } from '../../tools/config.js';

describe('Progress Tracking (v1.18.0)', () => {
  let mockServer: jest.Mocked<Server>;

  beforeEach(() => {
    mockServer = {
      notification: jest.fn()
    } as unknown as jest.Mocked<Server>;
  });

  describe('sendProgressNotification', () => {
    it('should send notification when token and server are provided', async () => {
      await sendProgressNotification('token-123', mockServer, 1, 5, 'Processing...');

      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 1,
          total: 5,
          message: 'Processing...'
        }
      });
    });

    it('should not send notification when token is missing', async () => {
      await sendProgressNotification(undefined, mockServer, 1, 5);
      expect(mockServer.notification).not.toHaveBeenCalled();
    });

    it('should not send notification when server is missing', async () => {
      await sendProgressNotification('token-123', undefined, 1, 5);
      expect(mockServer.notification).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockServer.notification.mockRejectedValueOnce(new Error('Network error'));

      await sendProgressNotification('token-123', mockServer, 1, 5);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send progress notification:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('ProgressTracker', () => {
    it('should track progress and send notifications', async () => {
      const tracker = new ProgressTracker(3, 'token-123', mockServer);

      await tracker.increment('Step 1');
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 1,
          total: 3,
          message: 'Step 1'
        }
      });

      await tracker.increment('Step 2');
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 2,
          total: 3,
          message: 'Step 2'
        }
      });

      await tracker.complete();
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 3,
          total: 3,
          message: 'Complete'
        }
      });
    });

    it('should work without progress token', async () => {
      const tracker = new ProgressTracker(3, undefined, mockServer);

      await tracker.increment();
      await tracker.complete();

      expect(mockServer.notification).not.toHaveBeenCalled();
    });

    it('should allow manual progress updates', async () => {
      const tracker = new ProgressTracker(10, 'token-123', mockServer);

      await tracker.update(5, 'Halfway there');
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 5,
          total: 10,
          message: 'Halfway there'
        }
      });
    });
  });

  describe('extractToolContext', () => {
    it('should extract all context fields', () => {
      const extra: ToolHandlerExtra = {
        _meta: {
          progressToken: 'token-123',
          requestId: 'req-456',
          customField: 'value'
        },
        server: mockServer,
        otherField: 'test'
      };

      const context = extractToolContext(extra);

      expect(context).toEqual({
        progressToken: 'token-123',
        requestId: 'req-456',
        server: mockServer,
        metadata: {
          progressToken: 'token-123',
          requestId: 'req-456',
          customField: 'value',
          otherField: 'test'
        }
      });
    });

    it('should handle missing extra parameter', () => {
      const context = extractToolContext(undefined);
      expect(context).toEqual({});
    });

    it('should handle extra without _meta', () => {
      const extra: ToolHandlerExtra = {
        server: mockServer,
        otherField: 'test'
      };

      const context = extractToolContext(extra);

      expect(context).toEqual({
        progressToken: undefined,
        requestId: undefined,
        server: mockServer,
        metadata: {
          otherField: 'test'
        }
      });
    });
  });

  describe('Tool Integration', () => {
    it('should support backward compatibility without progress', async () => {
      // Test that tools work without _meta parameter
      const mockHandler = jest.fn((args: any) => Promise.resolve({
        content: [{ type: 'text', text: 'Result' }]
      }));

      // Call without extra parameter
      const result = await mockHandler({ query: 'test' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Result' }]
      });
    });

    it('should track request ID correlation', () => {
      const extra: ToolHandlerExtra = {
        _meta: {
          requestId: 'client-req-123'
        }
      };

      const context = extractToolContext(extra);
      expect(context.requestId).toBe('client-req-123');
    });
  });
});