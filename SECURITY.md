# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✅ Yes     |
| 0.2.x   | ❌ No      |
| 0.1.x   | ❌ No      |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it by emailing russell@exa.ai.

Please do not create public GitHub issues for security vulnerabilities.

## Security Considerations

### API Key Management

- Never commit API keys to version control
- Use environment variables for API key storage
- Rotate API keys regularly
- Use the minimum required permissions for API keys

### Input Validation

- All tool parameters are validated using Zod schemas
- URLs are validated using Zod's `.url()` validator
- Numeric inputs are coerced and validated
- String inputs are sanitized

### Data Handling

- No user data is stored by the server
- All requests are processed in memory
- Responses are formatted for Claude UI compatibility
- No caching of sensitive information

### Network Security

- HTTPS is used for all API communications
- Connection timeouts are implemented
- Rate limiting is handled by the Exa API
- Error messages do not expose sensitive information

### Environment Variables

Required:
- `EXA_API_KEY`: Your Exa API key (keep secret)

Optional:
- `DEBUG`: Enable debug logging (should be disabled in production)

## Best Practices

1. Use environment variables for sensitive configuration
2. Regularly update dependencies
3. Monitor API usage and rate limits
4. Implement proper error handling in client applications
5. Use the latest stable version of the server

## Dependencies

This project regularly updates dependencies to address security vulnerabilities. We use npm audit to identify and fix vulnerabilities.

## Contact

For security-related questions or concerns, please contact russell@exa.ai.