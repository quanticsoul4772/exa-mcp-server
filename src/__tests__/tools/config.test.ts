import { toolRegistry, API_CONFIG } from '../../tools/config.js';

describe('Tool Configuration', () => {
  describe('API_CONFIG', () => {
    it('should have correct configuration values', () => {
      expect(API_CONFIG.BASE_URL).toBe('https://api.exa.ai');
      expect(API_CONFIG.ENDPOINTS.SEARCH).toBe('/search');
      expect(API_CONFIG.DEFAULT_NUM_RESULTS).toBe(3);
      expect(API_CONFIG.DEFAULT_MAX_CHARACTERS).toBe(3000);
    });
  });

  describe('toolRegistry', () => {
    it('should be an object', () => {
      expect(typeof toolRegistry).toBe('object');
      expect(toolRegistry).not.toBeNull();
    });

    it('should have tools registered after imports', async () => {
      // Import the index to ensure tools are registered
      await import('../../tools/index.js');
      expect(Object.keys(toolRegistry).length).toBeGreaterThan(0);
    });
  });

  describe('ToolRegistry interface', () => {
    it('should have proper structure for registered tools', async () => {
      // Import to register tools
      await import('../../tools/index.js');
      
      Object.values(toolRegistry).forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('schema');
        expect(tool).toHaveProperty('handler');
        expect(tool).toHaveProperty('enabled');
        
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.handler).toBe('function');
        expect(typeof tool.enabled).toBe('boolean');
      });
    });
  });
});
