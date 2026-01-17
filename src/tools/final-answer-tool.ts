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
    let finalData: FinalAnswerToolData;
    
    if (data && data.arguments && typeof data.arguments === 'object') {
      // Handle nested structure: { arguments: { answer: "...", ... } }
      const args = data.arguments;
      finalData = {
        reasoning: args.reasoning || "Task completed",
        completedSteps: args.completedSteps || args.completed_steps || ["Completed"],
        answer: args.answer || "",
        status: args.status || AgentStatesEnum.COMPLETED,
      };
    } else if (data && typeof data === 'object') {
      // Handle direct structure
      finalData = {
        reasoning: data.reasoning || "Task completed",
        completedSteps: data.completedSteps || data.completed_steps || ["Completed"],
        answer: data.answer || "",
        status: data.status || AgentStatesEnum.COMPLETED,
      };
    } else {
      // Fallback for unexpected structures
      finalData = {
        reasoning: "Task completed",
        completedSteps: ["Completed"],
        answer: typeof data === 'string' ? data : JSON.stringify(data),
        status: AgentStatesEnum.COMPLETED,
      };
    }
    
    // Provide default answer if missing (try to extract from reasoning or use fallback)
    if (!finalData.answer || finalData.answer.trim() === "") {
      // Try to extract answer from reasoning or use a default
      const defaultAnswer = finalData.reasoning 
        ? `Based on the reasoning: ${finalData.reasoning.substring(0, 200)}`
        : "Task completed successfully";
      finalData.answer = defaultAnswer;
    }
    
    // Set state to COMPLETED if not explicitly set to FAILED
    if (!finalData.status || finalData.status !== AgentStatesEnum.FAILED) {
      finalData.status = AgentStatesEnum.COMPLETED;
    }
    
    // CRITICAL: Set context state to COMPLETED to stop execution loop
    context.state = finalData.status;
    context.executionResult = finalData.answer;
    
    return JSON.stringify(finalData, null, 2);
  }
}
