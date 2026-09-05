# unai 製品正典

このリポジトリは、日本語のAI特有の不自然な言葉遣いを指摘し、該当箇所だけを修正するagent skill「unai」の正規repoである。

## 所有境界

- unaiは単独で導入・利用・診断・releaseできる製品であり、仕様、実装、版数、installer、文書、release履歴をこのrepoが所有する。
- dotagentsは工場への任意の統合先であり、unaiの仕様、状態、版数、releaseを制御しない。dotagentsがなくてもunaiの機能と運用は失われない。
- unai固有の契約はこのrepoへ置く。統合側には接続に必要な参照だけを置き、製品正典を複製しない。

## 正本と文書寿命

- 利用者向けの現行説明は`README.md`が正本で、`README.en.md`は同じ事実を英語で保つ。
- agentの動作契約は`skills/unai/SKILL.md`、開発時の所有・文書規律は本書、release手順は`RELEASE.md`が正本である。
- 現行文書は読み手が最初に辿れる場所だけに置く。同じ目的の文書が増えた場合は正本へmergeし、並立させない。
- 完了済みの計画、廃止済みの仕様、過去の調査を残す必要がある場合だけ`docs/archive/`へ移す。archiveは通常の読書順と現行正典の参照先にしない。

## 変更と検証

- 文章への指示は、AI特有の不自然な言葉遣いとその修正例だけを`skills/unai/SKILL.md`に置く。
- installerは利用者の通常ファイル／ディレクトリを上書きしない。配置先が競合した場合は資産を保持し、型付き診断を出して非0終了する。利用者が退避して再実行できる状態を保つ。
- Claude Code、Codex、Grok、Cursorのskill projectionはunaiが公開診断を所有する。正しいリンクまたは配布bundleと完全一致するcopyだけを`ready`とする。
- Codex skillの既定配布面は`~/.agents/skills/unai`だけとし、`~/.codex/skills/unai`は明示したlegacy profileだけに置く。両面を同居させない。
- uninstallは取得・更新を行わず、そのinstallerのcloneを指すskillとCLIだけを外す。別versionが張り直した配線は変更しない。
- 挙動、installer、manifest、CIを変えた場合は対応するfocused testを追加し、`node --test tests/unai.test.mjs tests/ci-contract.test.mjs`を通す。
- releaseとrollbackは`RELEASE.md`に従う。公開前にmanifestの版数一致とmacOS・Linux・WindowsのCIを確認する。
