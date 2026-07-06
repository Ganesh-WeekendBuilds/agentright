# @agentright/core

The scoring engine behind [AgentRight](https://github.com/Ganesh-WeekendBuilds/agentright). Pre-deployment governance assessment for AI agents. Rule-based, deterministic, no LLM calls.

```bash
npm install @agentright/core
```

```ts
import { scoreAgent, adapt, computeCeiling } from "@agentright/core";

const result = scoreAgent(config);   // { trust_score, grade, dimensions, gaps, ... }
```

Scores agent configs across six weighted dimensions: Identity, Permissions, Behavioral, Delegation, Configuration, Data Sovereignty. Adapts MCP and CrewAI configs onto a canonical model and computes each framework's governance ceiling.

MIT License.
