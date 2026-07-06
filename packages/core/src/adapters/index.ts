/**
 * AgentRight Adapter Layer
 *
 * Maps framework-native agent artifacts (MCP configs, CrewAI YAML, etc.)
 * onto the canonical 16-field identity model, WITHOUT requiring anyone
 * to adopt the native format.
 *
 * Every adapter is rule-based extraction from declarative files.
 * No LLM inference. No code parsing. Determinism is the product.
 *
 * Each adapter also reports which canonical fields the source framework
 * is STRUCTURALLY INCAPABLE of expressing. This powers the "governance
 * ceiling" finding: the maximum score achievable in that framework.
 */

import type { AgentIdentity, Permission } from "../types";

export type Framework = "native" | "mcp" | "crewai" | "unknown";

export interface AdapterResult {
  framework: Framework;
  /** Canonical config extracted from the source artifact */
  config: Partial<AgentIdentity>;
  /** Canonical fields this framework has no way to express */
  inexpressible: string[];
  /** Human-readable notes about the mapping */
  notes: string[];
  /** For multi-agent files (CrewAI crews), additional agents beyond the first */
  siblings?: AdapterResult[];
}

const NATIVE_MARKERS = [
  "agent_id",
  "behavioral_bounds",
  "authorizer_id",
  "risk_tier",
];

// ── Framework detection ──

export function detectFrameworkFromObject(
  raw: Record<string, unknown>
): Framework {
  // Native format: has any of our schema-specific fields
  if (NATIVE_MARKERS.some((m) => m in raw)) return "native";
  // MCP: claude_desktop_config.json / .mcp.json shape
  if (raw.mcpServers || raw.mcp_servers) return "mcp";
  // CrewAI agents.yaml: top-level keys are agent names whose values
  // have role/goal (or a single object with role/goal)
  if (isCrewAiShape(raw)) return "crewai";
  return "unknown";
}

function isCrewAiShape(raw: Record<string, unknown>): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  // direct single agent definition
  if ("role" in raw && "goal" in raw) return true;
  // map of agent-name -> {role, goal, ...}
  const values = Object.values(raw);
  if (values.length === 0) return false;
  const objectValues = values.filter(
    (v) => typeof v === "object" && v !== null && !Array.isArray(v)
  ) as Record<string, unknown>[];
  if (objectValues.length === 0) return false;
  return objectValues.every((v) => "role" in v || "goal" in v);
}

// ── MCP adapter ──

/**
 * MCP server configs (.mcp.json, claude_desktop_config.json) declare
 * tool servers an agent can reach. They say nothing about who owns the
 * agent, who authorized it, when access expires, or what is forbidden.
 */
export function adaptMcp(raw: Record<string, unknown>): AdapterResult {
  const servers = (raw.mcpServers || raw.mcp_servers || {}) as Record<
    string,
    Record<string, unknown>
  >;
  const notes: string[] = [];
  const permissions: Permission[] = [];
  const allowedTools: string[] = [];

  for (const [name, server] of Object.entries(servers)) {
    allowedTools.push(name);
    // Each MCP server is effectively an unscoped execute grant
    permissions.push({
      resource: `mcp:${name}`,
      actions: ["execute"],
    });
    const env = server.env as Record<string, unknown> | undefined;
    if (env && Object.keys(env).length > 0) {
      notes.push(
        `Server '${name}' receives ${Object.keys(env).length} env var(s) — credentials are ambient, not scoped.`
      );
    }
    const args = server.args as unknown[] | undefined;
    if (
      args &&
      args.some(
        (a) => typeof a === "string" && (a === "/" || a === "--allow-all")
      )
    ) {
      notes.push(`Server '${name}' launched with broad filesystem/permission args.`);
    }
  }

  const config: Partial<AgentIdentity> = {
    permissions: permissions.length > 0 ? permissions : undefined,
    behavioral_bounds:
      allowedTools.length > 0
        ? { allowed_tools: allowedTools }
        : undefined,
  };

  return {
    framework: "mcp",
    config,
    inexpressible: [
      "agent_id",
      "class_id",
      "agent_type",
      "risk_tier",
      "model_provider",
      "model_version",
      "configuration_hash",
      "owner_id",
      "authorizer_id",
      "delegation_chain",
      "trust_metadata",
      "created_at",
      "expires_at",
      "regulatory_context",
      "data_residency",
      "output_routing",
      "provider_dependencies",

      "behavioral_bounds.purpose",
      "behavioral_bounds.forbidden_actions",
      "behavioral_bounds.escalation_triggers",
      "behavioral_bounds.max_token_budget",
      "behavioral_bounds.data_horizon",
      "permissions.scope",
      "permissions.expires_at",
    ],
    notes: [
      `${Object.keys(servers).length} MCP server(s) found. MCP manifests declare tool reach only — no identity, ownership, authorization, expiry, or behavioral constraints are expressible.`,
      ...notes,
    ],
  };
}

