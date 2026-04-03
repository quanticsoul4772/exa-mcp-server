import { z } from "zod";
import { createSearchTool } from "./tool-builder.js";
import { getConfig } from "../config/index.js";
import { ResponseFormatter } from "../utils/formatter.js";

const twitterSearchSchema = z.object({
  query: z.string().describe("Twitter username, hashtag, or search term (e.g., 'x.com/username' or search term)"),
  numResults: z.coerce.number().min(1).max(100).optional().describe("Number of Twitter results to return (default: 5)"),
  startPublishedDate: z.string().optional().describe("Optional ISO date string (e.g., '2023-04-01T00:00:00.000Z') to filter tweets published after this date. Use only when necessary."),
  endPublishedDate: z.string().optional().describe("Optional ISO date string (e.g., '2023-04-30T23:59:59.999Z') to filter tweets published before this date. Use only when necessary.")
});

export const twitterSearchTool = createSearchTool(
  "twitter_search",
  "Search Twitter/X.com posts, profiles, and threads. Use instead of exa_search for social media content. Does NOT search general web — restricted to x.com/twitter.com. Supports user lookup (x.com/username) and author filter (from:username).",
  twitterSearchSchema,
  false,
  ({ query, numResults, startPublishedDate, endPublishedDate }) => {
    const config = getConfig();
    const request = {
      query,
      includeDomains: ["x.com", "twitter.com"],
      type: "auto" as const,
      numResults: numResults || config.tools.defaultNumResults,
      contents: {
        text: {
          maxCharacters: config.tools.defaultMaxCharacters
        },
        livecrawl: 'always' as const
      },
      startPublishedDate,
      endPublishedDate
    };
    return request;
  },
  (_data, _toolName) => ResponseFormatter.formatTwitterResponse(_data.results)
);