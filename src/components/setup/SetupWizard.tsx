import { useState, useEffect } from "react";
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { useTreeStore } from "@/store/tree-store";
import { join } from "@/utils/paths";
import { toast } from "@/components/common/Toast";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";
import { homeDir } from "@tauri-apps/api/path";

type Step = 1 | 2;

export function SetupWizard() {
  const projectPath = useTreeStore((s) => s.projectPath);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>(1);

  // Step 1 state (agent teams)
  const [teamsEnabled, setTeamsEnabled] = useState<boolean | null>(null);
  const [teamsError, setTeamsError] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Check if wizard should show (uses global ~/.aui/settings.json)
  useEffect(() => {
    if (!projectPath) return;
    (async () => {
      try {
        const settings = await readAuiSettings();
        if (settings.setupCompleted === true) return;
        setVisible(true);
      } catch {
        setVisible(true);
      }
    })();
  }, [projectPath]);

  // Check agent teams status when entering step 1
  useEffect(() => {
    if (step !== 1 || !projectPath) return;
    (async () => {
      try {
        const claudeSettingsPath = join(projectPath, ".claude", "settings.json");
        let found = false;

        // Try project-level first
        if (await exists(claudeSettingsPath)) {
          const raw = await readTextFile(claudeSettingsPath);
          const settings = parseJsonc(raw, [], { allowTrailingComma: true });
          const val = settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
          if (val !== undefined) {
            setTeamsEnabled(val === "1");
            found = true;
          }
        }

        // Fall back to global ~/.claude/settings.json if key not found
        if (!found) {
          try {
            const home = await homeDir();
            const globalPath = join(home, ".claude", "settings.json");
            if (await exists(globalPath)) {
              const raw = await readTextFile(globalPath);
              const settings = parseJsonc(raw, [], { allowTrailingComma: true });
              const val = settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
              setTeamsEnabled(val === "1");
              found = true;
            }
          } catch {
            // Global fallback failure is non-fatal
          }
        }

        if (!found) {
          setTeamsEnabled(false);
        }
        setTeamsError(false);
      } catch {
        setTeamsEnabled(null);
        setTeamsError(true);
      }
    })();
  }, [step, projectPath]);

  if (!visible || !projectPath) return null;

  // -- Helpers --
  // Global settings live in ~/.aui/settings.json (not per-project)

  async function globalSettingsPath(): Promise<string> {
    const home = await homeDir();
    return `${home.replace(/[\\/]+$/, "")}/.aui/settings.json`;
  }

  async function ensureGlobalAuiDir() {
    const home = await homeDir();
    const auiDir = `${home.replace(/[\\/]+$/, "")}/.aui`;
    if (!(await exists(auiDir))) {
      await mkdir(auiDir, { recursive: true });
    }
  }

  async function readAuiSettings(): Promise<Record<string, unknown>> {
    try {
      const path = await globalSettingsPath();
      if (await exists(path)) {
        return JSON.parse(await readTextFile(path));
      }
    } catch { /* ignore */ }
    return {};
  }

  async function writeAuiSettings(data: Record<string, unknown>) {
    await ensureGlobalAuiDir();
    const path = await globalSettingsPath();
    await writeTextFile(path, JSON.stringify(data, null, 2));
  }

  // -- Step 1 handler (enable teams) --

  async function handleEnableTeams() {
    if (!projectPath) return;
    setEnabling(true);
    try {
      const claudeSettingsPath = join(projectPath, ".claude", "settings.json");
      let raw = "{}";
      if (await exists(claudeSettingsPath)) {
        raw = await readTextFile(claudeSettingsPath);
      }
      const edits = modify(
        raw,
        ["env", "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"],
        "1",
        { formattingOptions: { insertSpaces: true, tabSize: 2 } }
      );
      const updated = applyEdits(raw, edits);
      await writeTextFile(claudeSettingsPath, updated);
      setTeamsEnabled(true);
      setTeamsError(false);
      toast("Agent teams enabled!", "success");
    } catch {
      toast("Could not enable agent teams \u2014 check that ~/.claude/settings.json is writable", "error");
      setTeamsError(true);
    } finally {
      setEnabling(false);
    }
  }

  // -- Step 2 handler (get started) --

  async function handleGetStarted() {
    try {
      const settings = await readAuiSettings();
      settings.setupCompleted = true;
      await writeAuiSettings(settings);
      setVisible(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast(`Could not complete setup: ${msg}`, "error");
    }
  }

  // -- Styles --

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20000,
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 480,
    width: "90%",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: 12,
    padding: "32px 28px 24px",
    color: "var(--text-primary)",
    position: "relative",
  };

  const primaryBtnStyle: React.CSSProperties = {
    background: "var(--accent-blue)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-color)",
    borderRadius: 6,
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  };

  // -- Step indicator --

  function StepDots() {
    return (
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
        {([1, 2] as Step[]).map((s) => (
          <div
            key={s}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: s === step ? "var(--accent-blue)" : "var(--border-color)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
    );
  }

  // -- Step content --

  function renderStep1() {
    return (
      <>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
          Welcome to ATM
        </h2>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)" }}>
          Agent Team Manager
        </p>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Organize your Claude Code agents into super teams that work in parallel.
        </p>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-primary)",
            marginBottom: 20,
          }}
        >
          {teamsError ? (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Could not read Claude settings. You can enable agent teams manually by adding
                this to <code style={{ color: "var(--accent-blue)" }}>~/.claude/settings.json</code>:
              </p>
              <pre
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: "var(--text-primary)",
                  background: "var(--bg-secondary)",
                  padding: "8px 10px",
                  borderRadius: 4,
                  overflow: "auto",
                }}
              >
{`{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}`}
              </pre>
            </>
          ) : teamsEnabled === true ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--accent-green)", fontSize: 20 }}>&#10003;</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Agent teams are enabled!</span>
            </div>
          ) : teamsEnabled === false ? (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Agent teams are not currently enabled in your Claude Code settings.
              </p>
              <button
                onClick={handleEnableTeams}
                disabled={enabling}
                style={{
                  ...primaryBtnStyle,
                  opacity: enabling ? 0.6 : 1,
                  cursor: enabling ? "not-allowed" : "pointer",
                }}
              >
                {enabling ? "Enabling..." : "Enable Teams"}
              </button>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
              Checking team status...
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setStep(2)} style={primaryBtnStyle}>
            Next
          </button>
        </div>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>
          You're all set!
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          ATM is ready to help you manage your AI agent teams.
        </p>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            background: "var(--bg-primary)",
            marginBottom: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <span style={{ color: teamsEnabled ? "var(--accent-green)" : "var(--text-secondary)", fontSize: 16 }}>
              {teamsEnabled ? "\u2713" : "\u2013"}
            </span>
            <span>
              {teamsEnabled ? "Agent teams enabled" : "Agent teams not enabled"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setStep(1)} style={secondaryBtnStyle}>
            Back
          </button>
          <button onClick={handleGetStarted} style={primaryBtnStyle}>
            Get Started
          </button>
        </div>
      </>
    );
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <StepDots />
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </div>
    </div>
  );
}
