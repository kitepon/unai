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

> **Remove AI-like phrasing from Japanese while keeping the writer's voice.**
> unai diagnoses unnatural formulaic phrasing in Japanese and makes local edits while preserving content and voice. It runs on Claude Code, Codex, Grok, and Cursor.

Built and maintained by [Quo](https://x.com/QLyun35332) at [kitepon.dev](https://kitepon.dev/en/#systems).

The current release is **unai 0.5.0**.

## In 30 seconds

```text
/unai review draft.md      # diagnose; do not edit the text
/unai refactor draft.md    # make only the necessary local fixes
Write the article following unai.  # apply the rules while writing
```

`review` returns evidence with verbatim excerpts. `refactor` changes only the passages it identified,
preserving the original claims, information, structure, and writer-specific choices.

## What unai changes

unai edits formulaic expressions and mechanical repetition that do not fit their context. A word or
sentence pattern alone is not evidence of a problem. It considers the passage's purpose, audience,
and voice before making a local change.

Examples include generic praise or generalities attached to a practical answer, empty contrasts,
repeated templates unrelated to the content, and grand wording that substitutes for a concrete explanation.

It preserves reasons, conditions, examples, necessary detail, and the writer's voice. Summarizing or
restructuring requires a request for that work. unai does not prescribe reply length or conversational behavior.

Cute characters, emotion, humor, metaphors, emoji, and catchphrases are legitimate expression, with or
without a voice profile. Turning a joyful “やったぁ、できたよっ！ えへへ🌸” into “完了しました。”
would erase the character's voice and fail unai's purpose.

See the [criteria and paired examples](skills/unai/references/core-pass.md) and
[chat and dialogue examples](skills/unai/references/domains/chat-replies.md), both in Japanese.
unai is not an AI-authorship detector.

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

The installer projects the skill into all four supported harness surfaces: Claude Code, Codex, Grok, and Cursor. Re-run the same line to update.

For Codex, the installer uses only the official user-skill surface at `~/.agents/skills/unai`. Use the legacy profile only for an older Codex entry point that still requires `~/.codex/skills/unai`; the installer never deploys both surfaces at once.

Explicit legacy profile on macOS / Linux:

```bash
bash "${XDG_DATA_HOME:-$HOME/.local/share}/unai/install.sh" --profile legacy
```

Explicit legacy profile on Windows:

```powershell
& "$env:LOCALAPPDATA\unai\install.ps1" -Profile legacy
```

Uninstall on macOS / Linux:

```bash
bash "${XDG_DATA_HOME:-$HOME/.local/share}/unai/install.sh" --uninstall
```

Uninstall on Windows after using the one-line installer above:

```powershell
& "$env:LOCALAPPDATA\unai\install.ps1" -Uninstall
```

If you installed from a local clone, run `install.sh --uninstall` or `install.ps1 -Uninstall` from that clone. The current installer removes only skill and CLI wiring that still points to that clone, and leaves the repository in place. Between clones that both contain this ownership check, an older clone's uninstaller does not remove wiring that a newer clone has replaced.

An installer from an earlier tag may predate this ownership check. Before using one, inspect the skill and CLI link targets. If they already point to another clone, do not run that old uninstaller; remove only the unused old clone.

### If the installer says it will not overwrite a real file

When a regular file or directory already occupies a skill or CLI destination, the installer preserves it. If the skill does not match the distributed bundle, or a user-owned CLI remains, the installer prints diagnostic JSON and exits nonzero instead of reporting success. Inspect the exact path it prints. If the item is yours, rename it to a backup and then run the installer again; do not delete it before checking its contents.

macOS / Linux example:

```bash
ls -ld ~/.agents/skills/unai ~/.local/bin/unai
unai_conflict="$HOME/.agents/skills/unai"
mv "$unai_conflict" "$unai_conflict.before-unai"
curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
```

Windows example:

```powershell
Get-Item -Force "$HOME\.agents\skills\unai", "$HOME\.local\bin\unai.ps1" |
  Format-List FullName, LinkType, Target, Attributes
$unaiConflict = "$HOME\.agents\skills\unai"
Move-Item -LiteralPath $unaiConflict -Destination "$unaiConflict.before-unai"
irm https://raw.githubusercontent.com/kitepon/unai/main/install.ps1 | iex
```

For a CLI conflict, back up `~/.local/bin/unai` (or `~/.local/bin/unai.ps1` on Windows) in the same way. Decide whether to merge or remove the backup only after inspecting it.

The installer also places the `unai` CLI in `~/.local/bin`. It exposes the version and a read-only factory diagnostic:

```bash
unai --version
unai factory-diagnostics --json
```

### Read-only factory diagnostics contract

`factory-diagnostics --json` inspects unai's manifests, runtime, skill bundle, and projections into all four harnesses. When the diagnostic runs, it writes one line of JSON to stdout for both ready and not-ready results. Add `--profile legacy` when using the legacy Codex surface.

```json
{
  "schema": "unai.native_factory_diagnostics.v2",
  "product": { "name": "unai", "version": "0.5.0" },
  "checks": {
    "manifest_consistency": "pass",
    "node_runtime": "pass",
    "skill_bundle": "pass",
    "skill_projections": {
      "claude": "ready",
      "codex": "ready",
      "grok": "ready",
      "cursor": "ready"
    }
  },
  "overall": "ready"
}
```

The only top-level fields are `schema`, `product`, `checks`, and `overall`.

| Field | Contract |
|---|---|
| `schema` | Always `unai.native_factory_diagnostics.v2` |
| `product` | `name` is `unai`; `version` is the SemVer from the plugin manifest |
| `checks` | Three product checks plus `skill_projections` |
| Product-check status | `pass` or `fail`; there is no top-level `status` field |
| Projection status | Each host is `ready`, `missing`, `stale`, or `conflict` |
| `overall` | `ready` only when all three product checks pass and all four projections are ready |

- `manifest_consistency`: the names, versions, and source in the plugin and marketplace manifests agree
- `node_runtime`: the running Node.js satisfies `package.json`'s `engines.node` (currently `>=22.13`)
- `skill_bundle`: the distributed skill and its required references are readable
- `skill_projections`: the Claude Code, Codex, Grok, and Cursor destinations use the current bundle

A direct symlink or junction to this product bundle is `ready`; so is a directory copy whose contents match the bundle exactly. A missing destination is `missing`, an outdated real directory or dangling link is `stale`, and a regular file, link to another bundle, or coexistence of the official and legacy Codex surfaces is `conflict`. Absolute paths are not emitted.

| Exit | stdout / stderr | Meaning |
|---|---|---|
| `0` | Diagnostic JSON on stdout | `overall: "ready"` |
| `1` | Diagnostic JSON on stdout | `overall: "not_ready"` |
| `2` | Usage on stderr; no diagnostic JSON | Invalid arguments |

The diagnostic neither reads nor emits prose under review, usage history, absolute paths, or secrets.

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

A voice profile is optional. Without one, unai still preserves the voice and character specified in
the text or conversation. Store recurring preferences in `~/.unai/voice.md` or a project's
`.unai/voice.md`. The current request takes priority; stylistic preferences take precedence over
general editing criteria. Expressions omitted from a profile remain available.

You can describe the character, relationship, sentence endings, or favorite expressions, and optionally
provide a writing sample. See [voice-profile.md](skills/unai/references/voice-profile.md).

The [behavioral test cases](tests/prose-cases.md) cover both preserving detail and expressive voices,
and removing context-inappropriate formulas.

## License

MIT

Maintainer contracts: [product and documentation ownership](AGENTS.md), [release and rollback](RELEASE.md).

## Support and security

Use [GitHub Issues](https://github.com/kitepon/unai/issues) for usage questions and bug reports. Do not disclose vulnerabilities in a public issue; follow the [security policy](SECURITY.md) instead.
