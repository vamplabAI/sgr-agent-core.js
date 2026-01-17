import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";
import { TavilySearchService } from "../services/tavily-service";

export interface ExtractPageContentToolData {
  reasoning: string;
  urls: string[];
}

/**
 * Tool for extracting full content from specific web pages.
 * Use after WebSearchTool to get detailed information from promising URLs.
 */
export class ExtractPageContentTool implements BaseTool {
  toolName = "extract_page_content";
  description = `Extract full detailed content from specific web pages.
Use for: Getting complete page content from URLs found in web search
Returns: Full page content in readable format (via Tavily Extract API)
Best for: Deep analysis of specific pages, extracting structured data

Usage: Call after WebSearchTool to get detailed information from promising URLs

CRITICAL WARNINGS:
    - Extracted pages may show data from DIFFERENT years/time periods than asked
    - ALWAYS verify that extracted content matches the question's temporal context
    - Example: Question asks about 2022, but page shows 2024 data - REJECT this source
    - If extracted content contradicts search snippet, prefer snippet for factual questions
    - For date/number questions, cross-check extracted values with search snippets`;

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: ExtractPageContentToolData
  ): Promise<string> {
    if (!config.search) {
      throw new Error("Search configuration is required for ExtractPageContentTool");
    }

    if (!data.urls || data.urls.length === 0) {
      throw new Error("URLs list is required");
    }

    const searchService = new TavilySearchService(config.search);
    const sources = await searchService.extract(data.urls);

    // Update existing sources or add new ones
    for (const source of sources) {
      if (context.sources.has(source.url)) {
        // Update existing source with full content
        const existing = context.sources.get(source.url)!;
        existing.fullContent = source.fullContent;
        existing.charCount = source.charCount;
      } else {
        // Add new source with next number
        source.number = context.sources.size + 1;
        context.sources.set(source.url, source);
      }
    }

    let formattedResult = "Extracted Page Content:\n\n";
    const contentLimit = config.search.contentLimit || 3500;

    for (const url of data.urls) {
      const source = context.sources.get(url);
      if (source && source.fullContent) {
        const contentPreview = source.fullContent.substring(0, contentLimit);
        formattedResult += `[${source.number}] ${source.title || "Untitled"} - ${source.url}\n\n`;
        formattedResult += `**Full Content:**\n${contentPreview}\n\n`;
        formattedResult += `*[Content length: ${contentPreview.length} characters]*\n\n---\n\n`;
      } else if (source) {
        formattedResult += `[${source.number}] ${source.title || "Untitled"} - ${source.url}\n*Failed to extract content*\n\n`;
      }
    }

    return formattedResult;
  }
}
