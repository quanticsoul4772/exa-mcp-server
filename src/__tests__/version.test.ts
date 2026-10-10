import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SERVER_VERSION } from '../version.js';

describe('SERVER_VERSION', () => {
  it('matches package.json version', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    expect(SERVER_VERSION).toBe(pkg.version);
  });
});
