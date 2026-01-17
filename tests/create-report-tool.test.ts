import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import { CreateReportTool, CreateReportToolData } from "../src/tools/create-report-tool";
import { AgentConfig } from "../src/config";
import { createAgentContext, AgentContext } from "../src/models";

describe("CreateReportTool", () => {
  let tool: CreateReportTool;
  let config: AgentConfig;
  let context: AgentContext;
  const testReportsDir = path.join(__dirname, "test-reports");

  beforeEach(() => {
    tool = new CreateReportTool();
    config = {
      llm: {
        apiKey: "test-key",
        model: "gpt-4o-mini",
      },
      execution: {
        reportsDir: testReportsDir,
      },
    };
    context = createAgentContext();
  });

  afterEach(() => {
    // Clean up test reports directory
    if (fs.existsSync(testReportsDir)) {
      const files = fs.readdirSync(testReportsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testReportsDir, file));
      }
      fs.rmdirSync(testReportsDir);
    }
  });

  describe("execute", () => {
    it("should create report with all fields provided", async () => {
      const data: CreateReportToolData = {
        reasoning: "Test reasoning",
        title: "Test Report",
        userRequestLanguageReference: "English",
        content: "This is test content",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Test Report");
      expect(report.content).toBe("This is test content");
      expect(report.confidence).toBe("high");
      expect(report.sourcesCount).toBe(0);
      expect(report.filepath).toContain("Test_Report");
      expect(report.filepath).toMatch(/\.md$/);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle undefined title field", async () => {
      const data: CreateReportToolData = {
        reasoning: "Test reasoning",
        userRequestLanguageReference: "English",
        content: "This is test content",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Untitled Report");
      expect(report.content).toBe("This is test content");
      expect(report.filepath).toContain("report");
      expect(report.filepath).toMatch(/\.md$/);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle undefined content field", async () => {
      const data: CreateReportToolData = {
        reasoning: "Test reasoning",
        title: "Test Report",
        userRequestLanguageReference: "English",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Test Report");
      expect(report.content).toBe("");
      expect(report.wordCount).toBe(0);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle undefined reasoning field", async () => {
      const data: CreateReportToolData = {
        title: "Test Report",
        userRequestLanguageReference: "English",
        content: "This is test content",
        confidence: "high",
      };

      // Should not throw error
      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Test Report");
      expect(report.content).toBe("This is test content");
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle undefined userRequestLanguageReference field", async () => {
      const data: CreateReportToolData = {
        reasoning: "Test reasoning",
        title: "Test Report",
        content: "This is test content",
        confidence: "high",
      };

      // Should not throw error
      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Test Report");
      expect(report.content).toBe("This is test content");
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle undefined confidence field", async () => {
      const data: CreateReportToolData = {
        reasoning: "Test reasoning",
        title: "Test Report",
        userRequestLanguageReference: "English",
        content: "This is test content",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.confidence).toBe("medium");
      expect(report.title).toBe("Test Report");
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle all undefined fields", async () => {
      const data: CreateReportToolData = {};

      // Should not throw error
      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Untitled Report");
      expect(report.content).toBe("");
      expect(report.confidence).toBe("medium");
      expect(report.wordCount).toBe(0);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should handle empty title string", async () => {
      const data: CreateReportToolData = {
        title: "",
        content: "Test content",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.title).toBe("Untitled Report");
      expect(report.filepath).toContain("report");
      expect(report.filepath).toMatch(/\.md$/);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });

    it("should include sources in report when available", async () => {
      context.sources.set("source1", {
        number: 1,
        title: "Test Source",
        url: "https://example.com",
        snippet: "Test snippet",
        fullContent: "Full content",
        charCount: 12,
      });

      const data: CreateReportToolData = {
        title: "Test Report",
        content: "Test content",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.sourcesCount).toBe(1);
      
      // Check that file contains sources section
      const fileContent = fs.readFileSync(report.filepath, "utf-8");
      expect(fileContent).toContain("## Sources");
      expect(fileContent).toContain("[1] Test Source - https://example.com");
    });

    it("should sanitize title for filename", async () => {
      const data: CreateReportToolData = {
        title: "Test/Report: With Special*Chars?",
        content: "Test content",
        confidence: "high",
      };

      const result = await tool.execute(context, config, data);
      const report = JSON.parse(result);

      expect(report.filepath).toContain("TestReport_With_SpecialChars");
      expect(report.filepath).toMatch(/\.md$/);
      expect(fs.existsSync(report.filepath)).toBe(true);
    });
  });
});
