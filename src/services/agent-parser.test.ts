import { vi, describe, it, expect } from "vitest";
import { parseAgentFile } from "./agent-parser";
import { ParseError } from "@/types/errors";

// Mock Tauri FS plugin so readTextFile doesn't attempt real file system access
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));

describe("parseAgentFile", () => {
  it("parses a valid minimal agent markdown", async () => {
    const md = `---\nname: My Agent\n---\n# Instructions\nDo things\n`;
    const node = await parseAgentFile("/fake/agents/my-agent.md", md);
    expect(node.kind).toBe("agent");
    expect(node.name).toBe("My Agent");
    expect(node.config).not.toBeNull();
    expect((node.config as { name: string }).name).toBe("My Agent");
    expect(node.promptBody).toContain("# Instructions");
    expect(node.validationErrors).toHaveLength(0);
    expect(node.sourcePath).toBe("/fake/agents/my-agent.md");
  });

  it("parses a valid full agent with all optional fields", async () => {
    const md = `---\nname: Full Agent\ndescription: Does things\nmodel: claude-opus-4-5\npermissionMode: default\nmaxTurns: 10\ntools:\n  - Read\n  - Write\n---\nBody\n`;
    const node = await parseAgentFile("/fake/full.md", md);
    expect(node.validationErrors).toHaveLength(0);
    const config = node.config as { description?: string; model?: string };
    expect(config.description).toBe("Does things");
    expect(config.model).toBe("claude-opus-4-5");
  });

  it("falls back to titleCase of filename when no frontmatter", async () => {
    const md = `Just some text, no frontmatter`;
    const node = await parseAgentFile("/fake/agents/code-reviewer.md", md);
    expect(node.name).toBe("Code Reviewer");
  });

  it("returns validationErrors when permissionMode is invalid", async () => {
    const md = `---\nname: Bad Agent\npermissionMode: invalid-mode\n---\n`;
    const node = await parseAgentFile("/fake/bad.md", md);
    expect(node.validationErrors.length).toBeGreaterThan(0);
    expect(node.validationErrors.some((e) => e.includes("permissionMode"))).toBe(true);
  });

  it("rejects with ParseError on malformed YAML", async () => {
    const badYaml = `---\nname: [unclosed bracket\n---\n`;
    // Use a single rejection check to avoid gray-matter cache pollution across calls
    const err = await parseAgentFile("/fake/bad.md", badYaml).catch((e) => e);
    expect(err).toBeInstanceOf(ParseError);
    expect(err).toMatchObject({ kind: "parse" });
  });

  it("produces deterministic node IDs for the same path", async () => {
    const md = `---\nname: Test\n---\n`;
    const node1 = await parseAgentFile("/same/path.md", md);
    const node2 = await parseAgentFile("/same/path.md", md);
    expect(node1.id).toBe(node2.id);
  });
});
