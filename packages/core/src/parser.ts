/**
 * AgentRight Config Parser (Browser)
 * Parses JSON or YAML agent configs and normalizes to AgentIdentity schema.
 */

import * as yaml from "js-yaml";
import type { AgentIdentity } from "./types";

export function parseConfigString(
  content: string
): { config: Partial<AgentIdentity>; format: "json" | "yaml" } {
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const raw = JSON.parse(trimmed);
      return { config: normalizeConfig(raw), format: "json" };
    } catch {
      // Fall through to YAML
    }
  }

  // Try YAML
  try {
    const raw = yaml.load(trimmed) as Record<string, unknown>;
    if (raw && typeof raw === "object") {
      return { config: normalizeConfig(raw as Record<string, unknown>), format: "yaml" };
    }
  } catch {
    // Both failed
  }

  throw new Error(
    "Could not parse config. Provide valid JSON or YAML."
  );
}

export function normalizeConfig(
  raw: Record<string, unknown>
): Partial<AgentIdentity> {
  const config: Record<string, unknown> = {};

  const directFields = [
    "agent_id",
    "class_id",
    "agent_type",
    "risk_tier",
    "model_provider",
    "model_version",
    "configuration_hash",
    "owner_id",
    "authorizer_id",
    "created_at",
    "expires_at",
  ];

  for (const field of directFields) {
    if (
      raw[field] !== undefined &&
      raw[field] !== null &&
      raw[field] !== ""
    ) {
      config[field] = raw[field];
    }
  }

  if (raw.permissions && Array.isArray(raw.permissions)) {
    config.permissions = (raw.permissions as unknown[]).map((p) =>
      typeof p === "string" ? { resource: p, actions: ["read"] } : p
    );
  }

  if (
    raw.behavioral_bounds &&
    typeof raw.behavioral_bounds === "object"
  ) {
    config.behavioral_bounds = raw.behavioral_bounds;
  }

  if (
    raw.delegation_chain &&
    Array.isArray(raw.delegation_chain)
  ) {
    config.delegation_chain = raw.delegation_chain;
  }

  if (
    raw.trust_metadata &&
    typeof raw.trust_metadata === "object"
  ) {
    config.trust_metadata = raw.trust_metadata;
  }

  if (raw.regulatory_context) {
    if (Array.isArray(raw.regulatory_context)) {
      config.regulatory_context = raw.regulatory_context;
    } else if (typeof raw.regulatory_context === "string") {
      config.regulatory_context = [raw.regulatory_context];
    }
  }

  // Data Sovereignty fields
  if (Array.isArray(raw.data_residency)) {
    config.data_residency = raw.data_residency;
  } else if (typeof raw.data_residency === "string") {
    config.data_residency = [raw.data_residency];
  }
  if (raw.output_routing && typeof raw.output_routing === "object") {
    config.output_routing = raw.output_routing;
  }
  if (
    raw.provider_dependencies &&
    typeof raw.provider_dependencies === "object"
  ) {
    config.provider_dependencies = raw.provider_dependencies;
  }

  return config as Partial<AgentIdentity>;
}

export function detectFramework(
  raw: Record<string, unknown>
): string {
  if (raw.skills || raw.claw_name) return "openclaw";
  if (raw.agent_executor || raw.llm_chain) return "langchain";
  if (raw.crew || raw.agents) return "crewai";
  if (raw.mcpServers || raw.mcp_servers) return "mcp";
  return "generic";
}
