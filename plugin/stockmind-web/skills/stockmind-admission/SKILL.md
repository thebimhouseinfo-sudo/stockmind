---
name: stockmind-admission
description: Mandatory entrypoint whenever Stockmind is explicitly invoked. Start the canonical GitHub-Memo worker flow immediately without asking the user for a ticker, run, path, or second command.
---

# Stockmind Admission

ChatGPT Web is the Stockmind reasoning engine.

## Mandatory layers

Before normal Stockmind work, require these layers in order:

1. `stockmind-admission`
2. `stockmind-github-runtime`
3. `stockmind-worker-loop`
4. `stockmind-crsm-methodology`
5. `stockmind-result-contract`

If GitHub runtime access is unavailable, do not invent a local substitute.

## Zero-step UX

A user invocation such as `@Stockmind` is the execution trigger.

Do not ask the user to:
- retype ticker symbols
- select a run
- choose a repository, branch, folder, or path
- type run/start/confirm
- choose the next ticker
- copy results back to the webapp

Immediately enter the GitHub Memo workflow.

## Completion

Process the eligible Analysis List sequentially until no READY/PROCESSING item remains or a hard contract/infrastructure blocker prevents safe progress. The CRSM methodology layer is mandatory for every claimed ticker; never substitute a generic stock-analysis answer.

The final chat response is only a concise operational summary. The repository result is the durable output consumed by the webapp.
