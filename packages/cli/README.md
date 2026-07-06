# agentright

Pre-deployment governance scanning for AI agents. Scan a config, get a trust score, gate your deployments.

```bash
npx agentright scan your-config.json
```

Supports native configs, MCP server configs, and CrewAI definitions. Exit codes are CI/CD-native: `0` pass (score >= 50), `2` fail, `1` error.

```bash
agentright scan config.json --json    # machine-readable output
```

Part of [AgentRight](https://github.com/Ganesh-WeekendBuilds/agentright). MIT License.
