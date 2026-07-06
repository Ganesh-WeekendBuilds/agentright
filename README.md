# AgentRight

Pre-deployment governance scanning for AI agents. Ship agents right.

Runtime tools watch agents after they're live. Nobody checks whether an agent should exist in the first place. AgentRight is the building inspector: point it at an agent's configuration before deployment and it tells you whether the agent is governable. Who owns it. What it can touch. When its access expires. Whether a human authorized it.

All scoring is rule-based and deterministic. Same config, same score, every time. No LLM calls anywhere in the product.

## Scan anything, not just our format

AgentRight scores whatever agent artifacts you already have:

| Input | Example |
|---|---|
| Native configs (16-field schema) | `agent.json`, `agent.yaml` |
| MCP server configs | `.mcp.json`, `claude_desktop_config.json` |
| CrewAI definitions | `agents.yaml` |

Framework configs get mapped onto the canonical model. Gaps split into two kinds: things you did not configure, and things your framework **cannot express**. The second kind sets a governance ceiling: the maximum score achievable in that format. In testing against real-world examples, popular agent frameworks structurally cap out at a failing grade because their config formats have no fields for identity, ownership, expiry, or data sovereignty.

## Quick start

```bash
npx agentright scan your-config.json
```

Exit codes are CI/CD-native: `0` pass (score >= 50), `2` fail, `1` error. Drop it in a pipeline and ungoverned agents stop shipping.

## GitHub Action

Gate every push on agent governance. Three lines in your workflow:

```yaml
- uses: Ganesh-WeekendBuilds/agentright@v0
  with:
    config: ./agent-config.json
    threshold: "50"          # build fails below this score
    # fail-on-gap: critical  # optional: also block on any critical gap
```

Inputs: `config` (required), `threshold` (default 50), `fail-on-gap` (critical/high/medium/low/none, default none).
Outputs: `score`, `grade`, `pass`.

For multi-agent files, the worst agent's score gates the build. Note that `fail-on-gap` is stricter than score-gating: a config can score 95/A and still be blocked if it carries one critical gap (for example an expired identity). Use score thresholds for a soft gate, severity gates for a hard one.

## How scoring works

Five weighted dimensions:

| Dimension | Weight | Question it answers |
|---|---|---|
| Identity Completeness | 20% | Is the agent's identity fully described? |
| Permission Hygiene | 20% | Least privilege, or wildcards and delete access? |
| Behavioral Consistency | 20% | Purpose, allowed tools, forbidden actions, escalation? |
| Delegation Integrity | 15% | Does authority trace back to a human? Signed? |
| Configuration Integrity | 10% | Hash, approved template, pinned model version? |
| Data Sovereignty | 15% | Data residency, output routing, provider lock-in declared? |

Grades: A (90+), B (75+), C (50+), D (25+), F (below 25).

## Repo structure

```
packages/core    @agentright/core — schema, parser, scorer, adapters.
                 The single source of truth. Every surface imports this.
packages/cli     agentright on npm. Thin shell: args in, exit codes out.
apps/web         agentright.vercel.app (or your domain). Scanner UI, fleet dashboard, PDF
                 reports, REST API (/api/scan), trust badges (/api/badge).
```

One engine, many front doors. A scoring rule changes in exactly one place.

## Development

```bash
npm install
npm run build          # core, then cli, then web
npm run scan -- packages/core/examples/good-agent.json
cd apps/web && npm run dev
```

## API

```bash
curl -X POST https://agentright.vercel.app/api/scan \
  -H "Content-Type: application/json" \
  -d @agent-config.json
```

Returns the full scan result plus a `pass` boolean. Agents can self-register at boot. Pipelines can gate on the `X-AgentRight-Pass` header.

## License

MIT. Copyright 2026 Ganeshmoorthy Buvanendran.
