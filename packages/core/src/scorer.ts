/**
 * AgentRight Scoring Engine
 * Evaluates agent configurations across 5 dimensions.
 * All scoring is rule-based and deterministic. No LLM calls.
 *
 * Direct port from Phase 1 CLI scoring engine.
 */

import type {
  AgentIdentity,
  ScanResult,
  ScanGap,
  DimensionScore,
} from "./types";

const ALL_FIELDS = [
  "agent_id",
  "class_id",
  "agent_type",
  "risk_tier",
  "model_provider",
  "model_version",
  "configuration_hash",
  "owner_id",
  "authorizer_id",
  "permissions",
  "behavioral_bounds",
  "delegation_chain",
  "trust_metadata",
  "created_at",
  "expires_at",
  "regulatory_context",
];

const REQUIRED_FIELDS = [
  "agent_id",
  "agent_type",
  "model_provider",
  "model_version",
  "owner_id",
  "authorizer_id",
  "permissions",
  "behavioral_bounds",
  "created_at",
  "expires_at",
];

const DIMENSION_WEIGHTS = {
  identity: 0.2,
  permissions: 0.2,
  behavioral: 0.2,
  delegation: 0.15,
  configuration: 0.1,
  sovereignty: 0.15,
};

export function scoreAgent(
  config: Partial<AgentIdentity>
): ScanResult {
  const gaps: ScanGap[] = [];

  const identity = scoreIdentityCompleteness(config, gaps);
  const permissions = scorePermissionHygiene(config, gaps);
  const behavioral = scoreBehavioralConsistency(config, gaps);
  const delegation = scoreDelegationIntegrity(config, gaps);
  const configuration = scoreConfigurationIntegrity(config, gaps);
  const sovereignty = scoreDataSovereignty(config, gaps);

  const dimensions: DimensionScore[] = [
    identity,
    permissions,
    behavioral,
    delegation,
    configuration,
    sovereignty,
  ];

  const trustScore = Math.round(
    identity.score * DIMENSION_WEIGHTS.identity +
      permissions.score * DIMENSION_WEIGHTS.permissions +
      behavioral.score * DIMENSION_WEIGHTS.behavioral +
      delegation.score * DIMENSION_WEIGHTS.delegation +
      configuration.score * DIMENSION_WEIGHTS.configuration +
      sovereignty.score * DIMENSION_WEIGHTS.sovereignty
  );

  const presentFields = ALL_FIELDS.filter((f) => {
    const val = (config as Record<string, unknown>)[f];
    return val !== undefined && val !== null;
  });

  return {
    agent_id: config.agent_id || "unknown",
    agent_type: config.agent_type || "unknown",
    risk_tier: config.risk_tier || "not_set",
    trust_score: trustScore,
    grade: computeGrade(trustScore),
    dimensions,
    gaps: gaps.sort(
      (a, b) => severityOrder(a.severity) - severityOrder(b.severity)
    ),
    field_count: {
      present: presentFields.length,
      total: ALL_FIELDS.length,
    },
    scanned_at: new Date().toISOString(),
  };
}

// ── DIMENSION 1: Identity Completeness (25%) ──

