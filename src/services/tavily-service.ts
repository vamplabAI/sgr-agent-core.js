import { SearchConfig } from "../config";
import { SourceData } from "../models";

/**
 * Tavily API response types
 */
interface TavilySearchResult {
  url: string;
  title?: string;
  content?: string;
  raw_content?: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
}

interface TavilyExtractResult {
  url: string;
  raw_content?: string;
}

interface TavilyExtractResponse {
  results?: TavilyExtractResult[];
  failed_results?: string[];
}

/**
 * Service for interacting with Tavily search API.
 */
export class TavilySearchService {
  private apiKey?: string;
  private apiBaseUrl: string;
  private config: SearchConfig;

  constructor(config: SearchConfig) {
    this.config = config;
    this.apiKey = config.tavilyApiKey;
    this.apiBaseUrl = config.tavilyApiBaseUrl || "https://api.tavily.com";
  }

  /**
   * Rearrange sources with sequential numbering.
   */
  static rearrangeSources(sources: SourceData[], startingNumber: number = 1): SourceData[] {
    sources.forEach((source, index) => {
      source.number = startingNumber + index;
    });
    return sources;
  }

  /**
   * Perform search through Tavily API.
   */
  async search(
    query: string,
    maxResults?: number,
    includeRawContent: boolean = false
  ): Promise<SourceData[]> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is not configured");
    }

    const max = maxResults || this.config.maxResults || 10;
    
    const response = await fetch(`${this.apiBaseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: max,
        include_raw_content: includeRawContent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }

    const data = await response.json() as TavilySearchResponse;
    return this.convertToSourceData(data);
  }

  /**
   * Extract full content from specific URLs using Tavily Extract API.
   */
  async extract(urls: string[]): Promise<SourceData[]> {
    if (!this.apiKey) {
      throw new Error("Tavily API key is not configured");
    }

    const response = await fetch(`${this.apiBaseUrl}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        urls,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily extract failed: ${response.statusText}`);
    }

    const data = await response.json() as TavilyExtractResponse;
    const sources: SourceData[] = [];

    if (data.results) {
      for (let i = 0; i < data.results.length; i++) {
        const result = data.results[i];
        if (!result.url) continue;

        const source: SourceData = {
          number: i,
          title: result.url.split("/").pop() || "Extracted Content",
          url: result.url,
          snippet: "",
          fullContent: result.raw_content || "",
          charCount: (result.raw_content || "").length,
        };
        sources.push(source);
      }
    }

    if (data.failed_results && data.failed_results.length > 0) {
      console.warn(`⚠️ Failed to extract ${data.failed_results.length} URLs: ${data.failed_results}`);
    }

    return sources;
  }

  /**
   * Convert Tavily response to SourceData list.
   */
  private convertToSourceData(response: TavilySearchResponse): SourceData[] {
    const sources: SourceData[] = [];

    if (!response.results) {
      return sources;
    }

    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i];
      if (!result.url) continue;

      const source: SourceData = {
        number: i,
        title: result.title || "",
        url: result.url,
        snippet: result.content || "",
        fullContent: result.raw_content || "",
        charCount: (result.raw_content || "").length,
      };
      sources.push(source);
    }

    return sources;
  }
}
