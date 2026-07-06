# Contributing to AgentRight

Thank you for your interest in contributing. This project is in its early stages and we welcome contributions of all kinds.

## How to Contribute

### Report Issues
Found a bug, have a feature request, or want to suggest an improvement? Open an issue on GitHub.

### Submit a Parser
AgentRight needs parsers for every agent framework. If you use an agent framework that isn't supported yet, consider writing a parser that maps its config format to the AgentRight 16-field schema.

A parser should:
- Accept the framework's native config format (JSON, YAML, or other)
- Map available fields to the AgentRight identity schema
- Return a normalized AgentRight config object
- Handle missing fields gracefully (mark as absent, don't error)

### Submit Test Configs
Real-world agent configurations (anonymized) help us validate and improve the scoring engine. If you can share a sanitized version of your agent config, submit it as a PR to the `examples/` directory.

### Improve Scoring Rules
The scoring engine is rule-based and deterministic. If you have expertise in a specific compliance framework (NIST AI RMF, SR 11-7, EU AI Act, PCI-DSS), you can contribute scoring rules that map our schema fields to that framework's requirements.

### Improve Documentation
Clear documentation is critical for adoption. Improvements to the README, inline code comments, or the docs directory are always welcome.

## Development Setup

```bash
git clone https://github.com/YOUR_USERNAME/agentright.git
cd agentright
npm install
npm test
```

## Code Style

- TypeScript for all source code
- Clear variable names over clever ones
- Comments explain "why", not "what"
- Every function should have a brief JSDoc description

## Pull Request Process

1. Fork the repo and create a feature branch
2. Make your changes with clear commit messages
3. Add or update tests for any new functionality
4. Ensure all tests pass
5. Submit a PR with a description of what changed and why

## Code of Conduct

Be respectful. Be constructive. Focus on the work.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