function scoreIdentityCompleteness(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  let present = 0;

  for (const field of ALL_FIELDS) {
    const val = (config as Record<string, unknown>)[field];
    const exists = val !== undefined && val !== null;

    if (exists) {
      present++;
    } else if (REQUIRED_FIELDS.includes(field)) {
      gaps.push({
        field,
        severity: "critical",
        message: `Required field '${field}' is missing.`,
        remediation: getRemediation(field),
      });
    } else {
      gaps.push({
        field,
        severity: "medium",
        message: `Recommended field '${field}' is not configured.`,
        remediation: getRemediation(field),
      });
    }
  }

  let score = Math.round((present / ALL_FIELDS.length) * 100);
  const details: string[] = [
    `${present}/${ALL_FIELDS.length} fields configured`,
  ];

  if (config.agent_id && !isValidUUID(config.agent_id)) {
    score = Math.max(0, score - 10);
    details.push("agent_id is not a valid UUID format");
  }

  if (config.expires_at) {
    const expiry = new Date(config.expires_at);
    const now = new Date();
    if (expiry <= now) {
      score = Math.max(0, score - 20);
      gaps.push({
        field: "expires_at",
        severity: "critical",
        message: "Agent identity has expired.",
        remediation:
          "Renew the agent identity token with a future expiration date.",
      });
    }
    const daysTillExpiry =
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysTillExpiry > 365) {
      score = Math.max(0, score - 10);
      gaps.push({
        field: "expires_at",
        severity: "high",
        message: `TTL is ${Math.round(daysTillExpiry)} days. Recommended maximum is 24 hours for regulated environments.`,
        remediation:
          "Reduce TTL to 24 hours or less. Scale by risk_tier: Tier 1 should use task-bound tokens.",
      });
    }
  }

  return {
    name: "Identity Completeness",
    score,
    weight: DIMENSION_WEIGHTS.identity,
    details,
  };
}

// ── DIMENSION 2: Permission Hygiene (25%) ──

function scorePermissionHygiene(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  let score = 100;
  const details: string[] = [];

  if (!config.permissions || config.permissions.length === 0) {
    gaps.push({
      field: "permissions",
      severity: "critical",
      message:
        "No permissions defined. Agent access scope is unbounded.",
      remediation:
        "Define explicit permissions with specific resources, actions, and scopes.",
    });
    return {
      name: "Permission Hygiene",
      score: 0,
      weight: DIMENSION_WEIGHTS.permissions,
      details: ["No permissions defined"],
    };
  }

  for (const perm of config.permissions) {
    if (perm.resource === "*") {
      score = Math.max(0, score - 40);
      gaps.push({
        field: "permissions",
        severity: "critical",
        message:
          "Wildcard resource '*' grants access to everything. This violates least-privilege.",
        remediation:
          "Replace '*' with specific resource names that the agent actually needs.",
      });
      details.push("CRITICAL: Wildcard resource access detected");
    }

    if (perm.actions) {
      if (perm.actions.includes("delete")) {
        score = Math.max(0, score - 15);
        gaps.push({
          field: "permissions",
          severity: "high",
          message: `Delete permission on '${perm.resource}'. Most agents should not have delete access.`,
          remediation: `Remove 'delete' from actions on '${perm.resource}' unless explicitly required and approved.`,
        });
        details.push(`High-risk: delete access on ${perm.resource}`);
      }

      if (
        perm.actions.includes("write") &&
        perm.actions.includes("read")
      ) {
        score = Math.max(0, score - 5);
        details.push(
          `Read+write on ${perm.resource} — verify write is needed`
        );
      }

      if (perm.actions.includes("delegate")) {
        score = Math.max(0, score - 5);
        details.push(
          `Delegate permission on ${perm.resource} — agent can pass access`
        );
      }
    }

    if (!perm.scope) {
      score = Math.max(0, score - 5);
      details.push(`No scope constraint on ${perm.resource}`);
    }

    if (!perm.expires_at) {
      score = Math.max(0, score - 3);
      details.push(`No expiry on permission for ${perm.resource}`);
    }
  }

  if (details.length === 0) {
    details.push("All permissions are properly scoped");
  }

  return {
    name: "Permission Hygiene",
    score,
    weight: DIMENSION_WEIGHTS.permissions,
    details,
  };
}

// ── DIMENSION 3: Behavioral Consistency (20%) ──