// ── CrewAI adapter ──

/**
 * CrewAI agents.yaml declares role, goal, backstory, tools, and
 * delegation flags. Richer than MCP on purpose/tools, still silent on
 * identity, ownership, permissions scoping, and expiry.
 */
export function adaptCrewAi(raw: Record<string, unknown>): AdapterResult {
  // Normalize to a list of (name, def) agent entries
  let entries: [string, Record<string, unknown>][];
  if ("role" in raw || "goal" in raw) {
    entries = [["agent", raw]];
  } else {
    entries = Object.entries(raw).filter(
      ([, v]) => typeof v === "object" && v !== null && !Array.isArray(v)
    ) as [string, Record<string, unknown>][];
  }

  const results = entries.map(([name, def]) =>
    adaptSingleCrewAgent(name, def)
  );
  const [first, ...siblings] = results;
  if (siblings.length > 0) first.siblings = siblings;
  return first;
}

function adaptSingleCrewAgent(
  name: string,
  def: Record<string, unknown>
): AdapterResult {
  const notes: string[] = [];
  const tools = Array.isArray(def.tools)
    ? (def.tools as unknown[]).map(String)
    : undefined;

  const allowDelegation = def.allow_delegation === true;
  if (allowDelegation) {
    notes.push(
      `Agent '${name}' has allow_delegation: true — it can hand work to other agents, but CrewAI cannot express a signed, scoped delegation chain.`
    );
  }

  const purposeParts = [def.role, def.goal].filter(
    (x) => typeof x === "string"
  ) as string[];

  const config: Partial<AgentIdentity> = {
    agent_type: "custom",
    behavioral_bounds:
      purposeParts.length > 0 || tools
        ? {
            purpose: purposeParts.join(" — ") || undefined,
            allowed_tools: tools,
          }
        : undefined,
    permissions: tools
      ? tools.map((t) => ({
          resource: `tool:${t}`,
          actions: ["execute" as const],
        }))
      : undefined,
  };

  // max_iter / max_rpm are loose budget analogs
  if (typeof def.max_iter === "number" || typeof def.max_rpm === "number") {
    notes.push(
      `'${name}' sets max_iter/max_rpm — loose runtime budgets exist, but token budget is not expressible.`
    );
  }

  return {
    framework: "crewai",
    config,
    inexpressible: [
      "agent_id",
      "class_id",
      "risk_tier",
      "model_provider", // sometimes set via llm key in code, not YAML
      "model_version",
      "configuration_hash",
      "owner_id",
      "authorizer_id",
      "delegation_chain",
      "trust_metadata",
      "created_at",
      "expires_at",
      "regulatory_context",
      "data_residency",
      "output_routing",
      "provider_dependencies",

      "behavioral_bounds.forbidden_actions",
      "behavioral_bounds.escalation_triggers",
      "behavioral_bounds.max_token_budget",
      "behavioral_bounds.data_horizon",
      "permissions.scope",
      "permissions.expires_at",
    ],
    notes: [
      `CrewAI agent '${name}': role/goal map to purpose, tools map to allowed_tools and execute permissions. Identity, ownership, authorization, expiry, and forbidden actions are not expressible in agents.yaml.`,
      ...notes,
    ],
  };
}

// ── Entry point ──

/**
 * Detect the framework of a parsed object and adapt it to the
 * canonical model. Native configs pass through untouched.
 */
export function adapt(raw: Record<string, unknown>): AdapterResult {
  const framework = detectFrameworkFromObject(raw);
  switch (framework) {
    case "mcp":
      return adaptMcp(raw);
    case "crewai":
      return adaptCrewAi(raw);
    case "native":
    case "unknown":
    default:
      return {
        framework,
        config: raw as Partial<AgentIdentity>,
        inexpressible: [],
        notes:
          framework === "unknown"
            ? [
                "Format not recognized as MCP or CrewAI — scored as a native config. Missing fields are treated as gaps, not framework limits.",
              ]
            : [],
      };
  }
}
