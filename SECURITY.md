# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue.**
2. Use [GitHub's private vulnerability reporting](https://github.com/GeiserX/ghost-github-portfolio/security/advisories/new).
3. Alternatively, email the maintainer directly.

You should receive an acknowledgment within 48 hours and a resolution within 7 days for critical issues.

## Scope

This tool handles:
- **Ghost Admin API keys** (JWT signing secrets)
- **GitHub tokens** (optional, for higher rate limits)

Both are sensitive credentials. The tool never logs, stores, or transmits these beyond the API calls they are intended for.
