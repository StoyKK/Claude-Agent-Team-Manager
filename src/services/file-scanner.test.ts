import { vi, describe, it, expect, beforeEach } from "vitest";

// vi.mock must be called before imports that depend on the mocked module
vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: vi.fn(),
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
}));

import { exists, readDir } from "@tauri-apps/plugin-fs";
import { scanProject } from "./file-scanner";
import { ScanError } from "@/types/errors";

/** Helper to configure exists mock to return true only for the given paths */
function mockExistsPaths(paths: string[]) {
  vi.mocked(exists).mockImplementation(async (p: unknown) =>
    paths.includes(p as string)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scanProject", () => {
  it("returns empty array when no known files exist", async () => {
    vi.mocked(exists).mockResolvedValue(false);
    const result = await scanProject("/fake/project");
    expect(result).toEqual([]);
  });

  it("includes CLAUDE.md when it exists at project root", async () => {
    mockExistsPaths(["/fake/project/CLAUDE.md"]);
    const result = await scanProject("/fake/project");
    expect(result).toContain("/fake/project/CLAUDE.md");
  });

  it("includes CLAUDE.local.md when it exists at project root", async () => {
    mockExistsPaths(["/fake/project/CLAUDE.local.md"]);
    const result = await scanProject("/fake/project");
    expect(result).toContain("/fake/project/CLAUDE.local.md");
  });

  it("includes .md agent files from .claude/agents/ directory", async () => {
    const agentsDir = "/fake/project/.claude/agents";
    mockExistsPaths([agentsDir]);
    vi.mocked(readDir).mockResolvedValue([
      { name: "coder.md", isFile: true, isDirectory: false, isSymlink: false },
      { name: "reviewer.md", isFile: true, isDirectory: false, isSymlink: false },
      { name: "notes.txt", isFile: true, isDirectory: false, isSymlink: false },
    ] as any);

    const result = await scanProject("/fake/project");
    expect(result).toContain(`${agentsDir}/coder.md`);
    expect(result).toContain(`${agentsDir}/reviewer.md`);
    expect(result).not.toContain(`${agentsDir}/notes.txt`);
  });

  it("includes SKILL.md files inside skill subdirectories", async () => {
    const skillsDir = "/fake/project/.claude/skills";
    const skillFile = `${skillsDir}/my-skill/SKILL.md`;
    mockExistsPaths([skillsDir, skillFile]);
    vi.mocked(readDir).mockResolvedValue([
      {
        name: "my-skill",
        isFile: false,
        isDirectory: true,
        isSymlink: false,
      },
    ] as any);

    const result = await scanProject("/fake/project");
    expect(result).toContain(skillFile);
  });

  it("includes settings.json when it exists in .claude/", async () => {
    const settingsPath = "/fake/project/.claude/settings.json";
    mockExistsPaths([settingsPath]);
    const result = await scanProject("/fake/project");
    expect(result).toContain(settingsPath);
  });

  it("wraps readDir failures in ScanError with kind 'scan'", async () => {
    const agentsDir = "/fake/project/.claude/agents";
    mockExistsPaths([agentsDir]);
    vi.mocked(readDir).mockRejectedValue(new Error("Permission denied"));

    const err = await scanProject("/fake/project").catch((e) => e);
    expect(err).toBeInstanceOf(ScanError);
    expect(err).toMatchObject({ kind: "scan" });
  });
});
