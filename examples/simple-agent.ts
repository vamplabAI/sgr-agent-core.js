import { SGRAgent, createOpenAIClient, StreamingCallback } from "../src";
import { AgentConfig } from "../src/config";
import { ReasoningTool } from "../src/tools/reasoning-tool";
import { FinalAnswerTool } from "../src/tools/final-answer-tool";
import { WebSearchTool } from "../src/tools/web-search-tool";
import { ExtractPageContentTool } from "../src/tools/extract-page-content-tool";
import { ClarificationTool } from "../src/tools/clarification-tool";
import { CreateReportTool } from "../src/tools/create-report-tool";
import { AdaptPlanTool } from "../src/tools/adapt-plan-tool";
import { GeneratePlanTool } from "../src/tools/generate-plan-tool";

async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Please set OPENAI_API_KEY environment variable");
    process.exit(1);
  }

  // Configure agent
  const agentConfig: AgentConfig = {
    llm: {
      apiKey: apiKey,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 8000,
      baseURL: process.env.OPENAI_BASE_URL,
      proxy: process.env.OPENAI_PROXY,
    },
    execution: {
      maxIterations: 10,
      maxClarifications: 3,
      enableStreaming: process.env.ENABLE_STREAMING === "true", // Enable streaming if needed
      reportsDir: process.env.REPORTS_DIR || "reports", // Directory for saving reports
    },
    search: {
      tavilyApiKey: process.env.TAVILY_API_KEY, // Optional: for web search
      tavilyApiBaseUrl: process.env.TAVILY_API_BASE_URL || "https://api.tavily.com",
      maxResults: 10,
      contentLimit: 3500,
    },
    prompts: {
      systemPrompt: `You are a helpful AI assistant that can reason about tasks and provide answers.

Available tools:
{available_tools}

Use the reasoning tool first to analyze the task, then select appropriate actions.`,
      initialUserRequest: `Current date: {current_date}`,
      clarificationResponse: `User provided clarification: {current_date}`,
    },
  };

  // Initialize OpenAI client with proxy support
  const openaiClient = createOpenAIClient(agentConfig.llm);

  // Optional: Set up streaming callback to receive chunks in real-time
  const streamingCallback: StreamingCallback | undefined = agentConfig.execution?.enableStreaming
    ? {
        onChunk: (chunk: string) => {
          process.stdout.write(chunk); // Print chunks as they arrive
        },
        onToolCall: (toolCallId: string, toolName: string, toolArguments: string) => {
          console.log(`\n[Tool Call] ${toolName} (${toolCallId})`);
        },
        onFinish: (finalContent: string) => {
          console.log("\n[Stream finished]");
        },
      }
    : undefined;

  // Create toolkit with all available tools
  const toolkit = [
    new ReasoningTool(),
    new GeneratePlanTool(),
    new AdaptPlanTool(),
    new WebSearchTool(),
    new ExtractPageContentTool(),
    new ClarificationTool(),
    new CreateReportTool(),
    new FinalAnswerTool(),
  ];

  // Create agent
  const agent = new SGRAgent(
    [{ role: "user", content: "What is 2+2? Provide a detailed explanation." }],
    openaiClient,
    agentConfig,
    toolkit,
    undefined, // name
    undefined, // logger
    streamingCallback // streaming callback
  );

  // Execute agent
  try {
    console.log("Starting agent execution...\n");
    const result = await agent.execute();
    console.log("\n=== Final Result ===");
    console.log(result);
  } catch (error: any) {
    console.error("Agent execution failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

if (require.main === module) {
  main().catch(console.error);
}