function scoreBehavioralConsistency(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  if (!config.behavioral_bounds) {
    gaps.push({
      field: "behavioral_bounds",
      severity: "critical",
      message:
        "No behavioral bounds defined. Agent behavior is unconstrained.",
      remediation:
        "Define behavioral_bounds with at minimum: purpose, allowed_tools, and forbidden_actions.",
    });
    return {
      name: "Behavioral Consistency",
      score: 0,
      weight: DIMENSION_WEIGHTS.behavioral,
      details: ["No bounds defined"],
    };
  }

  let score = 0;
  const details: string[] = [];
  const bounds = config.behavioral_bounds;

  const checks = [
    { field: "purpose", points: 25, label: "Business purpose defined" },
    {
      field: "allowed_tools",
      points: 20,
      label: "Allowed tools specified",
    },
    {
      field: "forbidden_actions",
      points: 20,
      label: "Forbidden actions listed",
    },
    {
      field: "escalation_triggers",
      points: 15,
      label: "Escalation triggers set",
    },
    {
      field: "max_token_budget",
      points: 10,
      label: "Token budget constrained",
    },
    {
      field: "data_horizon",
      points: 10,
      label: "Data horizon defined",
    },
  ];

  for (const check of checks) {
    const val = (bounds as Record<string, unknown>)[check.field];
    if (val !== undefined && val !== null) {
      const hasContent = Array.isArray(val) ? val.length > 0 : true;
      if (hasContent) {
        score += check.points;
        details.push(check.label);
      }
    } else {
      gaps.push({
        field: `behavioral_bounds.${check.field}`,
        severity: check.points >= 20 ? "high" : "medium",
        message: `${check.label} is not configured.`,
        remediation: getBoundsRemediation(check.field),
      });
    }
  }

  return {
    name: "Behavioral Consistency",
    score,
    weight: DIMENSION_WEIGHTS.behavioral,
    details,
  };
}

// ── DIMENSION 4: Delegation Integrity (15%) ──

function scoreDelegationIntegrity(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  let score = 50;
  const details: string[] = [];

  if (
    !config.delegation_chain ||
    config.delegation_chain.length === 0
  ) {
    details.push("No delegation chain (single-agent operation)");

    if (config.agent_type === "orchestrator") {
      score = 10;
      gaps.push({
        field: "delegation_chain",
        severity: "critical",
        message:
          "Agent type is 'orchestrator' but no delegation chain is defined.",
        remediation:
          "Orchestrator agents must have a delegation_chain documenting all sub-agent relationships.",
      });
    }

    return {
      name: "Delegation Integrity",
      score,
      weight: DIMENSION_WEIGHTS.delegation,
      details,
    };
  }

  score = 60;
  details.push(
    `${config.delegation_chain.length} delegation link(s) found`
  );

  let allSigned = true;
  let hasHumanOrigin = false;

  for (let i = 0; i < config.delegation_chain.length; i++) {
    const link = config.delegation_chain[i];

    if (!link.signature) {
      allSigned = false;
      gaps.push({
        field: `delegation_chain[${i}].signature`,
        severity: "high",
        message: `Delegation from '${link.from_id}' to '${link.to_id}' is unsigned.`,
        remediation:
          "Sign each delegation with the delegating entity's private key to prevent spoofing.",
      });
    }

    if (!link.scope) {
      score = Math.max(0, score - 10);
      gaps.push({
        field: `delegation_chain[${i}].scope`,
        severity: "high",
        message: `Delegation from '${link.from_id}' to '${link.to_id}' has no scope constraint.`,
        remediation:
          "Define the specific scope of each delegation.",
      });
    }

    if (link.from_id && link.from_id.startsWith("user:")) {
      hasHumanOrigin = true;
    }
  }

  if (allSigned) {
    score += 25;
    details.push("All delegations are cryptographically signed");
  }

  if (hasHumanOrigin) {
    score += 15;
    details.push("Chain traces back to a human authorizer");
  } else {
    gaps.push({
      field: "delegation_chain",
      severity: "high",
      message:
        "Delegation chain does not trace back to a human identity.",
      remediation:
        "The first link should originate from a human (from_id starting with 'user:').",
    });
  }

  score = Math.min(100, score);

  return {
    name: "Delegation Integrity",
    score,
    weight: DIMENSION_WEIGHTS.delegation,
    details,
  };
}

// ── DIMENSION 5: Configuration Integrity (15%) ──

