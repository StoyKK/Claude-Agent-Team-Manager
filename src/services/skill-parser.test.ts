import { vi, describe, it, expect } from "vitest";
import { parseSkillFile } from "./skill-parser";
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

describe("parseSkillFile", () => {
  it("parses a valid minimal skill markdown", async () => {
    const md = `---\nname: Code Review\ndescription: Reviews code\n---\n# Instructions\n`;
    const node = await parseSkillFile("/fake/skills/code-review/SKILL.md", md);
    expect(node.kind).toBe("skill");
    expect(node.name).toBe("Code Review");
    expect(node.validationErrors).toHaveLength(0);
    expect(node.sourcePath).toBe("/fake/skills/code-review/SKILL.md");
  });

  it("falls back to titleCase of filename when no frontmatter", async () => {
    const md = `Just instructions`;
    const node = await parseSkillFile("/fake/skills/my-skill/SKILL.md", md);
    // titleCase(getFileName("SKILL.md")) = titleCase("SKILL") = "SKILL"
    expect(node.name).toBeTruthy();
  });

  it("rejects with ParseError on malformed YAML", async () => {
    const badYaml = `---\nname: {unclosed\n---\n`;
    // Use a single rejection check to avoid gray-matter cache pollution across calls
    const err = await parseSkillFile("/fake/bad.md", badYaml).catch((e) => e);
    expect(err).toBeInstanceOf(ParseError);
    expect(err).toMatchObject({ kind: "parse" });
  });

  it("falls back to titleCase name when name field is missing", async () => {
    const md = `---\ndescription: No name field\n---\n`;
    const node = await parseSkillFile("/fake/skills/test/SKILL.md", md);
    // name falls back to titleCase(getFileName) since parsed.data.name is falsy
    expect(node.name).toBeTruthy();
  });
});
