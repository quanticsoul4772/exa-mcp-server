import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProgressTracker, sendProgressNotification, extractToolContext } from '../../tools/progress-tracker.js';
import { ToolHandlerExtra } from '../../tools/config.js';

type Sender = NonNullable<ToolHandlerExtra['sendNotification']>;

describe('Progress tracking', () => {
  let send: jest.MockedFunction<Sender>;

  beforeEach(() => {
    send = jest.fn<Sender>().mockResolvedValue(undefined);
  });

  describe('sendProgressNotification', () => {
    it('sends notifications/progress with token, progress, total and message', async () => {
      await sendProgressNotification('token-123', send, 1, 5, 'Processing...');
      expect(send).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: { progressToken: 'token-123', progress: 1, total: 5, message: 'Processing...' }
      });
    });

    it('accepts a numeric token, including 0', async () => {
      await sendProgressNotification(0, send, 1, 2);
      expect(send).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: { progressToken: 0, progress: 1, total: 2 }
      });
    });

    it('does nothing without a token', async () => {
      await sendProgressNotification(undefined, send, 1, 5);
      expect(send).not.toHaveBeenCalled();
    });

    it('does nothing without a sender', async () => {
      await expect(sendProgressNotification('token-123', undefined, 1, 5)).resolves.toBeUndefined();
    });

    it('does not throw when sending fails', async () => {
      send.mockRejectedValueOnce(new Error('Network error'));
      await expect(sendProgressNotification('token-123', send, 1, 5)).resolves.toBeUndefined();
    });
  });

  describe('ProgressTracker', () => {
    it('increments, updates and completes', async () => {
      const tracker = new ProgressTracker(3, 'token-123', send);
      await tracker.increment('Step 1');
      await tracker.update(2, 'Step 2');
      await tracker.complete();

      const params = send.mock.calls.map(c => c[0].params);
      expect(params).toEqual([
        { progressToken: 'token-123', progress: 1, total: 3, message: 'Step 1' },
        { progressToken: 'token-123', progress: 2, total: 3, message: 'Step 2' },
        { progressToken: 'token-123', progress: 3, total: 3, message: 'Complete' }
      ]);
    });
  });

  describe('extractToolContext', () => {
    it('reads progress token, request id, signal and sender from the SDK extra', () => {
      const controller = new AbortController();
      const context = extractToolContext({
        _meta: { progressToken: 7 },
        requestId: 42,
        signal: controller.signal,
        sendNotification: send
      });
      expect(context).toEqual({
        progressToken: 7,
        requestId: '42',
        signal: controller.signal,
        sendNotification: send
      });
    });

    it('returns an empty context without extra', () => {
      expect(extractToolContext(undefined)).toEqual({});
    });
  });
});