function scoreConfigurationIntegrity(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  let score = 0;
  const details: string[] = [];

  if (config.configuration_hash) {
    score += 50;
    details.push("Configuration hash present");

    if (config.configuration_hash.length >= 64) {
      score += 10;
      details.push("Hash appears to be SHA-256 (64+ chars)");
    }
  } else {
    gaps.push({
      field: "configuration_hash",
      severity: "high",
      message:
        "No configuration hash. Cannot verify system prompt integrity at runtime.",
      remediation:
        "Generate a SHA-256 hash of your agent's system prompt + tool definitions and store it in configuration_hash.",
    });
  }

  if (config.class_id) {
    score += 25;
    details.push("Linked to approved class template");
  } else {
    gaps.push({
      field: "class_id",
      severity: "medium",
      message:
        "No class_id. Cannot verify this instance against an approved template.",
      remediation:
        "Register the agent's approved configuration as a class in your model registry and reference it via class_id.",
    });
  }

  if (config.model_version) {
    if (
      config.model_version.includes("-") ||
      config.model_version.length > 10
    ) {
      score += 15;
      details.push(
        "Model version is specific (includes version identifier)"
      );
    } else {
      score += 5;
      details.push(
        "Model version present but may not be specific enough"
      );
    }
  }

  return {
    name: "Configuration Integrity",
    score,
    weight: DIMENSION_WEIGHTS.configuration,
    details,
  };
}

// ── DIMENSION 6: Data Sovereignty (15%) ──
//
// Measures whether the agent declares where its data lives, where its
// outputs go, and how tied it is to a single runtime provider. When
// these are unspecified, the runtime provider's defaults apply — the
// enterprise has no auditable record of data boundaries. This is the
// pre-deployment signal for platform-capture / vendor-lock exposure.

function scoreDataSovereignty(
  config: Partial<AgentIdentity>,
  gaps: ScanGap[]
): DimensionScore {
  let score = 0;
  const details: string[] = [];

  // data_residency: where the agent's data is allowed to live (35 pts)
  const residency = (config as Record<string, unknown>).data_residency;
  if (Array.isArray(residency) && residency.length > 0) {
    score += 35;
    details.push(`Data residency declared: ${residency.join(", ")}`);
  } else {
    gaps.push({
      field: "data_residency",
      severity: "high",
      message:
        "No data residency declared. Where agent data lives is decided by the runtime provider's defaults.",
      remediation:
        "Declare data_residency (e.g., ['EU'] or ['US']) so data boundaries are auditable, not provider-defined.",
    });
  }

  // output_routing: where outputs may/may not be sent (35 pts)
  const routing = (config as Record<string, unknown>).output_routing as
    | Record<string, unknown>
    | undefined;
  if (routing && typeof routing === "object") {
    const allowed = Array.isArray(routing.allowed_destinations)
      ? (routing.allowed_destinations as unknown[])
      : [];
    const forbidden = Array.isArray(routing.forbidden_destinations)
      ? (routing.forbidden_destinations as unknown[])
      : [];
    if (allowed.length > 0 || forbidden.length > 0) {
      score += 35;
      details.push(
        `Output routing constrained (${allowed.length} allowed, ${forbidden.length} forbidden)`
      );
    } else {
      score += 10;
      details.push("output_routing present but empty");
      gaps.push({
        field: "output_routing",
        severity: "medium",
        message:
          "output_routing is declared but lists no allowed or forbidden destinations.",
        remediation:
          "Specify allowed_destinations and/or forbidden_destinations so agent outputs cannot flow to unapproved endpoints.",
      });
    }
  } else {
    gaps.push({
      field: "output_routing",
      severity: "high",
      message:
        "No output routing declared. Agent outputs can be sent anywhere the runtime allows.",
      remediation:
        "Declare output_routing with allowed_destinations and forbidden_destinations to bound where results and data can go.",
    });
  }

  // provider_dependencies: portability / lock-in posture (30 pts)
  const prov = (config as Record<string, unknown>)
    .provider_dependencies as Record<string, unknown> | undefined;
  if (prov && typeof prov === "object") {
    score += 15;
    details.push("Provider dependencies declared");
    if (typeof prov.can_switch === "boolean") {
      score += 15;
      details.push(
        prov.can_switch
          ? "Agent is declared portable across providers"
          : "Agent is declared locked to a single provider (explicit, auditable)"
      );
    } else {
      gaps.push({
        field: "provider_dependencies.can_switch",
        severity: "medium",
        message:
          "Provider portability (can_switch) is not declared.",
        remediation:
          "Set provider_dependencies.can_switch to true/false so vendor lock-in is an explicit, auditable decision.",
      });
    }
  } else {
    gaps.push({
      field: "provider_dependencies",
      severity: "high",
      message:
        "No provider dependencies declared. Vendor lock-in and provider-switching posture are unspecified.",
      remediation:
        "Declare provider_dependencies (model_provider, can_switch, locked_to) so hosting exposure is auditable rather than implicit.",
    });
  }

  if (details.length === 0) {
    details.push("No data sovereignty constraints declared");
  }

  return {
    name: "Data Sovereignty",
    score: Math.min(100, score),
    weight: DIMENSION_WEIGHTS.sovereignty,
    details,
  };
}

