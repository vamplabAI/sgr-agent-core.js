/**
 * Example of using sgr-agent-core library after npm install
 * 
 * This example demonstrates how to use the library in your project
 * after installing it via: npm install sgr-agent-core
 */

import {
  SGRAgent,
  createOpenAIClient,
  AgentConfig,
  ReasoningTool,
  FinalAnswerTool,
  WebSearchTool,
  GeneratePlanTool,
  AdaptPlanTool,
  ExtractPageContentTool,
  ClarificationTool,
  CreateReportTool,
  StreamingCallback,
} from "sgr-agent-core";

async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Please set OPENAI_API_KEY environment variable");
    process.exit(1);
  }

  // Step 1: Create OpenAI client
  const openaiClient = createOpenAIClient({
    apiKey: apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    // Optional: proxy support
    // proxy: process.env.OPENAI_PROXY,
  });

  // Step 2: Configure agent
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
      enableStreaming: process.env.ENABLE_STREAMING === "true",
      reportsDir: process.env.REPORTS_DIR || "reports",
    },
    search: {
      tavilyApiKey: process.env.TAVILY_API_KEY,
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

  // Step 3: Set up streaming callback (optional)
  const streamingCallback: StreamingCallback | undefined = agentConfig.execution?.enableStreaming
    ? {
        onChunk: (chunk: string) => {
          process.stdout.write(chunk);
        },
        onToolCall: (toolCallId: string, toolName: string, toolArguments: string) => {
          console.log(`\n[Tool Call] ${toolName} (${toolCallId})`);
        },
        onFinish: (finalContent: string) => {
          console.log("\n[Stream finished]");
        },
      }
    : undefined;

  // Step 4: Create toolkit with available tools
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

  // Step 5: Create agent instance
  const agent = new SGRAgent(
    [{ role: "user", content: "What is 2+2? Provide a detailed explanation." }],
    openaiClient,
    agentConfig,
    toolkit,
    undefined, // name (optional)
    undefined, // logger (optional)
    streamingCallback // streaming callback (optional)
  );

  // Step 6: Execute agent
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
