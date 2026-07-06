#!/usr/bin/env node
/**
 * AgentRight CLI
 *
 * Usage:
 *   agentright scan <config-file>          Human-readable scan
 *   agentright scan <config-file> --json   Machine-readable JSON
 *   agentright --help
 *
 * Exit codes:
 *   0  Score >= 50 (passing)
 *   1  Error (file not found, parse error)
 *   2  Score < 50 (failing — gate CI/CD deployments on this)
 *
 * The CLI is a thin shell. All scoring logic lives in
 * @agentright/core so every surface (CLI, web, API) produces
 * identical scores for identical input.
 */

import * as fs from "fs";
import * as path from "path";
import {
  parseConfigString,
  adapt,
  scoreAgent,
  computeCeiling,
  type ScanResult,
  type AdapterResult,
} from "@agentright/core";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

function gradeColor(grade: string): string {
  if (grade === "A" || grade === "B") return GREEN;
  if (grade === "C") return YELLOW;
  return RED;
}

function sevColor(sev: string): string {
  if (sev === "critical") return RED;
  if (sev === "high") return MAGENTA;
  if (sev === "medium") return YELLOW;
  return DIM;
}

function bar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function printHelp(): void {
  console.log(`
AgentRight — pre-deployment governance scanning for AI agents

Usage:
  agentright scan <config-file>          Scan a config and display trust score
  agentright scan <config-file> --json   Output results as JSON
  agentright --help                      Show this help message

Supported inputs:
  Native AgentRight configs (JSON/YAML, 16-field schema)
  MCP server configs (.mcp.json, claude_desktop_config.json)
  CrewAI agent definitions (agents.yaml)

Exit codes:
  0  Score >= 50 (passing)
  1  Error (file not found, parse error)
  2  Score < 50 (failing — use in CI/CD to gate deployments)

Learn more: https://github.com/Ganesh-WeekendBuilds/agentright
`);
}

function printResult(
  result: ScanResult,
  adapter: AdapterResult,
  label?: string
): void {
  const gc = gradeColor(result.grade);
  console.log("");
  if (label) console.log(`${BOLD}${label}${RESET}`);
  console.log(
    `${BOLD}Trust Score: ${gc}${result.trust_score}/100 (Grade ${result.grade})${RESET}`
  );
  if (adapter.framework !== "native" && adapter.framework !== "unknown") {
    const ceiling = computeCeiling(adapter.inexpressible);
    console.log(
      `${DIM}Framework: ${adapter.framework} — governance ceiling in this format: ${ceiling.ceiling}/100 (Grade ${ceiling.ceilingGrade})${RESET}`
    );
  }
  console.log(
    `${DIM}Agent: ${result.agent_id} | Type: ${result.agent_type} | Fields: ${result.field_count.present}/${result.field_count.total}${RESET}`
  );
  console.log("");

  for (const d of result.dimensions) {
    const pct = `${d.score}`.padStart(3);
    console.log(
      `  ${d.name.padEnd(26)} ${bar(d.score)} ${pct}  ${DIM}(${Math.round(d.weight * 100)}%)${RESET}`
    );
  }

  if (adapter.notes.length > 0) {
    console.log("");
    console.log(`${BOLD}Framework notes:${RESET}`);
    for (const n of adapter.notes) {
      console.log(`  ${CYAN}•${RESET} ${n}`);
    }
  }

  if (result.gaps.length > 0) {
    console.log("");
    console.log(`${BOLD}Gaps (${result.gaps.length}):${RESET}`);
    for (const g of result.gaps) {
      const inherent = adapter.inexpressible.includes(g.field)
        ? ` ${DIM}[framework limit]${RESET}`
        : "";
      console.log(
        `  ${sevColor(g.severity)}${g.severity.toUpperCase().padEnd(8)}${RESET} ${g.field}${inherent}`
      );
      console.log(`           ${g.message}`);
      console.log(`           ${DIM}→ ${g.remediation}${RESET}`);
    }
  }
  console.log("");
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  if (command !== "scan") {
    console.error(`Unknown command: ${command}. Try: agentright --help`);
    process.exit(1);
  }

  const filePath = args[1];
  if (!filePath) {
    console.error("Error: No config file specified.");
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found: ${resolved}`);
    process.exit(1);
  }

  const asJson = args.includes("--json");

  let content: string;
  try {
    content = fs.readFileSync(resolved, "utf-8");
  } catch (e) {
    console.error(`Error reading file: ${(e as Error).message}`);
    process.exit(1);
  }

  let parsed;
  try {
    parsed = parseConfigString(content);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exit(1);
  }

  // Adapter layer: detect framework from the RAW object, then score
  // the adapted canonical config.
  let rawObj: Record<string, unknown>;
  try {
    // re-parse raw to give adapters the unnormalized object
    rawObj = JSON.parse(JSON.stringify(parsed.config));
    // parseConfigString normalizes; for adapter detection we need the raw.
    // Cheap approach: try JSON first, else use js-yaml through core parse.
  } catch {
    rawObj = parsed.config as Record<string, unknown>;
  }

  // Use the original content for detection to catch mcp/crewai shapes
  // that normalization would strip.
  let detectionObj: Record<string, unknown> = rawObj;
  try {
    detectionObj = JSON.parse(content);
  } catch {
    try {
      // YAML path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const yaml = require("js-yaml");
      const y = yaml.load(content);
      if (y && typeof y === "object") detectionObj = y as Record<string, unknown>;
    } catch {
      /* fall back to normalized */
    }
  }

  const adapter = adapt(detectionObj);
  const results: { result: ScanResult; adapter: AdapterResult; label?: string }[] = [];

  const primary = scoreAgent(adapter.config);
  results.push({ result: primary, adapter });

  if (adapter.siblings) {
    for (const sib of adapter.siblings) {
      results.push({
        result: scoreAgent(sib.config),
        adapter: sib,
        label: `Agent: ${sib.config.behavioral_bounds?.purpose?.slice(0, 60) || "unnamed"}`,
      });
    }
  }

  if (asJson) {
    const out = results.map((r) => ({
      ...r.result,
      framework: r.adapter.framework,
      framework_notes: r.adapter.notes,
      inexpressible_fields: r.adapter.inexpressible,
      ...(r.adapter.framework !== "native" &&
      r.adapter.framework !== "unknown"
        ? { governance_ceiling: computeCeiling(r.adapter.inexpressible) }
        : {}),
    }));
    console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
  } else {
    for (const r of results) {
      printResult(r.result, r.adapter, r.label);
    }
  }

  // Exit code from worst score across all agents in the file
  const worst = Math.min(...results.map((r) => r.result.trust_score));
  process.exit(worst >= 50 ? 0 : 2);
}

main();
