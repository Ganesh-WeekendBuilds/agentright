/**
 * AgentRight Identity Types
 * TypeScript representation of the 16-field agent identity schema.
 */

export interface Permission {
  resource: string;
  actions: ("read" | "write" | "execute" | "delete" | "delegate")[];
  scope?: string;
  expires_at?: string;
}

export interface BehavioralBounds {
  purpose?: string;
  max_token_budget?: number;
  allowed_tools?: string[];
  forbidden_actions?: string[];
  escalation_triggers?: string[];
  data_horizon?: string;
}

export interface DelegationLink {
  from_id: string;
  to_id: string;
  scope: string;
  timestamp: string;
  signature?: string;
}

export interface TrustMetadata {
  trust_score?: number;
  accuracy_rate?: number;
  drift_score?: number;
  anomaly_count?: number;
  last_validated?: string;
}

export type AgentType =
  | "analytical"
  | "transacting"
  | "orchestrator"
  | "compliance"
  | "assistant"
  | "custom";

export type RiskTier = "tier1_critical" | "tier2_elevated" | "tier3_standard";

export interface AgentIdentity {
  agent_id: string;
  class_id?: string;
  agent_type: AgentType;
  risk_tier?: RiskTier;
  model_provider: string;
  model_version: string;
  configuration_hash?: string;
  owner_id: string;
  authorizer_id: string;
  permissions: Permission[];
  behavioral_bounds: BehavioralBounds;
  delegation_chain?: DelegationLink[];
  trust_metadata?: TrustMetadata;
  created_at: string;
  expires_at: string;
  regulatory_context?: string[];
  // Data Sovereignty (dimension 6)
  data_residency?: string[];
  output_routing?: {
    allowed_destinations?: string[];
    forbidden_destinations?: string[];
  };
  provider_dependencies?: {
    model_provider?: string;
    can_switch?: boolean;
    locked_to?: string;
  };
}

export interface ScanGap {
  field: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  remediation: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  details: string[];
}

export interface ScanResult {
  agent_id: string;
  agent_type: string;
  risk_tier: string;
  trust_score: number;
  grade: string;
  dimensions: DimensionScore[];
  gaps: ScanGap[];
  field_count: { present: number; total: number };
  scanned_at: string;
}

/** Fleet-level types for Phase 3 */
export type FleetStatus = "healthy" | "warning" | "critical";

export interface FleetAgent {
  id: string;
  config: Partial<AgentIdentity>;
  result: ScanResult;
  addedAt: string;
  label?: string;
}

export interface FleetSummary {
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  avgScore: number;
  worstAgent: string;
  topGapField: string;
}
