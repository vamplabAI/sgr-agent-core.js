/**
 * Configuration for LLM (Large Language Model) settings.
 */
export interface LLMConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  /**
   * Proxy URL for HTTP requests.
   * Supports formats: http://host:port, https://host:port, socks5://host:port
   * Example: "http://127.0.0.1:8080" or "socks5://127.0.0.1:1080"
   */
  proxy?: string;
}

/**
 * Configuration for agent execution parameters and limits.
 */
export interface ExecutionConfig {
  maxIterations?: number;
  maxClarifications?: number;
  /**
   * Enable streaming responses from LLM.
   * When enabled, streaming callbacks will be called with chunks as they arrive.
   */
  enableStreaming?: boolean;
  /**
   * Directory for saving reports.
   * Default: "reports"
   */
  reportsDir?: string;
  /**
   * Maximum number of retries for tool execution when validation errors occur.
   * Retries are only performed for format/validation errors, not for other errors.
   * Default: 2
   */
  maxToolRetries?: number;
}

/**
 * Configuration for prompt templates.
 */
export interface PromptsConfig {
  systemPrompt?: string;
  initialUserRequest?: string;
  clarificationResponse?: string;
}

/**
 * Configuration for search service (Tavily).
 */
export interface SearchConfig {
  tavilyApiKey?: string;
  tavilyApiBaseUrl?: string;
  maxSearches?: number;
  maxResults?: number;
  contentLimit?: number;
}

/**
 * Complete agent configuration including LLM, execution, prompts, and search settings.
 */
export interface AgentConfig {
  llm: LLMConfig;
  execution?: ExecutionConfig;
  prompts?: PromptsConfig;
  search?: SearchConfig;
}
