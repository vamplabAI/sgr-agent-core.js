import OpenAI from "openai";
import { LLMConfig } from "./config";

/**
 * Create OpenAI client with optional proxy support.
 * @param config - LLM configuration including optional proxy
 * @returns Configured OpenAI client instance
 */
export function createOpenAIClient(config: LLMConfig): OpenAI {
  const clientConfig: any = {
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  };

  // Add proxy support if specified
  if (config.proxy) {
    // For Node.js environment, use proxy agents
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        // Try to load proxy agents (optional dependencies)
        let HttpsProxyAgent: any;
        let HttpProxyAgent: any;
        let SocksProxyAgent: any;

        try {
          HttpsProxyAgent = require("https-proxy-agent").HttpsProxyAgent;
        } catch {
          // Package not installed
        }

        try {
          HttpProxyAgent = require("http-proxy-agent").HttpProxyAgent;
        } catch {
          // Package not installed
        }

        try {
          SocksProxyAgent = require("socks-proxy-agent").SocksProxyAgent;
        } catch {
          // Package not installed
        }

        const proxyUrl = config.proxy;
        let agent: any = null;

        if (proxyUrl.startsWith("socks5://") || proxyUrl.startsWith("socks4://")) {
          if (!SocksProxyAgent) {
            throw new Error(
              "socks-proxy-agent package is required for SOCKS proxy. " +
              "Install it with: npm install socks-proxy-agent"
            );
          }
          agent = new SocksProxyAgent(proxyUrl);
        } else if (proxyUrl.startsWith("https://")) {
          if (!HttpsProxyAgent) {
            throw new Error(
              "https-proxy-agent package is required for HTTPS proxy. " +
              "Install it with: npm install https-proxy-agent"
            );
          }
          agent = new HttpsProxyAgent(proxyUrl);
        } else {
          // Default to HTTP proxy
          if (!HttpProxyAgent) {
            throw new Error(
              "http-proxy-agent package is required for HTTP proxy. " +
              "Install it with: npm install http-proxy-agent"
            );
          }
          agent = new HttpProxyAgent(proxyUrl);
        }

        clientConfig.httpAgent = agent;
        clientConfig.httpsAgent = agent;
      } catch (error: any) {
        throw new Error(
          `Failed to configure proxy: ${error.message}. ` +
          `Make sure to install the required proxy agent packages.`
        );
      }
    } else {
      // For browser or other environments, proxy should be handled by the environment
      console.warn("Proxy configuration is only supported in Node.js environment");
    }
  }

  return new OpenAI(clientConfig);
}
