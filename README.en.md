<p align="center"><img src=".github/og.png" alt="unai — strip AI flavor from Japanese text" width="100%"></p>

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

Re-run the same line to update. Uninstall: `bash ~/.local/share/unai/install.sh --uninstall`

## Usage

```
/unai review draft.md      # diagnose only
/unai refactor draft.md    # minimal fixes
Write the article following unai.
```

To apply to every assistant reply, add one line to your global instructions (e.g. `~/.claude/CLAUDE.md`):

```
文章・返答の文体はunai skillの規範に従う。
```

## Voice profile

De-AI'd text still needs *your* voice. Put your first-person choice, sentence endings, banned words, and allowed looseness in `~/.unai/voice.md` (or per-project `.unai/voice.md`); unai gives it priority over the core rules. See [skills/unai/references/voice-profile.md](skills/unai/references/voice-profile.md).

## License

MIT
