import { readTextFile } from "@tauri-apps/plugin-fs";
import { parse as parseJsonc, type ParseError as JsoncParseError } from "jsonc-parser";
import type { AuiNode } from "@/types/aui-node";
import type { SettingsConfig } from "@/types/settings";
import { SettingsConfigSchema } from "@/types/settings";
import { getFileName, generateNodeId } from "@/utils/paths";
import { ParseError } from "@/types/errors";

/**
 * Parse a settings JSON file into an AuiNode.
 * If content is not provided, reads the file from disk via Tauri FS.
 * @throws {ParseError} If the file cannot be read or JSON/JSONC parsing fails
 */
export async function parseSettingsFile(
  filePath: string,
  content?: string
): Promise<AuiNode> {
  const raw = content ?? (await readTextFile(filePath));
  let rawConfig: unknown;
  const parseErrors: string[] = [];

  try {
    const errors: JsoncParseError[] = [];
    rawConfig = parseJsonc(raw, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
      parseErrors.push("Settings file contains invalid JSONC");
    }
  } catch (err) {
    parseErrors.push(
      `Invalid settings: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      id: generateNodeId(filePath),
      name: getFileName(filePath),
      kind: "settings",
      parentId: null,
      team: null,
      sourcePath: filePath,
      config: null,
      promptBody: "",
      tags: [],
      lastModified: Date.now(),
      validationErrors: parseErrors,
      assignedSkills: [],
      variables: [],
      launchPrompt: "",
      pipelineSteps: [],
    };
  }

  const result = SettingsConfigSchema.safeParse(rawConfig);
  const config: SettingsConfig = result.success
    ? result.data
    : (rawConfig as SettingsConfig);
  const validationErrors = result.success
    ? []
    : result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

  return {
    id: generateNodeId(filePath),
    name: getFileName(filePath),
    kind: "settings",
    parentId: null,
    team: null,
    sourcePath: filePath,
    config,
    promptBody: "",
    tags: [],
    lastModified: Date.now(),
    validationErrors,
    assignedSkills: [],
    variables: [],
    launchPrompt: "",
    pipelineSteps: [],
  };
}
