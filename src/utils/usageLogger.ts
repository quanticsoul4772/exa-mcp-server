import * as fs from "fs";
import * as path from "path";

/**
 * Appends one line to the Exa usage CSV.
 * Status values: ok | quota_error | rate_limit | unavailable | error
 */
export function logExaUsage(toolName: string, status: string, note = ""): void {
  try {
    const csvPath = process.env.EXA_USAGE_CSV ??
      path.join("/home/agent/workspace/metrics", "exa-usage.csv");

    const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const safeNote = note.replace(/,/g, ";").replace(/\n/g, " ").slice(0, 120);
    const line = `${ts},${toolName},${status},${safeNote}\n`;

    // Ensure the header exists before the first append
    if (!fs.existsSync(csvPath)) {
      fs.mkdirSync(path.dirname(csvPath), { recursive: true });
      fs.writeFileSync(csvPath, "timestamp,tool,status,note\n");
    }
    fs.appendFileSync(csvPath, line);
  } catch {
    // Never let logging crash the tool
  }
}
