# Contributing to claude-usage-hub

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 9
- [Docker](https://www.docker.com/) (for running the server locally)

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone git@github.com:your-username/claude-usage-hub.git
   cd claude-usage-hub
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Start development:
   ```bash
   pnpm dev
   ```

## Project Structure

```
packages/
  shared/       # Shared types, schemas, and utilities
  collector/    # Background agent that runs on developer machines
  server/       # Hono API server with SQLite
  dashboard/    # React web dashboard
```

## Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```
2. Make your changes
3. Run tests:
   ```bash
   pnpm test
   ```
4. Run linting:
   ```bash
   pnpm lint
   ```
5. Commit with a descriptive message
6. Push and open a pull request

## Code Style

- TypeScript strict mode is enabled
- Use ESLint and Prettier (run `pnpm lint` and `pnpm format`)
- Write tests for new functionality using Vitest

## Commit Messages

Use clear, descriptive commit messages:

- `feat: add daily usage chart to dashboard`
- `fix: correct token count aggregation for subagents`
- `docs: update collector installation guide`
- `refactor: simplify JSONL parser streaming logic`

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include steps to reproduce for bugs
- Include your OS, Node.js version, and Claude Code version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
