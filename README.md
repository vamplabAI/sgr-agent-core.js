# SGR Agent Core TypeScript

TypeScript library for building agents based on Schema-Guided Reasoning (SGR).

## Description

This library provides base classes and tools for creating intelligent agents that can reason about tasks and perform actions using tools. The library is a TypeScript port of the original Python project [sgr-agent-core](https://github.com/vamplabAI/sgr-agent-core).

## Features

- ✅ Base classes for creating agents (`BaseAgent`)
- ✅ Tool system (`BaseTool`)
- ✅ Ready-to-use agent example (`SGRAgent`)
- ✅ Example tools (`ReasoningTool`, `FinalAnswerTool`)
- ✅ Simple configuration through constructors
- ✅ Full TypeScript typing

## Installation

```bash
npm install
npm run build
```

## Quick Start

### Simple Example

```typescript
import OpenAI from "openai";
import { SGRAgent, AgentConfig } from "./src";
import { ReasoningTool, FinalAnswerTool } from "./src/tools";

// Initialize OpenAI client (with optional proxy support)
import { createOpenAIClient } from "./src";

const openaiClient = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  proxy: process.env.OPENAI_PROXY, // Optional: "http://127.0.0.1:8080" or "socks5://127.0.0.1:1080"
});

// Configure agent
const agentConfig: AgentConfig = {
  llm: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
    temperature: 0.4,
    maxTokens: 8000,
  },
  execution: {
    maxIterations: 10,
    maxClarifications: 3,
  },
  prompts: {
    systemPrompt: `You are a helpful AI assistant.

Available tools:
{available_tools}

Use the reasoning tool first to analyze the task.`,
    initialUserRequest: `Current date: {current_date}`,
  },
};

// Create toolkit
const toolkit = [
  new ReasoningTool(),
  new FinalAnswerTool(),
];

// Create agent
const agent = new SGRAgent(
  [{ role: "user", content: "What is 2+2? Provide a detailed explanation." }],
  openaiClient,
  agentConfig,
  toolkit
);

// Execute
const result = await agent.execute();
console.log(result);
```

Run the example:

```bash
export OPENAI_API_KEY=your-api-key
npm run example
```

## Architecture

### BaseAgent

Base abstract class for all agents. Provides:
- Execution context management (`AgentContext`)
- Step logging
- User clarification handling
- Execution loop with phases: reasoning → select action → action

**Key methods:**
- `reasoningPhase()` - reasoning phase (abstract)
- `selectActionPhase(reasoning)` - tool selection (abstract)
- `actionPhase(tool)` - tool execution (abstract)
- `execute()` - main execution loop

### BaseTool

Interface for tools that agents can use. Each tool must implement:
- `toolName`: unique tool name
- `description`: tool description for LLM
- `execute(context, config, data)`: execution method

### Data Models

- `AgentContext`: agent execution context (state, iterations, results)
- `AgentStatesEnum`: agent states (INITED, RESEARCHING, COMPLETED, etc.)
- `SearchResult`, `SourceData`: for search functionality (optional)

## Creating Your Own Agent

```typescript
import { BaseAgent, BaseTool, AgentConfig } from "./src";
import OpenAI from "openai";

class MyAgent extends BaseAgent {
  name = "my_agent";

  protected async reasoningPhase() {
    // 1. Prepare context and tools
    const messages = await this.prepareContext();
    const tools = await this.prepareTools();

    // 2. Call LLM for reasoning
    const response = await this.openaiClient.chat.completions.create({
      model: this.config.llm.model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "reasoning" } },
    });

    // 3. Extract reasoning result
    const reasoning = /* parse response */;
    this.logReasoning(reasoning);
    return reasoning;
  }

  protected async selectActionPhase(reasoning: any): Promise<BaseTool> {
    // Select tool based on reasoning
    const toolName = /* determine from reasoning */;
    return this.toolkit.find(t => t.toolName === toolName)!;
  }

  protected async actionPhase(tool: BaseTool): Promise<string> {
    // Execute tool
    const messages = await this.prepareContext();
    const response = await this.openaiClient.chat.completions.create({
      model: this.config.llm.model,
      messages,
      tools: await this.prepareTools(),
      tool_choice: { type: "function", function: { name: tool.toolName } },
    });

    const args = JSON.parse(response.choices[0].message.tool_calls![0].function.arguments!);
    const result = await tool.execute(this.context, this.config, args);
    
    this.conversation.push({
      role: "tool",
      content: result,
      tool_call_id: response.choices[0].message.tool_calls![0].id,
    });

    this.logToolExecution(tool, result);
    return result;
  }
}
```

## Creating Your Own Tool

```typescript
import { BaseTool } from "./src/base-tool";
import { AgentConfig } from "./src/config";
import * as models from "./src/models";

class MyTool implements BaseTool {
  toolName = "my_tool";
  description = "Description of my tool for LLM";

  async execute(
    context: models.AgentContext,
    config: AgentConfig,
    data: any
  ): Promise<string> {
    // Tool execution logic
    // Can use context to save state
    // Can use config to access settings
    
    const result = "Execution result";
    return result;
  }
}
```

## Streaming Support

The library supports streaming responses from the LLM for real-time output:

```typescript
import { SGRAgent, createOpenAIClient, StreamingCallback } from "./src";

const streamingCallback: StreamingCallback = {
  onChunk: (chunk: string) => {
    process.stdout.write(chunk); // Print chunks as they arrive
  },
  onToolCall: (toolCallId: string, toolName: string, toolArguments: string) => {
    console.log(`\n[Tool Call] ${toolName}`);
  },
  onFinish: (finalContent: string) => {
    console.log("\n[Stream finished]");
  },
};

const agentConfig: AgentConfig = {
  llm: { /* ... */ },
  execution: {
    maxIterations: 10,
    enableStreaming: true, // Enable streaming
  },
};

const agent = new SGRAgent(
  taskMessages,
  openaiClient,
  agentConfig,
  toolkit,
  undefined, // name
  undefined, // logger
  streamingCallback // streaming callback
);
```

When `enableStreaming` is `true`, the agent will use streaming API calls and callbacks will be invoked as chunks arrive.

## Configuration

All settings are passed through constructors:

```typescript
const agentConfig: AgentConfig = {
  llm: {
    apiKey: "your-api-key",
    model: "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1", // optional
    temperature: 0.4,
    maxTokens: 8000,
    proxy: "http://127.0.0.1:8080", // optional: proxy URL
  },
  execution: {
    maxIterations: 10,      // maximum number of iterations
    maxClarifications: 3,    // maximum number of clarifications
    enableStreaming: false,  // enable streaming responses (optional)
  },
  prompts: {
    systemPrompt: "...",    // system prompt with {available_tools}
    initialUserRequest: "...", // initial request with {current_date}
    clarificationResponse: "...", // clarification response
  },
};
```

### Proxy Support

The library supports proxy configuration for OpenAI API requests. To use a proxy:

1. Install the required proxy agent packages (optional dependencies):
   ```bash
   npm install https-proxy-agent http-proxy-agent socks-proxy-agent
   ```

2. Configure proxy in LLM config:
   ```typescript
   const agentConfig: AgentConfig = {
     llm: {
       apiKey: "your-api-key",
       model: "gpt-4o-mini",
       proxy: "http://127.0.0.1:8080", // HTTP proxy
       // or
       proxy: "socks5://127.0.0.1:1080", // SOCKS5 proxy
       // or
       proxy: "https://proxy.example.com:8080", // HTTPS proxy
     },
   };
   ```

3. Use `createOpenAIClient` helper function:
   ```typescript
   import { createOpenAIClient } from "./src";
   
   const openaiClient = createOpenAIClient(agentConfig.llm);
   ```

Supported proxy formats:
- `http://host:port` - HTTP proxy
- `https://host:port` - HTTPS proxy
- `socks5://host:port` - SOCKS5 proxy
- `socks4://host:port` - SOCKS4 proxy

## Examples

See the `examples/` folder for more detailed usage examples:
- `simple-agent.ts` - simple example of using SGRAgent

## Differences from Python Version

- No centralized configs (YAML files) - everything through constructors
- No API server - library only for use in applications
- Simplified NextStepTools implementation (without dynamic type generation)
- All settings are explicitly passed through constructors

## License

MIT
