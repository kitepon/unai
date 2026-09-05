<p align="center">
  <img src=".github/og.png" alt="unai — 夜の印刷工房" width="100%">
</p>

# unai

[![CI](https://github.com/kitepon/unai/actions/workflows/ci.yml/badge.svg)](https://github.com/kitepon/unai/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/kitepon/unai?color=24292e&logo=github)](https://github.com/kitepon/unai/releases)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**日本語** · [English](README.en.md)

> **日本語のAI特有の言葉遣いを直す。**
> unaiは「側」「筋」「ではなく〜」などの不自然な使い方を直すagent skillです。Claude Code、Codex、Grok、Cursorで動きます。

[kitepon.dev](https://kitepon.dev/#systems)所属の[クオ](https://x.com/QLyun35332)が開発・運営しています。

現在のreleaseは **unai 0.6.2** です。

## 30秒でできること

```text
/unai review 下書き.md        # 問題箇所を診断する。文章は変更しない
/unai refactor 下書き.md      # 該当箇所だけを最小修正する
記事を書いて。unaiに従って     # 執筆時から言葉遣いに適用する
```

`review`は指摘、`refactor`は該当する言葉遣いの修正、`write`は執筆時の適用です。

## 対象

AI特有の不自然な言葉遣いを、該当箇所だけ直します。

| 修正前 | 修正例 |
|---|---|
| 実装の側で直す | 実装を直す |
| その筋で進める | その方針で進める |
| 指示ではなく会話する | 会話する |
| 地味に便利 | 便利 |
| 修正は1行。 | 直すのは1行で済んだ。 |

説明のない横文字、本題の前に付けるだけの断り、意図にない卑下や偶然扱い、無理な強調や飾りの言い換えも対象です。通常の意味で使う語や、区別に必要な否定はそのままにします。

文章への指示は [SKILL.md](skills/unai/SKILL.md) 一枚にすべて載っています。

## インストール

### Claude Code

```bash
claude plugin marketplace add kitepon/unai
```

続けて対話中に `/plugin` からunaiをインストールするか:

```bash
claude plugin install unai@unai
```

### Codex / Grok / Cursor（Claude Codeでも可）

```bash
curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
```

Windows nativeではPowerShell 7から実行します。

```powershell
irm https://raw.githubusercontent.com/kitepon/unai/main/install.ps1 | iex
```

Claude Code、Codex、Grok、Cursorの4つの部品置き場（`~/.claude/skills/unai` 等）へ繋ぎ込みます。更新は同じ1行の再実行です。

Codexは公式のuser skill面`~/.agents/skills/unai`だけへ配置します。旧Codexで`~/.codex/skills/unai`が必要な場合だけ、取得済みinstallerを`--profile legacy`（Windowsは`-Profile legacy`）付きで実行してください。公式面と旧面は同時に配置しません。

macOS / Linuxで旧面を明示する例:

```bash
bash "${XDG_DATA_HOME:-$HOME/.local/share}/unai/install.sh" --profile legacy
```

Windowsで旧面を明示する例:

```powershell
& "$env:LOCALAPPDATA\unai\install.ps1" -Profile legacy
```

外すときは、導入したOSの入口を使います。skillとCLIの繋ぎ込みだけを外し、取得したrepoは残します。

macOS / Linux:

```bash
bash "${XDG_DATA_HOME:-$HOME/.local/share}/unai/install.sh" --uninstall
```

Windows（上の1行で導入した場合）:

```powershell
& "$env:LOCALAPPDATA\unai\install.ps1" -Uninstall
```

手元のcloneから導入した場合は、そのcloneにある`install.sh --uninstall`または`install.ps1 -Uninstall`を実行してください。現在のinstallerは、そのcloneを指しているskillとCLIだけを外します。同じ所有権判定を備えた別versionのcloneから最新版へ張り直した後なら、古いclone側のuninstallで現在の配線は消えません。

この判定を含まない過去tagのinstallerを使う場合は、実行前にskillとCLIのリンク先を確認してください。すでに別cloneを指しているなら、その過去installerでuninstallせず、残った過去cloneだけを削除します。

### 「実ファイルがあるため上書きしない」と出たとき

installerは、skillの配置先やCLIの配置先に通常のファイル／ディレクトリがあると、それを消さずに保持します。配布bundleと一致しないskillや利用者のCLIが残れば、診断JSONを出して非0終了し、成功とは表示しません。まず表示された対象が自分の資産かを確認し、必要なら名前を変えて退避してからinstallerをもう一度実行してください。リンクやジャンクションなら`LinkType`／`Target`も確認できます。

macOS / Linuxの例:

```bash
ls -ld ~/.agents/skills/unai ~/.local/bin/unai
unai_conflict="$HOME/.agents/skills/unai"
mv "$unai_conflict" "$unai_conflict.before-unai"
curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
```

Windowsの例:

```powershell
Get-Item -Force "$HOME\.agents\skills\unai", "$HOME\.local\bin\unai.ps1" |
  Format-List FullName, LinkType, Target, Attributes
$unaiConflict = "$HOME\.agents\skills\unai"
Move-Item -LiteralPath $unaiConflict -Destination "$unaiConflict.before-unai"
irm https://raw.githubusercontent.com/kitepon/unai/main/install.ps1 | iex
```

競合しているのがCLIなら、同じ手順で`~/.local/bin/unai`（Windowsは`~/.local/bin/unai.ps1`）を退避します。退避物を削除するか統合するかは、中身を確認してから決めてください。

installerは`unai` CLIも`~/.local/bin`へ配置します。版数と工場向けread-only診断は次の入口です。

```bash
unai --version
unai factory-diagnostics --json
```

### 工場向けread-only診断の契約

`factory-diagnostics --json`は、unai自身のmanifest・実行環境・skill bundleと4ホストへの投影を読む診断入口です。成功・不成功のどちらでも、診断が実行できた場合はstdoutへ1行のJSONを返します。legacy Codex面を使う場合は`--profile legacy`を加えます。

```json
{
  "schema": "unai.native_factory_diagnostics.v2",
  "product": { "name": "unai", "version": "0.6.2" },
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

top-level fieldは`schema`、`product`、`checks`、`overall`の4つだけです。

| field | 契約 |
|---|---|
| `schema` | 常に`unai.native_factory_diagnostics.v2` |
| `product` | `name`は`unai`、`version`はplugin manifestのSemVer |
| `checks` | 3つの製品checkと`skill_projections` |
| 製品checkのstatus | `pass`または`fail`。top-levelの`status` fieldはありません |
| projectionのstatus | 各hostは`ready`、`missing`、`stale`、`conflict`のいずれか |
| `overall` | 3つの製品checkが`pass`かつ4面が`ready`なら`ready`、それ以外は`not_ready` |

- `manifest_consistency`: plugin manifestとmarketplace manifestの名前・版数・sourceが一致している
- `node_runtime`: 実行中のNode.jsが`package.json`の`engines.node`（現在は`>=22.13`）を満たす
- `skill_bundle`: 配布するSKILL.mdを読める
- `skill_projections`: Claude Code、Codex、Grok、Cursorの配置先が現在のbundleを使っている

projectionは、この製品bundleを直接指すsymlink／junction、または内容が完全一致するdirectory copyだけが`ready`です。配置先がなければ`missing`、実体directoryの内容が古いかdangling linkなら`stale`、通常file、別bundleへのlink、Codexの公式面とlegacy面の同居は`conflict`です。絶対pathはJSONへ出しません。

| exit | stdout / stderr | 意味 |
|---|---|---|
| `0` | stdoutに診断JSON | `overall: "ready"` |
| `1` | stdoutに診断JSON | `overall: "not_ready"` |
| `2` | stderrにusage、診断JSONなし | 引数が不正 |

この診断は校正対象の文章、利用履歴、絶対path、secretを読み取りも出力もしません。

## 使い方

```
/unai review 下書き.md        # 診断だけ（編集しない）
/unai refactor 下書き.md      # 該当箇所だけ最小修正
記事を書いて。unaiに従って     # 執筆時に最初から適用
```

AIからも呼べます。文章を書く作業の中で「unaiに従う」と指示されれば、AIが自分の出力に適用します。

### 適用範囲は3段階から選ぶ

1. **使う時だけ**（既定）: 導入しただけでは何も起きません。上の使い方のように呼んだ時だけ働きます
2. **特定のプロジェクトだけ常時**: そのプロジェクトの指示ファイルに下の1行を書くと、そのフォルダでの作業だけ言わなくても常時効きます。ブログのrepoにだけ効かせたい、といった使い方はこれです
3. **全部に常時**: ホストの共通指示に同じ1行を足すと、そのAIの全ての文章仕事に効きます

```
文章・返答のAI特有の言葉遣いはunai skillで直す。
```

1行を書く場所（ホスト別）:

| ホスト | プロジェクトだけ（2） | 全部（3） |
|---|---|---|
| Claude Code | `CLAUDE.md` | `~/.claude/CLAUDE.md` |
| Codex | `AGENTS.md` | `~/.codex/AGENTS.md` |
| Grok Build | `AGENTS.md` | `~/.grok/rules/AGENTS.md` |
| Cursor | `AGENTS.md` または `.cursor/rules/` | `~/.cursor/rules/` の規則ファイル |

置き場はホストの版によって変わることがあります。合わない場合は、そのホストの説明書で「指示ファイル／ルールファイル」の場所を確認してください。

## ライセンス

MIT

開発者向け: [製品と文書の管理](AGENTS.md)、[貢献の仕方](CONTRIBUTING.md)、[公開と復旧](RELEASE.md)。

## サポートとセキュリティ

使い方や不具合は [サポート案内](SUPPORT.md) を確認して [GitHub Issues](https://github.com/kitepon/unai/issues) へ。脆弱性の報告は公開Issueへ書かず、[セキュリティポリシー](SECURITY.md) に従ってください。
