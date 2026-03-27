import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Module-level mock state variable — must be declared before vi.mock calls
let mockProjectPath: string | null = "/mock/project";

// Mock Tauri FS plugin
const mockReadTextFile = vi.fn();
const mockWriteTextFile = vi.fn();
const mockExists = vi.fn();
const mockMkdir = vi.fn();

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
  exists: (...args: unknown[]) => mockExists(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Mock Tauri path API
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/mock/home"),
}));

// Mock Tauri shell plugin (used for openExternalUrl)
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));

// Mock tree store to provide projectPath
vi.mock("@/store/tree-store", () => ({
  useTreeStore: (selector: (s: { projectPath: string | null }) => unknown) =>
    selector({ projectPath: mockProjectPath }),
}));

// Mock toast to avoid portal/DOM side effects
vi.mock("@/components/common/Toast", () => ({
  toast: vi.fn(),
}));

import { SetupWizard } from "./SetupWizard";

describe("SetupWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectPath = "/mock/project";

    // Default: no .aui/settings.json → wizard shows
    mockExists.mockResolvedValue(false);
    // Default: reading any file returns empty JSON object
    mockReadTextFile.mockResolvedValue("{}");
    // Default: writes succeed
    mockWriteTextFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  it("renders step 1 with Welcome heading", async () => {
    render(<SetupWizard />);
    await waitFor(() =>
      expect(screen.getByText("Welcome to ATM")).toBeInTheDocument()
    );
    expect(screen.getByText("Anthropic API Key")).toBeInTheDocument();
  });

  it("advances to step 2 on Skip click", async () => {
    render(<SetupWizard />);
    await waitFor(() => screen.getByText("Welcome to ATM"));

    await userEvent.click(screen.getByText("Skip"));

    await waitFor(() =>
      expect(screen.getByText("Claude Code Agent Teams")).toBeInTheDocument()
    );
  });

  it("step 2 shows teams enabled when settings have teams flag", async () => {
    // .aui/settings.json does NOT exist (wizard shows), but .claude/settings.json DOES exist
    mockExists.mockImplementation((path: string) => {
      if (path.includes(".aui/settings.json")) return Promise.resolve(false);
      if (path.includes(".claude/settings.json")) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    mockReadTextFile.mockImplementation((path: string) => {
      if (path.includes(".claude/settings.json")) {
        return Promise.resolve(
          '{"env":{"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS":"1"}}'
        );
      }
      return Promise.resolve("{}");
    });

    render(<SetupWizard />);
    await waitFor(() => screen.getByText("Welcome to ATM"));

    await userEvent.click(screen.getByText("Skip"));

    await waitFor(() =>
      expect(screen.getByText("Agent teams are enabled!")).toBeInTheDocument()
    );
  });

  it("advances to step 3 and shows summary heading", async () => {
    render(<SetupWizard />);
    await waitFor(() => screen.getByText("Welcome to ATM"));

    // Navigate to step 2
    await userEvent.click(screen.getByText("Skip"));
    await waitFor(() => screen.getByText("Claude Code Agent Teams"));

    // Navigate to step 3
    await userEvent.click(screen.getByText("Next"));

    await waitFor(() =>
      expect(screen.getByText(/all set/i)).toBeInTheDocument()
    );
  });

  it("Get Started completes setup and hides wizard", async () => {
    render(<SetupWizard />);
    await waitFor(() => screen.getByText("Welcome to ATM"));

    // Navigate to step 2
    await userEvent.click(screen.getByText("Skip"));
    await waitFor(() => screen.getByText("Claude Code Agent Teams"));

    // Navigate to step 3
    await userEvent.click(screen.getByText("Next"));
    await waitFor(() => screen.getByText(/all set/i));

    // Click Get Started
    await userEvent.click(screen.getByText("Get Started"));

    await waitFor(() =>
      expect(screen.queryByText(/all set/i)).not.toBeInTheDocument()
    );

    // Verify writeTextFile was called with setupCompleted
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      expect.stringContaining("settings.json"),
      expect.stringContaining("setupCompleted")
    );
  });

  it("step 2 shows error fallback on read failure", async () => {
    // .aui/settings.json does not exist (wizard shows)
    mockExists.mockImplementation((path: string) => {
      if (path.includes(".aui/settings.json")) return Promise.resolve(false);
      if (path.includes(".claude/settings.json")) return Promise.resolve(true);
      return Promise.resolve(false);
    });
    // Reading .claude/settings.json throws an error
    mockReadTextFile.mockImplementation((path: string) => {
      if (path.includes(".claude/settings.json")) {
        return Promise.reject(new Error("File read failure"));
      }
      return Promise.resolve("{}");
    });

    render(<SetupWizard />);
    await waitFor(() => screen.getByText("Welcome to ATM"));

    await userEvent.click(screen.getByText("Skip"));

    // The text is split across a <p> with inline <code> — use container query
    await waitFor(() => {
      const match = screen.getAllByText(/Could not read/i, { exact: false });
      expect(match.length).toBeGreaterThan(0);
    });
  });
});
