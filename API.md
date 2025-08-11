# API Documentation

## Base Configuration

### URL
```
https://api.exa.ai
```

### Authentication
All requests require an API key:
```
x-api-key: YOUR_EXA_API_KEY
```

## Endpoints

### Search Endpoint

`POST /search`

#### Request Body

```json
{
  "query": "string",
  "type": "auto | keyword | neural",
  "category": "string (optional)",
  "numResults": 10,
  "includeDomains": ["array of domains (optional)"],
  "excludeDomains": ["array of domains (optional)"],
  "startPublishedDate": "ISO date string (optional)",
  "endPublishedDate": "ISO date string (optional)",
  "contents": {
    "text": {
      "maxCharacters": 3000
    },
    "livecrawl": "always | fallback | never"
  }
}
```

#### Response

```json
{
  "results": [
    {
      "url": "string",
      "title": "string",
      "publishedDate": "ISO date string",
      "author": "string (optional)",
      "text": "string"
    }
  ]
}
```

## Tool-Specific Requests

### Web Search

```json
{
  "query": "machine learning",
  "type": "auto",
  "numResults": 5,
  "contents": {
    "text": {
      "maxCharacters": 3000
    },
    "livecrawl": "always"
  }
}
```

### Research Papers

```json
{
  "query": "neural networks",
  "category": "research paper",
  "type": "auto",
  "numResults": 5,
  "contents": {
    "text": {
      "maxCharacters": 3000
    },
    "livecrawl": "fallback"
  }
}
```

### Twitter Search

```json
{
  "query": "x.com/username",
  "includeDomains": ["x.com", "twitter.com"],
  "type": "auto",
  "numResults": 5,
  "startPublishedDate": "2024-01-01T00:00:00.000Z",
  "endPublishedDate": "2024-12-31T23:59:59.999Z",
  "contents": {
    "text": {
      "maxCharacters": 3000
    },
    "livecrawl": "fallback"
  }
}
```

### Company Research

```json
{
  "query": "site:company.com",
  "type": "auto",
  "numResults": 10,
  "contents": {
    "text": {
      "maxCharacters": 3000
    },
    "livecrawl": "always",
    "subpages": 10,
    "subpageTarget": ["about", "pricing"]
  }
}
```

### URL Crawling

```json
{
  "ids": ["https://example.com/article"],
  "text": true,
  "livecrawl": "always"
}
```

## Rate Limits

- Requests per minute: Varies by plan
- Concurrent requests: Varies by plan
- Check response headers for rate limit information

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid API key |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Request Headers

Required:
- `x-api-key`: Your API key
- `Content-Type`: application/json

Optional:
- `User-Agent`: Client identifier

## Timeout

Default request timeout: 25 seconds

## Content Types

### Text Extraction
- `maxCharacters`: Maximum characters to extract (default: 3000)

### Livecrawl Options
- `always`: Always fetch fresh content
- `fallback`: Use cached content if available, otherwise fetch fresh
- `never`: Only use cached content

## Query Types

### Auto
Automatically determines the best search type based on the query.

### Keyword
Traditional keyword-based search.

### Neural
AI-powered semantic search.

## Date Filtering

Dates must be in ISO 8601 format:
```
2024-01-15T00:00:00.000Z
```

## Domain Filtering

### Include Domains
Limit results to specific domains:
```json
"includeDomains": ["example.com", "test.com"]
```

### Exclude Domains
Exclude specific domains from results:
```json
"excludeDomains": ["spam.com", "unwanted.com"]
```

## Categories

Available categories:
- `research paper`: Academic papers and research
- `tweet`: Twitter/X posts
- `news`: News articles
- `blog`: Blog posts
- `company`: Company information

## Pagination

The API does not support traditional pagination. To get more results, increase the `numResults` parameter in your initial request.

## Testing

Use the MCP Inspector to test API calls:
```bash
npm run inspector
```

## SDK Usage

### JavaScript/TypeScript

```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: 'https://api.exa.ai',
  headers: {
    'x-api-key': process.env.EXA_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 25000
});

const response = await client.post('/search', {
  query: 'your search query',
  numResults: 5
});
```

### cURL

```bash
curl -X POST https://api.exa.ai/search \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "search term",
    "numResults": 5
  }'
```

## Response Fields

### Result Object

| Field | Type | Description |
|-------|------|-------------|
| url | string | URL of the result |
| title | string | Title of the page |
| publishedDate | string | Publication date (ISO format) |
| author | string | Author (if available) |
| text | string | Extracted text content |

## Best Practices

1. Set appropriate `maxCharacters` based on your needs
2. Use `livecrawl: "fallback"` for better performance when fresh content isn't critical
3. Be specific with queries for better results
4. Use domain filtering to improve relevance
5. Handle rate limits gracefully with exponential backoff
6. Cache results when appropriate
7. Use appropriate categories for specialized searches
