import { AgentConfig } from "../config";
import { AgentContext, AgentStatesEnum } from "../models";
import { BaseTool } from "../base-tool";

/**
 * Data structure for final answer tool.
 */
export interface FinalAnswerToolData {
  reasoning?: string;
  completedSteps?: string[];
  answer?: string;
  status?: AgentStatesEnum.COMPLETED | AgentStatesEnum.FAILED;
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
    data: FinalAnswerToolData | any
  ): Promise<string> {
    // Handle different data structures (some LLMs return nested structures)
    let rawReasoning: string | undefined;
    let rawCompletedSteps: string[] | undefined;
    let rawAnswer: string | undefined;
    let rawStatus: AgentStatesEnum.COMPLETED | AgentStatesEnum.FAILED | undefined;
    
    if (data && data.arguments && typeof data.arguments === 'object') {
      // Handle nested structure: { arguments: { answer: "...", ... } }
      const args = data.arguments;
      rawReasoning = args.reasoning;
      rawCompletedSteps = args.completedSteps || args.completed_steps;
      rawAnswer = args.answer;
      rawStatus = args.status;
    } else if (data && typeof data === 'object') {
      // Handle direct structure
      rawReasoning = data.reasoning;
      rawCompletedSteps = data.completedSteps || data.completed_steps;
      rawAnswer = data.answer;
      rawStatus = data.status;
    } else if (typeof data === 'string') {
      // If data is a string, use it as answer
      rawAnswer = data;
    }
    
    // Provide default values (matches Python Pydantic validation behavior)
    const reasoning = rawReasoning || "Task completed";
    const completedSteps = rawCompletedSteps || ["Completed"];
    // Use reasoning as fallback if answer is missing (some models don't provide answer field)
    // If both are missing, use a default message
    const answer = rawAnswer || (rawReasoning ? rawReasoning : "Task completed successfully");
    const status = rawStatus || AgentStatesEnum.COMPLETED;
    
    const finalStatus = status !== AgentStatesEnum.FAILED ? AgentStatesEnum.COMPLETED : AgentStatesEnum.FAILED;
    
    const finalData: FinalAnswerToolData = {
      reasoning,
      completedSteps,
      answer,
      status: finalStatus,
    };
    
    // CRITICAL: Set context state to COMPLETED to stop execution loop
    context.state = finalStatus;
    context.executionResult = answer;
    
    return JSON.stringify(finalData, null, 2);
  }
}
