import { BaseTool } from "./base-tool";

/**
 * NextStepTool represents the SGR schema structure that combines
 * ReasoningTool data with a selected tool (function).
 * This matches the Python version's NextStepTools structure.
 */
export interface NextStepTool {
  // ReasoningTool fields
  reasoningSteps: string[];
  currentSituation: string;
  planStatus: string;
  enoughData: boolean;
  remainingSteps: string[];
  taskCompleted: boolean;
  // Selected tool (discriminated union)
  function: {
    toolName: string;
    [key: string]: any;
  };
}

/**
 * Build JSON schema for NextStepTools structure.
 * This creates a discriminated union schema that combines ReasoningTool
 * with all available tools, similar to Python's NextStepToolsBuilder.
 */
export function buildNextStepToolsSchema(tools: BaseTool[]): any {
  // Base ReasoningTool schema
  const reasoningSchema = {
    type: "object",
    properties: {
      reasoningSteps: {
        type: "array",
        items: { type: "string" },
        description: "Step-by-step reasoning (brief, 1 sentence each)",
        minItems: 2,
        maxItems: 3,
      },
      currentSituation: {
        type: "string",
        description: "Current research situation (2-3 sentences MAX)",
        maxLength: 300,
      },
      planStatus: {
        type: "string",
        description: "Status of current plan (1 sentence)",
        maxLength: 150,
      },
      enoughData: {
        type: "boolean",
        description: "Sufficient data collected for comprehensive report?",
        default: false,
      },
      remainingSteps: {
        type: "array",
        items: { type: "string" },
        description: "1-3 remaining steps (brief, action-oriented)",
        minItems: 1,
        maxItems: 3,
      },
      taskCompleted: {
        type: "boolean",
        description: "Is the research task finished?",
      },
      function: {
        type: "object",
        description: "Select the appropriate tool for the next step",
        properties: {
          toolName: {
            type: "string",
            enum: tools.map((t) => t.toolName),
            description: "Tool name discriminator",
          },
        },
        required: ["toolName"],
        additionalProperties: true,
      },
    },
    required: [
      "reasoningSteps",
      "currentSituation",
      "planStatus",
      "enoughData",
      "remainingSteps",
      "taskCompleted",
      "function",
    ],
    additionalProperties: false,
  };

  return {
    name: "NextStepTools",
    description: "SGR Core - Determines the next reasoning step with adaptive planning, choosing appropriate tool",
    schema: reasoningSchema,
    strict: true,
  };
}

/**
 * Extract tool instance from NextStepTool function field.
 * This matches the Python version's behavior where reasoning.function
 * is already a BaseTool instance.
 */
export function extractToolFromNextStep(
  nextStep: NextStepTool,
  toolkit: BaseTool[]
): BaseTool | null {
  const toolName = nextStep.function.toolName;
  const tool = toolkit.find((t) => t.toolName === toolName);
  if (!tool) {
    return null;
  }
  return tool;
}
