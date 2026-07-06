/**
 * Governance Ceiling
 *
 * Given the set of canonical fields a framework cannot express, compute
 * the MAXIMUM trust score achievable by a perfectly-configured agent in
 * that framework. This separates developer gaps ("you could have scoped
 * this and didn't") from ecosystem gaps ("your framework has no way to
 * say this").
 *
 * Method: take a maximally governed reference config, delete every
 * inexpressible field, and score what remains. Deterministic by
 * construction.
 */

import type { AgentIdentity } from "./types";
import { scoreAgent } from "./scorer";

/** A reference config that scores 100 on every dimension. */
export function idealConfig(): Partial<AgentIdentity> {
  const now = Date.now();
  return {
    agent_id: "00000000-0000-4000-8000-000000000001",
    class_id: "00000000-0000-4000-8000-000000000002",
    agent_type: "analytical",
    risk_tier: "tier3_standard",
    model_provider: "anthropic",
    model_version: "claude-sonnet-4-20250514",
    configuration_hash:
      "0000000000000000000000000000000000000000000000000000000000000000",
    owner_id: "owner-team",
    authorizer_id: "user:owner@example.com",
    permissions: [
      {
        resource: "primary_resource",
        actions: ["read"],
        scope: "narrow",
        expires_at: new Date(now + 12 * 3600_000).toISOString(),
      },
    ],
    behavioral_bounds: {
      purpose: "Reference purpose",
      max_token_budget: 10000,
      allowed_tools: ["tool_a"],
      forbidden_actions: ["forbidden_a"],
      escalation_triggers: ["trigger_a"],
      data_horizon: "last_30_days",
    },
    delegation_chain: [
      {
        from_id: "user:owner@example.com",
        to_id: "00000000-0000-4000-8000-000000000001",
        scope: "narrow",
        timestamp: new Date(now).toISOString(),
        signature: "sig",
      },
    ],
    trust_metadata: {
      trust_score: 100,
      accuracy_rate: 1,
      drift_score: 0,
      anomaly_count: 0,
      last_validated: new Date(now).toISOString(),
    },
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + 12 * 3600_000).toISOString(),
    regulatory_context: ["NIST_AI_RMF"],
  };
}

/** Delete a (possibly dotted) field path from a config object. */
function deleteField(cfg: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  if (parts.length === 1) {
    delete cfg[parts[0]];
    return;
  }
  // dotted paths like behavioral_bounds.purpose / permissions.scope
  const [head, tail] = [parts[0], parts.slice(1).join(".")];
  const child = cfg[head];
  if (child === undefined || child === null) return;
  if (Array.isArray(child)) {
    for (const item of child) {
      if (typeof item === "object" && item !== null) {
        deleteField(item as Record<string, unknown>, tail);
      }
    }
  } else if (typeof child === "object") {
    deleteField(child as Record<string, unknown>, tail);
  }
}

export interface CeilingResult {
  /** Max achievable trust score in this framework */
  ceiling: number;
  /** Grade at the ceiling */
  ceilingGrade: string;
  /** Fields that cap the score */
  cappedBy: string[];
}

export function computeCeiling(inexpressible: string[]): CeilingResult {
  const cfg = idealConfig() as Record<string, unknown>;
  for (const path of inexpressible) {
    deleteField(cfg, path);
  }
  const result = scoreAgent(cfg as Partial<AgentIdentity>);
  return {
    ceiling: result.trust_score,
    ceilingGrade: result.grade,
    cappedBy: inexpressible,
  };
}
