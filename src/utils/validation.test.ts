import { validateAgentConfig, validateSkillConfig, validateSettingsConfig } from "./validation";

describe("validateAgentConfig", () => {
  it("returns success for a valid minimal config with only the required name field", () => {
    const result = validateAgentConfig({ name: "My Agent" });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.name).toBe("My Agent");
  });

  it("returns success for a valid full config with all optional fields populated", () => {
    const result = validateAgentConfig({
      name: "Full Agent",
      description: "Does things",
      model: "claude-opus-4-5",
      permissionMode: "default",
      maxTurns: 10,
      tools: ["Read", "Write"],
      skills: ["code-review"],
      color: "#ff0000",
      hooks: { onStart: "echo hi" },
      allowedCommands: ["git status"],
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns failure when the required name field is missing", () => {
    const result = validateAgentConfig({});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("name");
  });

  it("returns failure and mentions permissionMode when given an invalid enum value", () => {
    const result = validateAgentConfig({ name: "Test", permissionMode: "invalid" });
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("permissionMode"))).toBe(true);
  });

  it("accepts all valid permissionMode enum values", () => {
    const modes = ["default", "acceptEdits", "bypassPermissions", "plan", "dontAsk"];
    for (const mode of modes) {
      const result = validateAgentConfig({ name: "Test", permissionMode: mode });
      expect(result.success).toBe(true);
    }
  });
});

describe("validateSkillConfig", () => {
  it("returns success for a valid minimal config with only the required name field", () => {
    const result = validateSkillConfig({ name: "My Skill" });
    expect(result.success).toBe(true);
    expect(result.data?.name).toBe("My Skill");
  });

  it("returns success for a config with all optional fields populated", () => {
    const result = validateSkillConfig({
      name: "Full Skill",
      description: "A useful skill",
      version: "1.0.0",
      license: "MIT",
    });
    expect(result.success).toBe(true);
  });

  it("returns failure and mentions name when the required name field is missing", () => {
    const result = validateSkillConfig({});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("name");
  });
});

describe("validateSettingsConfig", () => {
  it("returns success for an empty object (all fields are optional)", () => {
    const result = validateSettingsConfig({});
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns success for a config with valid permissions object", () => {
    const result = validateSettingsConfig({
      permissions: { allow: ["Read"], deny: ["Write"] },
    });
    expect(result.success).toBe(true);
  });

  it("returns success for a full config with all optional fields populated", () => {
    const result = validateSettingsConfig({
      permissions: { allow: ["Read"] },
      defaultMode: "default",
      env: { MY_VAR: "value" },
      model: "claude-opus-4-5",
      allowedTools: ["Bash"],
    });
    expect(result.success).toBe(true);
  });
});
