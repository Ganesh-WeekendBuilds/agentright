# @agentright/core

Scoring engine and adapter layer for AgentRight. Single source of truth for schema, parser, scorer, and framework adapters.

Scores agent configs across six weighted dimensions: Identity, Permissions, Behavioral, Delegation, Configuration, Data Sovereignty. Adapts popular agent framework configs onto a canonical model and computes each format's governance ceiling.

All scoring is rule-based and deterministic. No LLM calls.

## Install

```bash
npm install @agentright/core
```

## Usage

```typescript
import { parseConfigString, scoreAgent } from '@agentright/core';

const { config } = parseConfigString(jsonOrYamlString);
const result = scoreAgent(config);

console.log(result.trust_score); // 0-100
console.log(result.grade);       // A/B/C/D/F
console.log(result.gaps);        // severity-sorted gap list
```

## License

MIT
