import { AgentConfig } from "../config";
import { AgentContext, AgentStatesEnum } from "../models";
import { BaseTool } from "../base-tool";

/**
 * Data structure for final answer tool.
 */
export interface FinalAnswerToolData {
  reasoning: string;
  completedSteps: string[];
  answer: string;
  status: AgentStatesEnum.COMPLETED | AgentStatesEnum.FAILED;
}

/**
 * Tool for finalizing agent execution and providing final answer.
 * Should be called after all steps are completed and agent is ready to finalize.
 */
export class FinalAnswerTool implements BaseTool {
  toolName = "final_answer";
  description = "Finalize a task and complete agent execution after all steps are completed. Usage: Call after you are ready to finalize your work and provide the final answer to the user.";

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: FinalAnswerToolData
  ): Promise<string> {
    context.state = data.status;
    context.executionResult = data.answer;
    return JSON.stringify(data, null, 2);
  }
}
