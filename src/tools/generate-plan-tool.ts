import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";

export interface GeneratePlanToolData {
  reasoning: string;
  researchGoal: string;
  plannedSteps: string[];
  searchStrategies: string[];
}

/**
 * Tool for generating a research plan.
 * Useful to split complex request into manageable steps.
 */
export class GeneratePlanTool implements BaseTool {
  toolName = "generate_plan";
  description = `Generate a research plan.

Useful to split complex request into manageable steps.`;

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: GeneratePlanToolData
  ): Promise<string> {
    // Return plan data (excluding reasoning as in Python version)
    const result = {
      researchGoal: data.researchGoal,
      plannedSteps: data.plannedSteps,
      searchStrategies: data.searchStrategies,
    };

    return JSON.stringify(result, null, 2);
  }
}
