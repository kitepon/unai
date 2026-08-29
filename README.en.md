<p align="center"><img src=".github/og.png" alt="unai — strip AI flavor from Japanese text" width="100%"></p>

<p align="center"><a href="https://kitepon.dev/en/#systems"><img src=".github/kitepon-dev-on-night.png" alt="kitepon.dev" width="180"></a></p>
<p align="center"><strong>A kitepon.dev AI Development System</strong></p>

# unai — strip AI flavor from Japanese text

> An agent skill that diagnoses "AI-ness" in Japanese prose written by AI and removes it with minimal edits. Works on Claude Code, Codex, Grok, and Cursor.

[日本語](README.md)

English-language de-AI tools (sepia, humanizer, etc.) target the fingerprints of English AI writing. Japanese AI writing has its own, different fingerprints — unai is built specifically for Japanese.

Instead of paraphrase lists, unai works from the root cause: text with no writer in it — averaged style, hedged everything, no gaps left for the reader, emotion performed with symbols. It diagnoses the visible symptoms and fixes only the offending spots.

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
