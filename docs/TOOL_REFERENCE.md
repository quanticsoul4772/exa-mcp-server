# Tool Reference

This document describes all available tools in the Exa MCP Server.

## Table of Contents

- [Web Search](#web-search)
- [Research Paper Search](#research-paper-search)
- [Twitter/X Search](#twitterx-search)
- [Company Research](#company-research)
- [URL Crawling](#url-crawling)
- [Competitor Analysis](#competitor-analysis)

## Web Search

### `exa_search`

Search the web using Exa's search capabilities.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `numResults` | number | No | Number of results (default: 5) |

#### Example

```json
{
  "query": "machine learning tutorials",
  "numResults": 10
}
```

#### Response Format

```
Web Search: machine learning tutorials

1. Title: Introduction to Machine Learning
   URL: https://example.com/ml-intro
   Published: 2024-01-15
   
   Content excerpt from the page...

2. Title: Machine Learning Fundamentals
   URL: https://example.com/ml-basics
   Published: 2024-01-10
   
   Content excerpt from the page...
```

## Research Paper Search

### `research_paper_search`

Search research papers from academic sources.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Research topic or keyword |
| `numResults` | number | No | Number of papers (default: 5) |
| `maxCharacters` | number | No | Max characters per result (default: 3000) |

#### Example

```json
{
  "query": "neural network optimization",
  "numResults": 3,
  "maxCharacters": 2000
}
```

#### Response Format

```
Research Papers: neural network optimization

1. Title: Optimization Techniques for Neural Networks
   Authors: Smith, J., Johnson, K.
   Published: 2023-12-01
   URL: https://arxiv.org/paper123
   
   Abstract and content excerpt...

2. Title: Gradient Descent Variations
   Authors: Lee, M.
   Published: 2023-11-15
   URL: https://arxiv.org/paper456
   
   Abstract and content excerpt...
```

## Twitter/X Search

### `twitter_search`

Search Twitter/X posts and profiles.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Username, hashtag, or search term |
| `numResults` | number | No | Number of results (default: 5) |
| `startPublishedDate` | string | No | ISO date string for start date |
| `endPublishedDate` | string | No | ISO date string for end date |

#### Example

```json
{
  "query": "x.com/elonmusk",
  "numResults": 10,
  "startPublishedDate": "2024-01-01T00:00:00.000Z"
}
```

#### Response Format

```
Twitter/X Search: x.com/elonmusk

1. @elonmusk - 2024-01-20 14:30
   Tweet content here...
   
   Likes: 45K | Retweets: 12K
   URL: https://x.com/elonmusk/status/123456

2. @elonmusk - 2024-01-19 09:15
   Another tweet content...
   
   Likes: 38K | Retweets: 8K
   URL: https://x.com/elonmusk/status/123457
```

## Company Research

### `company_research`

Research company information from their website.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Company website URL |
| `subpages` | number | No | Number of subpages to crawl (default: 10) |
| `subpageTarget` | string[] | No | Specific sections to target |

#### Example

```json
{
  "query": "stripe.com",
  "subpages": 15,
  "subpageTarget": ["about", "pricing", "docs"]
}
```

#### Response Format

```
Company Research: stripe.com

Main Page:
- Title: Stripe - Payment Processing Platform
- URL: https://stripe.com
- Content overview...

Subpages Found:

1. About Us
   URL: https://stripe.com/about
   Content from about page...

2. Pricing
   URL: https://stripe.com/pricing
   Pricing information...

3. Documentation
   URL: https://stripe.com/docs
   Documentation overview...
```

## URL Crawling

### `crawling`

Extract content from specific URLs.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to crawl |

#### Example

```json
{
  "url": "https://example.com/article"
}
```

#### Response Format

```
URL Content: https://example.com/article

Title: Article Title Here
Published: 2024-01-15
Author: John Doe

Full article content extracted from the page...
```

## Competitor Analysis

### `competitor_finder`

Find competitors of a company.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Description of the company/product |
| `numResults` | number | No | Number of competitors (default: 10) |
| `excludeDomain` | string | No | Domain to exclude from results |

#### Example

```json
{
  "query": "payment processing API",
  "numResults": 5,
  "excludeDomain": "stripe.com"
}
```

#### Response Format

```
Competitors for: payment processing API

1. PayPal
   URL: https://paypal.com
   Description: Online payment system...

2. Square
   URL: https://square.com
   Description: Payment and merchant services...

3. Adyen
   URL: https://adyen.com
   Description: Payment platform...
```

## Error Handling

All tools return structured error messages when issues occur:

```
Error: Invalid API key
Please check your EXA_API_KEY environment variable.
```

Common error types:
- Invalid parameters
- API authentication failures
- Rate limiting
- Network errors
- Invalid URLs

## Rate Limiting

The Exa API has rate limits. Tools will return appropriate error messages when limits are exceeded.

## Response Size Limits

- Default character limit per result: 3000 characters
- Maximum results per request: Varies by tool (typically 10-20)
- Response truncation: Long content is truncated with "..." indicator

## Best Practices

1. Use specific queries for better results
2. Adjust `numResults` based on your needs
3. For research papers, use academic terminology
4. For Twitter searches, use "x.com/username" format for user timelines
5. For company research, provide the root domain
6. Check error messages for troubleshooting

## Environment Variables

Required:
- `EXA_API_KEY`: Your Exa API key

Optional:
- `EXA_TIMEOUT`: Request timeout in milliseconds (default: 30000)
- `DEBUG`: Enable debug logging (set to "true")

## Debugging

Enable debug output:
```bash
DEBUG=true npx exa-mcp-server
```

Debug information is written to stderr and includes:
- Request IDs
- API call details
- Response times
- Error details
