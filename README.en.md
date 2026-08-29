<p align="center">
  <img src=".github/og.png" alt="unai — a nocturnal print workshop where only the affected passages are repaired and the writer's voice returns" width="100%">
  <br>
  <sub><em>This world represents finding only the affected passages among uniform machine-made prose and returning the writer's own voice.</em></sub>
</p>

# unai

[![CI](https://github.com/kitepon/unai/actions/workflows/ci.yml/badge.svg)](https://github.com/kitepon/unai/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/kitepon/unai?color=24292e&logo=github)](https://github.com/kitepon/unai/releases)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[日本語](README.md) · **English**

> **Put the writer back into AI-written Japanese.**
> unai diagnoses fingerprints in Japanese prose written by AI and fixes only the affected passages instead of rewriting the whole piece. It runs on Claude Code, Codex, Grok, and Cursor.

Built and maintained by [Quo](https://x.com/QLyun35332) at [kitepon.dev](https://kitepon.dev/en/#systems).

## In 30 seconds

```text
/unai review draft.md      # diagnose; do not edit the text
/unai refactor draft.md    # make only the necessary local fixes
Write the article following unai.  # apply the rules while writing
```

`review` returns evidence with verbatim excerpts. `refactor` changes only the passages it identified,
preserving the original claims, information, structure, and writer-specific choices.

## Why Japanese needs its own pass

English-language de-AI tools target the fingerprints of English AI writing. Japanese prose has different
vocabulary, syntax, social distance, and emotional cues, so unai's rules are built from Japanese examples
rather than translated from English rules.

| | unai | [sepia](https://github.com/Nanako0129/sepia) | [humanizer](https://github.com/blader/humanizer) |
|---|---|---|---|
| Target language | **Japanese** | English | English |
| Editing method | Diagnose, then make minimal local fixes | Three passes; fiction starts from structure | Remove 35 patterns |
| Writer's voice | Per-writer voice profile | None | Adjust with style samples |
| Apply while writing | Yes (`write`) | Yes | No |

Instead of paraphrase lists, unai works from the root cause: text with no writer in it — averaged style,
hedged everything, no gaps left for the reader, emotion performed with symbols. It diagnoses the visible
symptoms and fixes only the offending spots.

## What counts as a fingerprint (excerpt)

- Habitual "not X, but Y" framing that spends a line on information-free negation
- English words and identifiers jammed into Japanese prose (each may be legal; the density kills the text)
- Insurance prefaces ("to be honest", "actually") before the point
- Identical paragraph structure in every piece, one emoji per paragraph, uniform hedged endings
- Formulaic closers ("worth keeping an eye on!")

Over-correction is also a fingerprint: prose that obeys every rule uniformly is a new kind of absence. unai edits minimally.

Full rules (Japanese): [skills/unai/references/core-pass.md](skills/unai/references/core-pass.md)

## Install

Claude Code:

```bash
claude plugin marketplace add kitepon/unai
claude plugin install unai@unai
```

Codex / Grok / Cursor (also fine for Claude Code):

```bash
curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
```

On native Windows, run the PowerShell 7 installer:

```powershell
irm https://raw.githubusercontent.com/kitepon/unai/main/install.ps1 | iex
```

Re-run the same line to update. Uninstall: `bash ~/.local/share/unai/install.sh --uninstall`

The installer also places the `unai` CLI in `~/.local/bin`. It exposes the version and a read-only factory diagnostic:

```bash
unai --version
unai factory-diagnostics --json
```

## Usage

```
/unai review draft.md      # diagnose only
/unai refactor draft.md    # minimal fixes
Write the article following unai.
```

Choose how broadly it applies:

1. **On demand** (default): installing does nothing by itself; it works only when invoked as above
2. **Always-on for one project**: add the line below to that project's instruction file — it then applies automatically, but only inside that folder (e.g. just your blog repo)
3. **Always-on everywhere**: add the same line to the host's global instructions

```
文章・返答の文体はunai skillの規範に従う。
```

Where the line goes, per host:

| Host | One project (2) | Everywhere (3) |
|---|---|---|
| Claude Code | `CLAUDE.md` | `~/.claude/CLAUDE.md` |
| Codex | `AGENTS.md` | `~/.codex/AGENTS.md` |
| Grok Build | `AGENTS.md` | `~/.grok/rules/AGENTS.md` |
| Cursor | `AGENTS.md` or `.cursor/rules/` | a rules file under `~/.cursor/rules/` |

Locations can vary by host version; if these don't match, check your host's docs for its instruction/rules file location.

## Voice profile

De-AI'd text still needs *your* voice. Put your first-person choice, sentence endings, banned words, and allowed looseness in `~/.unai/voice.md` (or per-project `.unai/voice.md`); unai gives it priority over the core rules. See [skills/unai/references/voice-profile.md](skills/unai/references/voice-profile.md).

## License

MIT

## Support and security

Use [GitHub Issues](https://github.com/kitepon/unai/issues) for usage questions and bug reports. Do not disclose vulnerabilities in a public issue; follow the [security policy](SECURITY.md) instead.
