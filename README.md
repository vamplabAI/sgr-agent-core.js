# SGR Agent Core TypeScript

TypeScript library for building agents based on Schema-Guided Reasoning (SGR).

## Description

This library provides base classes and tools for creating intelligent agents that can reason about tasks and perform actions using tools. The library is a TypeScript port of the original Python project [sgr-agent-core](https://github.com/vamplabAI/sgr-agent-core).

## Features

- Base classes for creating agents (`BaseAgent`)
- Tool system (`BaseTool`)
- Ready-to-use agent example (`SGRAgent`)
- Example tools (`ReasoningTool`, `FinalAnswerTool`)
- Simple configuration through constructors
- Full TypeScript typing

## Installation

### Install as npm package

```bash
npm install sgr-agent-core
```

After installation, the library is ready to use. All necessary TypeScript types are included.

**If the package is not yet published to npm**, use local installation:

```bash
# First, build the project
cd /path/to/sgr-agent-core.js
npm install
npm run build

# Then in your project
npm install /path/to/sgr-agent-core.js
```

### Development installation

```bash
git clone <repository-url>
cd sgr-agent-core.js
npm install
npm run build
```

## Using the Library

After installing the package (`npm install sgr-agent-core`), you can use the library in your project.

### What to do after installation?

1. **Install dependencies** (if not already installed):
   ```bash
   npm install openai zod
   ```

2. **Set up environment variables**:
   ```bash
   export OPENAI_API_KEY=your-api-key
   ```

3. **Import necessary classes and functions** from the package:
   ```typescript
   import { SGRAgent, createOpenAIClient, AgentConfig } from "sgr-agent-core";
   import { ReasoningTool, FinalAnswerTool } from "sgr-agent-core";
   ```

4. **Create and run the agent** (see examples below)

### Minimal Example (3 steps)

```typescript
import { SGRAgent, createOpenAIClient, ReasoningTool, FinalAnswerTool } from "sgr-agent-core";

// 1. Create OpenAI client
const client = createOpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  model: "gpt-4o-mini",
});

// 2. Create agent
const agent = new SGRAgent(
  [{ role: "user", content: "What is 2+2?" }],
  client,
  { llm: { apiKey: process.env.OPENAI_API_KEY!, model: "gpt-4o-mini" } },
  [new ReasoningTool(), new FinalAnswerTool()]
);

// 3. Execute agent
const result = await agent.execute();
console.log(result);
```

### Basic Example

```typescript
import { 
  SGRAgent, 
  createOpenAIClient, 
  AgentConfig,
  ReasoningTool,
  FinalAnswerTool 
} from "sgr-agent-core";

async function main() {
  // 1. Set up OpenAI client
  const openaiClient = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
    // Optional: proxy for proxying requests
    // proxy: "http://127.0.0.1:8080",
  });

  // 2. Configure agent
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

  // 3. Create toolkit
  const toolkit = [
    new ReasoningTool(),
    new FinalAnswerTool(),
  ];

  // 4. Create agent
  const agent = new SGRAgent(
    [{ role: "user", content: "What is 2+2? Provide a detailed explanation." }],
    openaiClient,
    agentConfig,
    toolkit
  );

  // 5. Execute agent
  const result = await agent.execute();
  console.log(result);
}

main().catch(console.error);
```

### Full Example with Web Search

```typescript
import { 
  SGRAgent, 
  createOpenAIClient, 
  AgentConfig,
  ReasoningTool,
  FinalAnswerTool,
  WebSearchTool,
  ExtractPageContentTool,
  GeneratePlanTool,
  AdaptPlanTool,
  ClarificationTool,
  CreateReportTool
} from "sgr-agent-core";

async function main() {
  // Set up client
  const openaiClient = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  });

  // Configuration with web search
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
    search: {
      tavilyApiKey: process.env.TAVILY_API_KEY, // Optional: for web search
      maxResults: 10,
    },
    prompts: {
      systemPrompt: `You are a helpful AI assistant that can search the web and provide answers.

Available tools:
{available_tools}

Use the reasoning tool first to analyze the task.`,
      initialUserRequest: `Current date: {current_date}`,
    },
  };

  // Full toolkit
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

  // Create and execute agent
  const agent = new SGRAgent(
    [{ role: "user", content: "What is the latest news about AI?" }],
    openaiClient,
    agentConfig,
    toolkit
  );

  const result = await agent.execute();
  console.log(result);
}

main().catch(console.error);
```

### Streaming Example

```typescript
import { 
  SGRAgent, 
  createOpenAIClient, 
  AgentConfig,
  StreamingCallback,
  ReasoningTool,
  FinalAnswerTool
} from "sgr-agent-core";

async function main() {
  const openaiClient = createOpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o-mini",
  });

  // Set up streaming callback
  const streamingCallback: StreamingCallback = {
    onChunk: (chunk: string) => {
      process.stdout.write(chunk); // Output chunks in real-time
    },
    onToolCall: (toolCallId: string, toolName: string, toolArguments: string) => {
      console.log(`\n[Tool Call] ${toolName} (${toolCallId})`);
    },
    onFinish: (finalContent: string) => {
      console.log("\n[Stream finished]");
    },
  };

  const agentConfig: AgentConfig = {
    llm: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 8000,
    },
    execution: {
      maxIterations: 10,
      enableStreaming: true, // Enable streaming
    },
    prompts: {
      systemPrompt: `You are a helpful AI assistant.

Available tools:
{available_tools}`,
      initialUserRequest: `Current date: {current_date}`,
    },
  };

  const toolkit = [
    new ReasoningTool(),
    new FinalAnswerTool(),
  ];

  // Pass streamingCallback to constructor
  const agent = new SGRAgent(
    [{ role: "user", content: "Explain quantum computing in simple terms." }],
    openaiClient,
    agentConfig,
    toolkit,
    undefined, // name
    undefined, // logger
    streamingCallback // streaming callback
  );

  const result = await agent.execute();
  console.log("\n=== Final Result ===");
  console.log(result);
}

main().catch(console.error);
```

### Environment Variables

Create a `.env` file or set environment variables:

```bash
export OPENAI_API_KEY=your-openai-api-key
export OPENAI_MODEL=gpt-4o-mini  # optional
export OPENAI_BASE_URL=https://api.openai.com/v1  # optional
export OPENAI_PROXY=http://127.0.0.1:8080  # optional
export TAVILY_API_KEY=your-tavily-api-key  # optional, for web search
export ENABLE_STREAMING=true  # optional
```

## Quick Start (for library developers)

### Run example

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
import { BaseAgent, BaseTool, AgentConfig } from "sgr-agent-core";
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
import { BaseTool, AgentConfig, AgentContext } from "sgr-agent-core";

class MyTool implements BaseTool {
  toolName = "my_tool";
  description = "Description of my tool for LLM";

  async execute(
    context: AgentContext,
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
import { SGRAgent, createOpenAIClient, StreamingCallback } from "sgr-agent-core";

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
   import { createOpenAIClient } from "sgr-agent-core";
   
   const openaiClient = createOpenAIClient(agentConfig.llm);
   ```

Supported proxy formats:
- `http://host:port` - HTTP proxy
- `https://host:port` - HTTPS proxy
- `socks5://host:port` - SOCKS5 proxy
- `socks4://host:port` - SOCKS4 proxy

## Available Exports

The library exports the following main classes and types:

### Agents
- `SGRAgent` - ready-to-use SGR agent
- `BaseAgent` - base class for creating custom agents

### Tools
- `ReasoningTool` - reasoning tool
- `FinalAnswerTool` - final answer tool
- `WebSearchTool` - web search tool (requires Tavily API)
- `ExtractPageContentTool` - page content extraction tool
- `GeneratePlanTool` - plan generation tool
- `AdaptPlanTool` - plan adaptation tool
- `ClarificationTool` - clarification request tool
- `CreateReportTool` - report creation tool
- `BaseTool` - base interface for creating custom tools

### Utilities
- `createOpenAIClient(config)` - create OpenAI client with proxy support
- `StreamingCallback` - streaming interface
- `StreamingHandler` - streaming handler

### Types and Configuration
- `AgentConfig` - agent configuration
- `LLMConfig` - LLM configuration
- `ExecutionConfig` - execution configuration
- `AgentContext` - agent execution context
- `AgentStatesEnum` - agent states

### Import Examples

```typescript
// Import main classes
import { SGRAgent, createOpenAIClient, AgentConfig } from "sgr-agent-core";

// Import tools
import { 
  ReasoningTool, 
  FinalAnswerTool, 
  WebSearchTool 
} from "sgr-agent-core";

// Import types
import type { StreamingCallback, AgentContext } from "sgr-agent-core";
```

## Examples

See the `examples/` folder for more detailed usage examples:
- `simple-agent.ts` - simple example of using SGRAgent (for development)
- `usage-example.ts` - example showing how to use the library after npm install

## Differences from Python Version

- No centralized configs (YAML files) - everything through constructors
- No API server - library only for use in applications
- Simplified NextStepTools implementation (without dynamic type generation)
- All settings are explicitly passed through constructors

## License

MIT
