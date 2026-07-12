# agentright

CLI for AgentRight. Scan agent configs from the terminal.

Supports native configs and popular agent framework definitions. Exit codes are CI/CD-native: `0` pass (score >= 50), `2` fail, `1` error.

## Usage

```bash
npx agentright scan agent-config.json
```

## Options

```bash
agentright scan <file>         # scan a config file
agentright scan <file> --json  # JSON output for piping
```

## License

MIT
