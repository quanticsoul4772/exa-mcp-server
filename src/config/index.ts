import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables once at module initialization
dotenv.config();

/**
 * Environment configuration schema with strict validation
 */
const configSchema = z.object({
  // Required API configuration
  exa: z.object({
    apiKey: z.string().min(1, 'EXA_API_KEY is required'),
    baseUrl: z.string().url().default('https://api.exa.ai'),
    timeout: z.coerce.number().int().min(1000).max(60000).default(25000),
    retries: z.coerce.number().int().min(0).max(10).default(3)
  }),
  
  // Server configuration
  server: z.object({
    name: z.string().default('exa-search-server'),
    version: z.string().default('0.3.6')
  }),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).default(
      process.env.NODE_ENV === 'production' ? 'ERROR' : 'DEBUG'
    ),
    redactLogs: z.preprocess(
      (val) => val === 'false' ? false : true,
      z.boolean().default(true)
    )
  }),
  
  // Environment settings
  environment: z.object({
    nodeEnv: z.enum(['development', 'test', 'production']).default('development')
  }),
  
  // Tool defaults
  tools: z.object({
    defaultNumResults: z.coerce.number().int().min(1).max(50).default(3),
    defaultMaxCharacters: z.coerce.number().int().min(100).max(10000).default(3000)
  }),
  
  // Cache configuration
  cache: z.object({
    enabled: z.preprocess(
      (val) => val === 'false' ? false : true,
      z.boolean().default(true)
    ),
    maxSize: z.coerce.number().int().min(10).max(1000).default(100),
    ttlMinutes: z.coerce.number().int().min(1).max(60).default(5)
  })
}).strict();

/**
 * Raw environment variable mapping for validation
 */
function createRawConfig() {
  return {
    exa: {
      apiKey: process.env.EXA_API_KEY,
      baseUrl: process.env.EXA_BASE_URL,
      timeout: process.env.EXA_TIMEOUT,
      retries: process.env.EXA_RETRIES
    },
    server: {
      name: process.env.SERVER_NAME,
      version: process.env.SERVER_VERSION
    },
    logging: {
      level: process.env.LOG_LEVEL?.toUpperCase(),
      redactLogs: process.env.REDACT_LOGS
    },
    environment: {
      nodeEnv: process.env.NODE_ENV
    },
    tools: {
      defaultNumResults: process.env.DEFAULT_NUM_RESULTS,
      defaultMaxCharacters: process.env.DEFAULT_MAX_CHARACTERS
    },
    cache: {
      enabled: process.env.CACHE_ENABLED,
      maxSize: process.env.CACHE_MAX_SIZE,
      ttlMinutes: process.env.CACHE_TTL_MINUTES
    }
  };
}

/**
 * Configuration type inferred from schema
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Cached configuration instance
 */
let cachedConfig: Config | null = null;

/**
 * Validates and returns the application configuration
 * Fails fast with detailed error messages on validation failure
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }
  
  try {
    const rawConfig = createRawConfig();
    const validatedConfig = configSchema.parse(rawConfig);
    
    // Freeze the configuration to prevent runtime modifications
    cachedConfig = Object.freeze(validatedConfig) as Config;
    
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('\n❌ Configuration validation failed:');
      console.error('=====================================');
      
      // Group errors by path for better readability
      const errorsByPath = new Map<string, string[]>();
      
      error.errors.forEach(err => {
        const path = err.path.join('.');
        const message = err.message;
        
        if (!errorsByPath.has(path)) {
          errorsByPath.set(path, []);
        }
        errorsByPath.get(path)!.push(message);
      });
      
      // Display grouped errors
      errorsByPath.forEach((messages, path) => {
        console.error(`\n• ${path}:`);
        messages.forEach(msg => console.error(`  - ${msg}`));
      });
      
      console.error('\n📋 Required environment variables:');
      console.error('- EXA_API_KEY: Your Exa AI API key (required)');
      console.error('\n📋 Optional environment variables:');
      console.error('- LOG_LEVEL: ERROR, WARN, INFO, or DEBUG');
      console.error('- REDACT_LOGS: true or false (default: true)');
      console.error('- NODE_ENV: development, test, or production');
      console.error('\n💡 See .env.example for a complete configuration template');
      console.error('=====================================\n');
    } else {
      console.error('❌ Unexpected configuration error:', error);
    }
    
    // In test environment, throw the error instead of exiting
    if (process.env.NODE_ENV === 'test') {
      throw error;
    }
    
    process.exit(1);
  }
}

/**
 * Validates configuration without caching (useful for testing)
 */
export function validateConfig(rawConfig?: Record<string, any>): Config {
  const configToValidate = rawConfig || createRawConfig();
  return configSchema.parse(configToValidate);
}

/**
 * Clears the cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Returns a sanitized version of the config for logging (secrets redacted)
 */
export function getSanitizedConfig(): Record<string, any> {
  const config = getConfig();
  
  return {
    ...config,
    exa: {
      ...config.exa,
      apiKey: config.exa.apiKey ? '[REDACTED]' : undefined
    }
  };
}
