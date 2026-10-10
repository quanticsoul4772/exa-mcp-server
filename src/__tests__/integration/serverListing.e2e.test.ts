import { describe, it, expect } from '@jest/globals';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../server.js';
import { SERVER_INSTRUCTIONS } from '../../instructions.js';
import { toolRegistry } from '../../tools/index.js';

async function connect(tools: string[]) {
  const { server, registered } = buildServer(new Set(tools));
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, registered };
}

describe('what MCP clients see', () => {
  it('registers the default tools when none are specified', async () => {
    const { registered } = await connect([]);
    const defaults = Object.values(toolRegistry).filter(t => t.enabled).map(t => t.name);
    expect(registered).toEqual(defaults);
  });

  it('sends server instructions', async () => {
    const { client } = await connect([]);
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
  });

  it('lists every tool with a title and behavior hints', async () => {
    const all = Object.keys(toolRegistry);
    const { client } = await connect(all);
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));

    expect(Object.keys(byName).sort()).toEqual([...all].sort());
    for (const t of tools) {
      expect(t.title).toBeTruthy();
    }
    for (const name of ['exa_search', 'web_fetch', 'answer_question', 'find_similar', 'code_search']) {
      expect(byName[name].annotations).toEqual({ readOnlyHint: true, openWorldHint: true });
    }
    expect(byName.agent_run.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    expect(byName.monitors.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(byName.websets.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it('exposes each tool input schema', async () => {
    const { client } = await connect(['web_fetch']);
    const { tools } = await client.listTools();
    expect(tools[0].inputSchema.required).toEqual(['urls']);
  });
});
