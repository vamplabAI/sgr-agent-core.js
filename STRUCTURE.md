# Project Structure

## Description

TypeScript library for building agents based on Schema-Guided Reasoning (SGR). Simplified version of the original Python project without API server and centralized configs.

## File Structure

```
sgr-agent-core.js/
├── src/
│   ├── models.ts              # Data models (AgentContext, AgentStatesEnum, etc.)
│   ├── config.ts              # Configuration (AgentConfig, LLMConfig, etc.)
│   ├── base-agent.ts          # Base class for agents
│   ├── base-tool.ts           # Interface for tools
│   ├── agents/
│   │   └── sgr-agent.ts       # Example agent implementation
│   ├── tools/
│   │   ├── reasoning-tool.ts  # Reasoning tool
│   │   ├── final-answer-tool.ts # Final answer tool
│   │   └── index.ts           # Tool exports
│   └── index.ts               # Main export file
├── examples/
│   └── simple-agent.ts        # Simple usage example
├── package.json
├── tsconfig.json
└── README.md
```

## Main Components

### BaseAgent
Abstract class for creating agents. Provides:
- Execution context management
- Step logging
- Clarification handling
- Execution loop (reasoning → select action → action)

### BaseTool
Interface for tools. Each tool must implement:
- `toolName`: tool name
- `description`: description for LLM
- `execute()`: execution method

### SGRAgent
Example agent implementation that:
1. Uses ReasoningTool to analyze tasks
2. Selects next tool based on reasoning
3. Executes selected tool

## Usage

All settings are passed through constructors:

```typescript
const agent = new SGRAgent(
  taskMessages,      // Task messages
  openaiClient,      // OpenAI client
  agentConfig,       // Agent configuration
  toolkit           // Tool set
);
```

## Differences from Python Version

- No YAML configs - everything through constructors
- No API server - library only
- Simplified NextStepTools implementation
- All settings explicitly passed
