"use client";

import { useState } from "react";

const EXAMPLE_CONFIG = `{
  "agent_id": "550e8400-e29b-41d4-a716-446655440001",
  "agent_type": "analytical",
  "model_provider": "anthropic",
  "model_version": "claude-sonnet-4-20250514",
  "owner_id": "engineering-team",
  "authorizer_id": "user:jane@company.com",
  "permissions": [
    {
      "resource": "customer_database",
      "actions": ["read"],
      "scope": "last_90_days"
    }
  ],
  "behavioral_bounds": {
    "purpose": "Customer inquiry research",
    "allowed_tools": ["search_kb", "draft_response"],
    "forbidden_actions": ["send_email", "delete_records"]
  },
  "created_at": "2026-04-01T00:00:00Z",
  "expires_at": "2026-04-02T00:00:00Z"
}`;

const EXAMPLE_RESPONSE = `{
  "agent_id": "550e8400-e29b-41d4-a716-446655440001",
  "agent_type": "analytical",
  "risk_tier": "not_set",
  "trust_score": 62,
  "grade": "C",
  "pass": true,
  "dimensions": [
    { "name": "Identity Completeness", "score": 63, "weight": 0.25 },
    { "name": "Permission Hygiene", "score": 87, "weight": 0.25 },
    { "name": "Behavioral Consistency", "score": 65, "weight": 0.20 },
    { "name": "Delegation Integrity", "score": 50, "weight": 0.15 },
    { "name": "Configuration Integrity", "score": 0, "weight": 0.15 }
  ],
  "gaps": [...],
  "field_count": { "present": 10, "total": 16 },
  "api_version": "v1"
}`;

