/**
 * Agent execution states.
 */
export enum AgentStatesEnum {
  INITED = "inited",
  RESEARCHING = "researching",
  WAITING_FOR_CLARIFICATION = "waiting_for_clarification",
  COMPLETED = "completed",
  ERROR = "error",
  FAILED = "failed",
}

/**
 * Set of states that indicate agent execution has finished.
 */
export const FINISH_STATES = new Set([
  AgentStatesEnum.COMPLETED,
  AgentStatesEnum.FAILED,
  AgentStatesEnum.ERROR,
]);

/**
 * Data about a research source.
 */
export interface SourceData {
  number: number;
  title: string | null;
  url: string;
  snippet: string;
  fullContent: string;
  charCount: number;
}

/**
 * Search result with query, answer, and sources.
 */
export interface SearchResult {
  query: string;
  answer: string | null;
  citations: SourceData[];
  timestamp: Date;
}

/**
 * Agent execution context containing state, iterations, results, and other runtime data.
 */
export interface AgentContext {
  currentStepReasoning: any | null;
  executionResult: string | null;
  state: AgentStatesEnum;
  iteration: number;
  searches: SearchResult[];
  sources: Map<string, SourceData>;
  searchesUsed: number;
  clarificationsUsed: number;
  customContext?: any;
}

/**
 * Create a new agent context with default values.
 * @returns New AgentContext instance
 */
export function createAgentContext(): AgentContext {
  return {
    currentStepReasoning: null,
    executionResult: null,
    state: AgentStatesEnum.INITED,
    iteration: 0,
    searches: [],
    sources: new Map(),
    searchesUsed: 0,
    clarificationsUsed: 0,
  };
}
