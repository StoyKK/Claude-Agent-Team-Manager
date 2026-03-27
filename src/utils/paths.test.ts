import { normalizePath, getFileName, titleCase, generateNodeId, joinPath, join } from "./paths";

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\me\\project")).toBe("C:/Users/me/project");
  });

  it("leaves forward slashes unchanged", () => {
    expect(normalizePath("/already/forward")).toBe("/already/forward");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePath("")).toBe("");
  });
});

describe("getFileName", () => {
  it("extracts filename without extension", () => {
    expect(getFileName("/path/to/my-agent.md")).toBe("my-agent");
  });

  it("returns full name when there is no extension", () => {
    expect(getFileName("/path/to/README")).toBe("README");
  });

  it("handles Windows paths with backslashes", () => {
    expect(getFileName("C:\\agents\\bot.md")).toBe("bot");
  });

  it("returns full dotfile name (leading dot is not treated as extension separator)", () => {
    expect(getFileName("/path/.gitignore")).toBe(".gitignore");
  });
});

describe("titleCase", () => {
  it("converts kebab-case to Title Case", () => {
    expect(titleCase("my-agent")).toBe("My Agent");
  });

  it("converts snake_case to Title Case", () => {
    expect(titleCase("my_skill_name")).toBe("My Skill Name");
  });

  it("capitalizes a single word", () => {
    expect(titleCase("already")).toBe("Already");
  });
});

describe("generateNodeId", () => {
  it("returns the same ID when called twice with the same path (deterministic)", () => {
    const path = "/project/.claude/agents/a.md";
    expect(generateNodeId(path)).toBe(generateNodeId(path));
  });

  it("normalizes backslashes before hashing (Windows and POSIX paths produce same ID)", () => {
    expect(generateNodeId("C:\\project\\agent.md")).toBe(generateNodeId("C:/project/agent.md"));
  });

  it("returns a base-36 string (only lowercase alphanumeric characters)", () => {
    const id = generateNodeId("/project/.claude/agents/a.md");
    expect(id).toMatch(/^[0-9a-z]+$/);
  });
});

describe("joinPath", () => {
  it("joins two simple segments with a forward slash", () => {
    expect(joinPath("a", "b")).toBe("a/b");
  });

  it("collapses double slashes when one segment ends with slash and next starts with slash", () => {
    expect(joinPath("a/", "/b")).toBe("a/b");
  });

  it("normalizes backslashes in all segments", () => {
    expect(joinPath("a\\b", "c\\d")).toBe("a/b/c/d");
  });

  it("joins three segments correctly", () => {
    expect(joinPath("/root", ".claude", "agents")).toBe("/root/.claude/agents");
  });
});

describe("join alias", () => {
  it("is the exact same function reference as joinPath", () => {
    expect(join).toBe(joinPath);
  });
});