export default function DocsPage() {
  const [tab, setTab] = useState<"api" | "sdk" | "cicd" | "badge">("api");

  const codeBlock = (code: string, lang = "") => (
    <pre
      style={{
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "14px 16px",
        fontSize: 12,
        lineHeight: "20px",
        overflowX: "auto",
        color: "#e2e8f0",
        margin: "10px 0 16px",
      }}
    >
      <code>{code}</code>
    </pre>
  );

  const heading = (text: string) => (
    <h3
      style={{
        fontSize: 15,
        fontWeight: 600,
        color: "#f1f5f9",
        marginTop: 28,
        marginBottom: 8,
      }}
    >
      {text}
    </h3>
  );

  const para = (text: string) => (
    <p
      style={{
        fontSize: 13,
        color: "rgba(255,255,255,0.5)",
        lineHeight: 1.6,
        marginBottom: 12,
      }}
    >
      {text}
    </p>
  );

  return (
    <div
      style={{
        maxWidth: 780,
        margin: "0 auto",
        padding: "20px 16px",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#94a3b8",
            textDecoration: "none",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          ← Back to Scanner
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
          Developer Docs
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            margin: 0,
          }}
        >
          Integrate AgentRight scoring into your agents, pipelines, and
          dashboards.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: 8,
        }}
      >
        {(
          [
            ["api", "REST API"],
            ["sdk", "SDK"],
            ["cicd", "CI/CD"],
            ["badge", "Badge"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "5px 14px",
              borderRadius: 5,
              border: "1px solid",
              borderColor:
                tab === key
                  ? "rgba(6,182,212,0.4)"
                  : "rgba(255,255,255,0.06)",
              background:
                tab === key ? "rgba(6,182,212,0.08)" : "transparent",
              color: tab === key ? "#06b6d4" : "#94a3b8",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* API Tab */}
      {tab === "api" && (
        <div>
          {heading("POST /api/scan")}
          {para(
            "Send an agent config as JSON. Get back a trust score, grade, dimension breakdown, and gap analysis. No authentication required. CORS enabled."
          )}

          {codeBlock(
            `curl -X POST https://agentright.vercel.app/api/scan \\
  -H "Content-Type: application/json" \\
  -d '${EXAMPLE_CONFIG}'`
          )}

          {heading("Response")}
          {para(
            "HTTP 200 with ScanResult JSON. The pass field is true if trust_score >= 50. Response headers include X-AgentRight-Score, X-AgentRight-Grade, and X-AgentRight-Pass for quick checks without parsing the body."
          )}
          {codeBlock(EXAMPLE_RESPONSE)}

          {heading("Error Codes")}
          {codeBlock(`400  Invalid JSON or missing Content-Type header
429  Rate limited (try again later)
500  Internal server error`)}

          {heading("Response Headers")}
          {codeBlock(`X-AgentRight-Score: 62
X-AgentRight-Grade: C
X-AgentRight-Pass: true`)}
        </div>
      )}

      {/* SDK Tab */}
      {tab === "sdk" && (
        <div>
          {heading("Agent Self-Registration")}
          {para(
            "Drop this into your agent's initialization code. On startup, the agent registers itself with AgentRight and gets scored. No human in the loop."
          )}

          {codeBlock(`// npm install @agentright/sdk  (coming soon)

import { register } from '@agentright/sdk';

// Call at agent initialization
const result = await register({
  agent_id: crypto.randomUUID(),
  agent_type: 'analytical',
  model_provider: 'anthropic',
  model_version: 'claude-sonnet-4-20250514',
  owner_id: 'engineering-team',
  authorizer_id: 'user:jane@company.com',
  permissions: [
    { resource: 'customer_db', actions: ['read'], scope: 'last_90_days' }
  ],
  behavioral_bounds: {
    purpose: 'Customer inquiry research',
    allowed_tools: ['search_kb'],
    forbidden_actions: ['send_email']
  },
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString()
});

console.log(result.trust_score); // 62
console.log(result.grade);       // "C"
console.log(result.pass);        // true`)}

          {heading("Python")}
          {codeBlock(`import requests

config = {
    "agent_id": "...",
    "agent_type": "analytical",
    # ... full config
}

result = requests.post(
    "https://agentright.vercel.app/api/scan",
    json=config
).json()

print(f"Score: {result['trust_score']}, Grade: {result['grade']}")`)}

          {heading("LangChain Integration")}
          {codeBlock(`# Add to your agent's startup
from langchain.callbacks import BaseCallbackHandler

class AgentRightCallback(BaseCallbackHandler):
    def on_chain_start(self, serialized, inputs, **kwargs):
        # Auto-register with AgentRight on first run
        requests.post("https://agentright.vercel.app/api/scan", json={
            "agent_type": "analytical",
            "model_provider": serialized.get("model_provider"),
            # ... map your config to the 16-field schema
        })`)}
        </div>
      )}

      {/* CI/CD Tab */}
      {tab === "cicd" && (
        <div>
          {heading("GitHub Actions")}
          {para(
            "Gate your deployments on trust score. If the agent config scores below 50, the pipeline fails. Same concept as the CLI exit code 2, but over HTTP."
          )}

          {codeBlock(`# .github/workflows/agentright.yml
name: AgentRight Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan agent config
        run: |
          RESPONSE=$(curl -s -w "\\n%{http_code}" \\
            -X POST https://agentright.vercel.app/api/scan \\
            -H "Content-Type: application/json" \\
            -d @agent-config.json)

          BODY=$(echo "$RESPONSE" | head -n -1)
          SCORE=$(echo "$BODY" | jq -r '.trust_score')
          GRADE=$(echo "$BODY" | jq -r '.grade')
          PASS=$(echo "$BODY" | jq -r '.pass')

          echo "Trust Score: $SCORE ($GRADE)"

          if [ "$PASS" = "false" ]; then
            echo "FAIL: Trust score below 50. Deployment blocked."
            echo "$BODY" | jq '.gaps[] | {severity, field, message}'
            exit 2
          fi

          echo "PASS: Agent config meets minimum trust threshold."`)}

          {heading("GitLab CI")}
          {codeBlock(`# .gitlab-ci.yml
agentright-scan:
  stage: test
  script:
    - |
      RESULT=$(curl -s -X POST https://agentright.vercel.app/api/scan \\
        -H "Content-Type: application/json" \\
        -d @agent-config.json)
      PASS=$(echo $RESULT | jq -r '.pass')
      if [ "$PASS" = "false" ]; then
        echo "AgentRight: FAIL"
        exit 2
      fi`)}

          {heading("Pre-commit Hook")}
          {codeBlock(`#!/bin/bash
# .git/hooks/pre-commit

if [ -f agent-config.json ]; then
  SCORE=$(curl -s -X POST https://agentright.vercel.app/api/scan \\
    -H "Content-Type: application/json" \\
    -d @agent-config.json | jq -r '.trust_score')

  if [ "$SCORE" -lt 50 ]; then
    echo "AgentRight: Score $SCORE is below 50. Fix config before committing."
    exit 1
  fi
fi`)}
        </div>
      )}

      {/* Badge Tab */}
      {tab === "badge" && (
        <div>
          {heading("Trust Badge")}
          {para(
            "Show your agent's trust score in your README, dashboard, or UI. The badge is a dynamic SVG served from the API."
          )}

          <div
            style={{
              padding: 20,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 12, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Preview:
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { score: 94, grade: "A" },
                { score: 62, grade: "C" },
                { score: 26, grade: "D" },
              ].map(({ score, grade }) => (
                <img
                  key={grade}
                  src={`/api/badge?score=${score}&grade=${grade}`}
                  alt={`AgentRight ${score} ${grade}`}
                  style={{ height: 20 }}
                />
              ))}
            </div>
          </div>

          {heading("Markdown (GitHub README)")}
          {codeBlock(
            `![AgentRight](https://agentright.vercel.app/api/badge?score=94&grade=A)`
          )}

          {heading("HTML")}
          {codeBlock(
            `<img src="https://agentright.vercel.app/api/badge?score=94&grade=A" alt="AgentRight Score" />`
          )}

          {heading("After API Scan")}
          {para(
            "Scan your agent via the API, then build the badge URL from the response."
          )}
          {codeBlock(`const result = await fetch('/api/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(agentConfig)
}).then(r => r.json());

const badgeUrl = \`https://agentright.vercel.app/api/badge?score=\${result.trust_score}&grade=\${result.grade}\`;

// Use in your agent's UI, dashboard, or README`)}
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          marginTop: 40,
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>
          AgentRight · MIT License · github.com/agentright
        </p>
      </footer>
    </div>
  );
}
