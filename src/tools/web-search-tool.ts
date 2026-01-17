import { AgentConfig } from "../config";
import { AgentContext, SearchResult } from "../models";
import { BaseTool } from "../base-tool";
import { TavilySearchService } from "../services/tavily-service";

export interface WebSearchToolData {
  reasoning: string;
  query: string;
  maxResults?: number;
}

/**
 * Tool for searching the web using Tavily API.
 * Use this tool when you need up-to-date information that might not be available in training data.
 */
export class WebSearchTool implements BaseTool {
  toolName = "web_search";
  description = `Search the web for real-time information about any topic.
Use this tool when you need up-to-date information that might not be available in your training data,
or when you need to verify current facts.
The search results will include relevant snippets and URLs from web pages.
This is particularly useful for questions about current events, technology updates,
or any topic that requires recent information.
Use for: Public information, news, market trends, external APIs, general knowledge
Returns: Page titles, URLs, and short snippets (100 characters)
Best for: Quick overview, finding relevant pages

Usage:
    - Use SPECIFIC terms and context in queries
    - For acronyms, add context: "SGR Schema-Guided Reasoning"
    - Use quotes for exact phrases: "Structured Output OpenAI"
    - Search queries in SAME LANGUAGE as user request
    - For date/number questions, include specific year/context in query
    - Use ExtractPageContentTool to get full content from found URLs

IMPORTANT FOR FACTUAL QUESTIONS:
    - Search snippets often contain direct answers - check them carefully
    - For questions with specific dates/numbers, snippets may be more accurate than full pages
    - If the snippet directly answers the question, you may not need to extract the full page`;

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: WebSearchToolData
  ): Promise<string> {
    if (!config.search) {
      throw new Error("Search configuration is required for WebSearchTool");
    }

    const searchService = new TavilySearchService(config.search);
    const maxResults = Math.min(
      data.maxResults || 5,
      config.search.maxResults || 10
    );

    const sources = await searchService.search(
      data.query,
      maxResults,
      false
    );

    const startingNumber = context.sources.size + 1;
    TavilySearchService.rearrangeSources(sources, startingNumber);

    for (const source of sources) {
      context.sources.set(source.url, source);
    }

    const searchResult: SearchResult = {
      query: data.query,
      answer: null,
      citations: sources,
      timestamp: new Date(),
    };
    context.searches.push(searchResult);
    context.searchesUsed += 1;

    let formattedResult = `Search Query: ${searchResult.query}\n\n`;
    formattedResult += "Search Results (titles, links, short snippets):\n\n";

    for (const source of sources) {
      const snippet = source.snippet.length > 100
        ? source.snippet.substring(0, 100) + "..."
        : source.snippet;
      formattedResult += `[${source.number}] ${source.title || "Untitled"} - ${source.url}\n${snippet}\n\n`;
    }

    return formattedResult;
  }
}
