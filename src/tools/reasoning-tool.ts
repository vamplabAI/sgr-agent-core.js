import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";

/**
 * Data structure for reasoning tool results.
 */
export interface ReasoningToolData {
  reasoningSteps: string[];
  currentSituation: string;
  planStatus: string;
  enoughData: boolean;
  remainingSteps: string[];
  taskCompleted: boolean;
}

/**
 * Tool for agent reasoning phase.
 * Determines the next reasoning step with adaptive planning using schema-guided-reasoning.
 * This tool should be used before any other tool execution.
 */
export class ReasoningTool implements BaseTool {
  toolName = "reasoning";
  description = "Agent core logic determines the next reasoning step with adaptive planning by schema-guided-reasoning capabilities. Keep all text fields concise and focused. Usage: Required tool. Use this tool before any other tool execution";

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data?: ReasoningToolData
  ): Promise<string> {
    if (!data) {
      return JSON.stringify({
        reasoningSteps: [],
        currentSituation: "No data provided",
        planStatus: "Unknown",
        enoughData: false,
        remainingSteps: [],
        taskCompleted: false,
      });
    }
    return JSON.stringify(data, null, 2);
  }
}
