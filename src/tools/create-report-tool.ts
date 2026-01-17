import * as fs from "fs";
import * as path from "path";
import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";

export interface CreateReportToolData {
  reasoning?: string;
  title?: string;
  userRequestLanguageReference?: string;
  content?: string;
  confidence?: "high" | "medium" | "low";
}

/**
 * Tool for creating comprehensive detailed reports with citations as a final step of research.
 * CRITICAL: Every factual claim in content MUST have inline citations [1], [2], [3].
 * Citations must be integrated directly into sentences, not just listed at the end.
 */
export class CreateReportTool implements BaseTool {
  toolName = "create_report";
  description = `Create a comprehensive detailed report with citations as a final step of research.

CRITICAL: Every factual claim in content MUST have inline citations [1], [2], [3].
Citations must be integrated directly into sentences, not just listed at the end.`;

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: CreateReportToolData
  ): Promise<string> {
    // Provide default values for optional/missing fields (matches Python Pydantic validation)
    const title = data.title || "Untitled Report";
    const content = data.content || "";
    const reasoning = data.reasoning || "";
    const userRequestLanguageReference = data.userRequestLanguageReference || "";
    const confidence = data.confidence || "medium";

    const reportsDir = config.execution?.reportsDir || "reports";
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19).replace("T", "_");
    const safeTitle = (title
      .replace(/[^a-zA-Z0-9\s\-_]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50)
      .trim() || "report");
    const filename = `${timestamp}_${safeTitle}.md`;
    const filepath = path.join(reportsDir, filename);

    // Format full report with sources
    let fullContent = `# ${title}\n\n`;
    fullContent += `*Created: ${new Date().toISOString().replace("T", " ").slice(0, 19)}*\n\n`;
    fullContent += `${content}\n\n`;

    // Add sources reference section
    if (context.sources.size > 0) {
      fullContent += "---\n\n";
      fullContent += "## Sources\n\n";
      const sourcesArray = Array.from(context.sources.values());
      fullContent += sourcesArray.map((source) => 
        `[${source.number}] ${source.title || "Untitled"} - ${source.url}`
      ).join("\n");
    }

    // Write report to file
    fs.writeFileSync(filepath, fullContent, "utf-8");

    const report = {
      title: title,
      content: content,
      confidence: confidence,
      sourcesCount: context.sources.size,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      filepath: filepath,
      timestamp: new Date().toISOString(),
    };

    console.log(
      "CREATE REPORT FULL DEBUG:\n" +
      `   Language Reference: '${userRequestLanguageReference}'\n` +
      `   Title: '${title}'\n` +
      `   Reasoning: '${reasoning.substring(0, 150)}${reasoning.length > 150 ? "..." : ""}'\n` +
      `   Confidence: ${confidence}\n` +
      `   Content Preview: '${content.substring(0, 200)}${content.length > 200 ? "..." : ""}'\n` +
      `   Words: ${report.wordCount}, Sources: ${report.sourcesCount}\n` +
      `   Saved: ${filepath}\n`
    );

    return JSON.stringify(report, null, 2);
  }
}