// ── UTILITIES ──

function computeGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 50) return "C";
  if (score >= 25) return "D";
  return "F";
}

function severityOrder(severity: string): number {
  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[severity] ?? 4;
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

function getRemediation(field: string): string {
  const remediations: Record<string, string> = {
    agent_id: "Generate a UUID v4 for this agent instance.",
    class_id:
      "Register an approved agent template and link this instance to it via class_id.",
    agent_type:
      "Set agent_type to one of: analytical, transacting, orchestrator, compliance, assistant.",
    risk_tier:
      "Set risk_tier based on data sensitivity and decision authority: tier1_critical, tier2_elevated, or tier3_standard.",
    model_provider:
      "Specify the foundation model provider (e.g., anthropic, openai, meta).",
    model_version:
      "Record the exact model version or hash for audit traceability.",
    configuration_hash:
      "Generate SHA-256 hash of your system prompt + tool definitions.",
    owner_id:
      "Assign a human owner or team responsible for this agent.",
    authorizer_id:
      "Bind every task execution to the identity of the authorizing user or system.",
    permissions:
      "Define explicit permissions with specific resources, actions, and scope constraints.",
    behavioral_bounds:
      "Define behavioral constraints: purpose, allowed tools, forbidden actions, escalation triggers.",
    delegation_chain:
      "For multi-agent systems, document the full delegation chain from human to each agent.",
    trust_metadata:
      "Configure trust scoring to track accuracy, drift, and anomalies over time.",
    created_at: "Record the agent creation timestamp.",
    expires_at:
      "Set a finite expiration. Recommended maximum: 24 hours for regulated environments.",
    regulatory_context:
      "List applicable compliance frameworks (e.g., SR_11-7, ECOA, NIST_AI_RMF).",
  };
  return remediations[field] || `Configure the '${field}' field.`;
}

function getBoundsRemediation(field: string): string {
  const remediations: Record<string, string> = {
    purpose:
      "Define the approved business purpose (e.g., 'Customer inquiry research and draft preparation').",
    allowed_tools:
      "List the specific tools/APIs this agent is permitted to invoke.",
    forbidden_actions:
      "List actions the agent must never take (e.g., 'send_email', 'delete_records').",
    escalation_triggers:
      "Define conditions that require human intervention (e.g., 'confidence_below_0.7', 'amount_exceeds_10000').",
    max_token_budget:
      "Set a maximum token budget per session to prevent runaway compute costs.",
    data_horizon:
      "Set a time window for data access (e.g., 'last_90_days') to prevent unnecessary historical access.",
  };
  return (
    remediations[field] ||
    `Configure '${field}' in behavioral_bounds.`
  );
}
