import type { AgentIdentity } from "@agentright/core";

export const SAMPLE_CONFIGS: Record<
  string,
  { label: string; description: string; config: Partial<AgentIdentity> }
> = {
  "good-agent": {
    label: "Well-Configured Agent",
    description: "16/16 fields, proper scoping, signed delegation",
    config: {
      agent_id: "550e8400-e29b-41d4-a716-446655440001",
      class_id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      agent_type: "analytical",
      risk_tier: "tier2_elevated",
      model_provider: "anthropic",
      model_version: "claude-sonnet-4-20250514",
      configuration_hash:
        "a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
      owner_id: "engineering-team-alpha",
      authorizer_id: "user:jane.doe@company.com",
      permissions: [
        {
          resource: "customer_database",
          actions: ["read"],
          scope: "last_90_days",
          expires_at: "2027-04-04T00:00:00Z",
        },
        {
          resource: "internal_knowledge_base",
          actions: ["read"],
          scope: "public_articles_only",
        },
      ],
      behavioral_bounds: {
        purpose:
          "Customer inquiry research and draft response preparation",
        max_token_budget: 50000,
        allowed_tools: [
          "search_kb",
          "read_customer_profile",
          "draft_response",
        ],
        forbidden_actions: [
          "send_email",
          "modify_account",
          "delete_records",
          "external_api_call",
        ],
        escalation_triggers: [
          "confidence_below_0.7",
          "customer_complaint_detected",
          "pii_in_output",
        ],
        data_horizon: "last_90_days",
      },
      delegation_chain: [
        {
          from_id: "user:jane.doe@company.com",
          to_id: "550e8400-e29b-41d4-a716-446655440001",
          scope: "read_only_customer_research",
          timestamp: "2026-04-03T09:00:00Z",
          signature: "eyJhbGciOiJFZDI1NTE5In0...",
        },
      ],
      trust_metadata: {
        trust_score: 88,
        accuracy_rate: 0.94,
        drift_score: 0.03,
        anomaly_count: 0,
        last_validated: "2026-04-03T09:00:00Z",
      },
      created_at: "2026-04-01T00:00:00Z",
      expires_at: "2027-04-04T00:00:00Z",
      regulatory_context: ["UDAAP", "NIST_AI_RMF"],
    },
  },
  "partial-agent": {
    label: "Partial Config",
    description: "10/16 fields, missing bounds and delegation",
    config: {
      agent_id: "660e8400-e29b-41d4-a716-446655440002",
      agent_type: "assistant",
      model_provider: "openai",
      model_version: "gpt-4o",
      owner_id: "support-team",
      authorizer_id: "system:auto-deploy",
      permissions: [
        {
          resource: "customer_database",
          actions: ["read", "write"],
        },
        {
          resource: "email_service",
          actions: ["read", "execute"],
        },
        {
          resource: "internal_wiki",
          actions: ["read"],
        },
      ],
      behavioral_bounds: {
        purpose: "Customer support automation",
      },
      created_at: "2026-03-15T00:00:00Z",
      expires_at: "2027-03-15T00:00:00Z",
    },
  },
  "bad-agent": {
    label: "Ungoverned Agent",
    description: "5/16 fields, wildcard permissions, no bounds",
    config: {
      agent_id: "770e8400-e29b-41d4-a716-446655440003",
      model_provider: "openai",
      model_version: "gpt-4",
      permissions: [
        {
          resource: "*",
          actions: ["read", "write", "execute", "delete"],
        },
      ],
      created_at: "2026-01-01T00:00:00Z",
    },
  },
  "yaml-agent": {
    label: "YAML Config",
    description: "11/16 fields, well-bounded assistant",
    config: {
      agent_id: "880e8400-e29b-41d4-a716-446655440004",
      agent_type: "assistant",
      risk_tier: "tier3_standard",
      model_provider: "anthropic",
      model_version: "claude-sonnet-4-20250514",
      owner_id: "marketing-team",
      authorizer_id: "user:bob@company.com",
      permissions: [
        {
          resource: "cms_platform",
          actions: ["read", "write"],
          scope: "drafts_only",
        },
        {
          resource: "analytics_dashboard",
          actions: ["read"],
        },
      ],
      behavioral_bounds: {
        purpose: "Draft marketing content from campaign briefs",
        allowed_tools: [
          "read_brief",
          "draft_content",
          "check_grammar",
        ],
        forbidden_actions: [
          "publish",
          "send_email",
          "access_financials",
        ],
      },
      created_at: "2026-04-01T00:00:00Z",
      expires_at: "2026-04-15T00:00:00Z",
    },
  },
};
