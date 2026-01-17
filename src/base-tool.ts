import { AgentConfig } from "./config";
import { AgentContext } from "./models";

/**
 * Base interface for all tools that agents can use.
 * Tools should be stateless and use context for state management.
 */
export interface BaseTool {
  /** Unique tool name used for identification */
  toolName: string;
  /** Tool description for LLM to understand when to use this tool */
  description: string;
  /**
   * Execute the tool with given context and configuration.
   * @param context - Agent execution context
   * @param config - Agent configuration
   * @param args - Tool-specific arguments
   * @returns String result of tool execution
   */
  execute(
    context: AgentContext,
    config: AgentConfig,
    ...args: any[]
  ): Promise<string>;
}

export abstract class BaseToolClass implements BaseTool {
  abstract toolName: string;
  abstract description: string;

  abstract execute(
    context: AgentContext,
    config: AgentConfig,
    ...args: any[]
  ): Promise<string>;
}
