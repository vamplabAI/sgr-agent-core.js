import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";

export interface AdaptPlanToolData {
  reasoning: string;
  originalGoal: string;
  newGoal: string;
  planChanges: string[];
  nextSteps: string[];
}

/**
 * Tool for adapting a research plan based on new findings.
 */
export class AdaptPlanTool implements BaseTool {
  toolName = "adapt_plan";
  description = "Adapt a research plan based on new findings.";

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: AdaptPlanToolData
  ): Promise<string> {
    // Return plan adaptation data (excluding reasoning as in Python version)
    const result = {
      originalGoal: data.originalGoal,
      newGoal: data.newGoal,
      planChanges: data.planChanges,
      nextSteps: data.nextSteps,
    };

    return JSON.stringify(result, null, 2);
  }
}
