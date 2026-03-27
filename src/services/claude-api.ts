/**
 * Claude CLI wrapper — generates text via `claude --print`.
 * No API key needed; uses the locally installed Claude Code CLI.
 */
export async function generateWithClaude(prompt: string): Promise<string> {
  const { Command } = await import("@tauri-apps/plugin-shell");
  const cmd = Command.create("claude", ["--print", prompt]);
  const output = await cmd.execute();

  if (output.code !== 0) {
    const err = output.stderr.trim() || "Claude CLI exited with an error";
    throw new Error(err);
  }

  return output.stdout.trim();
}
