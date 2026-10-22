# Security policy

## Reporting a vulnerability
Please don't open a public issue for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/positromen/Sarthi-AI/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a reply within a
week, and a fix or a plan within 30 days for confirmed issues. Credit is given in the release notes unless you'd
rather stay anonymous.

## In scope
- Sarthi's windows becoming visible in a screen share or recording while private mode is on.
- API keys leaving the main process, being written unencrypted, or appearing in logs or debug info.
- A renderer or remote content gaining access to files, keys or Node.js APIs.
- User data sent anywhere other than the provider the user chose.

## Supported versions
Only the latest release receives security fixes.
