# Security policy

## Supported versions

We aim to support the **latest tagged release** and **`main`** for security fixes. Older tags may not receive backports unless agreed in the specific advisory thread.

## Reporting a vulnerability

**Please do not open a public issue** for security vulnerabilities.

1. Open a **[GitHub Security Advisory](https://github.com/yogthesharma/boson-dev/security/advisories/new)** (private report to maintainers), or  
2. If you cannot use GitHub, contact the maintainers with enough detail to reproduce the issue and we will coordinate privately.

Include:

- Affected component (CLI, server, installer, release workflow, etc.)
- Steps to reproduce or proof-of-concept (if safe to share)
- Suspected impact (confidentiality / integrity / availability)

We will acknowledge receipt as soon as we can and work toward a fix and disclosure timeline.

## Scope (examples)

In scope: the `boson` binary, `install.sh`, GitHub Actions release workflow, and documented install/update paths.

Out of scope (unless it affects Boson directly): third-party dependencies, your own API backends, or issues in forks not merged upstream.

## Safe harbor

We support good-faith security research that follows this policy. Do not access data that is not yours, and do not degrade production services.
