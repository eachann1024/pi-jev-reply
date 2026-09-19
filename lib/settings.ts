import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const DEFAULTS = {
  enabled: true,
  language: "en" as "en" | "zh-CN",
  rewriteModel: "",
  rewrite: true,
  visuals: true,
  hideDraft: true,
  rewriteThreshold: 0.7,
  visualThreshold: 0.75,
  jevModel: "jev-latest",
  reviewTimeoutMs: 5000,
  rewriteTimeoutMs: 30000,
  settingsIdleMinutes: 5,
  instructions: "",
};
export type Settings = typeof DEFAULTS;

export function parseSettings(input: unknown): Settings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid settings");
  const values = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    if (!Object.hasOwn(DEFAULTS, key) || typeof value !== typeof DEFAULTS[key as keyof Settings]) {
      throw new TypeError(`Invalid setting: ${key}`);
    }
  }
  const next = { ...DEFAULTS, ...values } as Settings;
  if (!["en", "zh-CN"].includes(next.language)) throw new TypeError("Invalid language");
  if (next.rewriteModel.length > 256 || (next.rewriteModel && !/^[\w.-]+\/\S+$/.test(next.rewriteModel))) {
    throw new TypeError("Use provider/model for the rewrite model");
  }
  if (!/^[\w.-]{1,80}$/.test(next.jevModel) || next.instructions.length > 2000) throw new TypeError("Invalid review instructions or Jev model");
  for (const key of ["rewriteThreshold", "visualThreshold"] as const) {
    if (!Number.isFinite(next[key]) || next[key] < 0 || next[key] > 1) throw new TypeError(`Invalid ${key}`);
  }
  for (const [key, min, max] of [["reviewTimeoutMs", 1000, 30000], ["rewriteTimeoutMs", 1000, 120000], ["settingsIdleMinutes", 1, 60]] as const) {
    if (!Number.isInteger(next[key]) || next[key] < min || next[key] > max) throw new TypeError(`Invalid ${key}`);
  }
  return next;
}

export async function loadSettings(path: string): Promise<Settings> {
  try { return parseSettings(JSON.parse(await readFile(path, "utf8"))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...DEFAULTS };
    throw error; // Never silently overwrite malformed settings.
  }
}

export async function saveSettings(path: string, settings: Settings): Promise<void> {
  const validated = parseSettings(settings);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }).catch(() => {}); }
}

export async function readJevKey(): Promise<string> {
  const fromEnvironment = process.env.TYPESAFE_API_KEY?.trim();
  if (fromEnvironment) return fromEnvironment;
  try { return (await readFile(join(homedir(), ".config/typesafe/api_key"), "utf8")).trim(); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}
