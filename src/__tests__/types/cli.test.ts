import { CLIArguments } from '../../types/cli.js';

describe('CLIArguments', () => {
  it('should have correct type structure', () => {
    const validArgs: CLIArguments = {
      tools: 'exa_search,research_paper_search',
      'list-tools': false,
      _: ['arg1', 123],
      $0: 'exa-mcp-server',
    };

    // Type checking is done at compile time, so if this compiles, our types are correct
    expect(validArgs.tools).toBe('exa_search,research_paper_search');
    expect(validArgs['list-tools']).toBe(false);
    expect(validArgs._).toEqual(['arg1', 123]);
    expect(validArgs.$0).toBe('exa-mcp-server');
  });
});
