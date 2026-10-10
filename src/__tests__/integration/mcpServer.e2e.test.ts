import { describe, it, expect, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { ProgressTracker, extractToolContext } from '../../tools/progress-tracker.js';
import { ToolHandlerExtra } from '../../tools/config.js';

/**
 * Runs a real McpServer and Client over an in-memory transport, so these
 * tests exercise the SDK's actual handler context (no hand-made mocks).
 */
type ToolCallback = (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: 'text'; text: string }[] }>;

/** server.tool with the SDK's deep generic types bypassed (same as src/index.ts) */
function addTool(server: McpServer, name: string, shape: Record<string, z.ZodTypeAny>, cb: ToolCallback) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.tool as any).call(server, name, 'test tool', shape, cb);
}

async function connect(register: (server: McpServer) => void) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  register(server);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe('Real MCP server handler context', () => {
  it('delivers progress notifications to the client', async () => {
    const { client } = await connect(server => {
      addTool(server, 'slow', { n: z.number() }, async (_args, extra) => {
        const context = extractToolContext(extra as unknown as ToolHandlerExtra);
        const tracker = new ProgressTracker(2, context.progressToken, context.sendNotification);
        await tracker.increment('half');
        await tracker.complete('done');
        return { content: [{ type: 'text' as const, text: 'ok' }] };
      });
    });

    const onprogress = jest.fn();
    const result = await client.callTool({ name: 'slow', arguments: { n: 1 } }, undefined, { onprogress });

    expect(result.content).toEqual([{ type: 'text', text: 'ok' }]);
    expect(onprogress).toHaveBeenCalledWith(expect.objectContaining({ progress: 1, total: 2, message: 'half' }));
    expect(onprogress).toHaveBeenCalledWith(expect.objectContaining({ progress: 2, total: 2, message: 'done' }));
  });

  it('aborts the handler signal when the client cancels', async () => {
    let aborted: Promise<boolean> = Promise.resolve(false);
    const { client } = await connect(server => {
      addTool(server, 'wait', {}, async (_args, extra) => {
        const { signal } = extractToolContext(extra as unknown as ToolHandlerExtra);
        aborted = new Promise(resolve => signal?.addEventListener('abort', () => resolve(true)));
        await aborted;
        return { content: [{ type: 'text' as const, text: 'cancelled' }] };
      });
    });

    const controller = new AbortController();
    const call = client.callTool({ name: 'wait', arguments: {} }, undefined, { signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 20));
    controller.abort('user cancelled');

    await expect(call).rejects.toThrow();
    await expect(aborted).resolves.toBe(true);
  });
});
