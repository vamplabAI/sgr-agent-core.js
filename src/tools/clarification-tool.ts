import { AgentConfig } from "../config";
import { AgentContext } from "../models";
import { BaseTool } from "../base-tool";
import { AgentStatesEnum } from "../models";

export interface ClarificationToolData {
  reasoning: string;
  unclearTerms: string[];
  assumptions: string[];
  questions: string[];
}

/**
 * Tool for asking clarifying questions when facing an ambiguous request.
 * Keep all fields concise - brief reasoning, short terms, and clear questions.
 */
export class ClarificationTool implements BaseTool {
  toolName = "clarification";
  description = `Ask clarifying questions when facing an ambiguous request.

Keep all fields concise - brief reasoning, short terms, and clear questions.`;

  async execute(
    context: AgentContext,
    config: AgentConfig,
    data: ClarificationToolData
  ): Promise<string> {
    // Set state to waiting for clarification
    context.state = AgentStatesEnum.WAITING_FOR_CLARIFICATION;
    context.clarificationsUsed += 1;

    // Return questions as formatted string
    return data.questions.join("\n");
  }
}
