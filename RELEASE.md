# unai release / rollback 契約

unai自身が版数、配布物、installer、tag、release履歴を所有する。外部の工場管理repoは任意の統合先であり、この契約の正本ではない。

## 配布経路

- GitHubの`kitepon/unai`にある`main`は最新追従の配布経路である。READMEの1行installerは、この`main`を取得またはfast-forward更新する。
- `vX.Y.Z` tagは、その版を固定する不変の復旧点である。公開後のtagを別commitへ動かしたり、同じ版数を作り直したりしない。
- `main`向けinstaller自体は版を固定しない。tag付きURLからinstallerだけを取得しても、そのinstallerは既定では`main`をcloneするため、rollbackにはならない。

## release手順

1. `.claude-plugin/plugin.json`と`.claude-plugin/marketplace.json`の版数を一致させ、版数を検証するtestも同じ値へ更新する。
2. 変更に対応するfocused testを先に通し、最後に`node --test tests/unai.test.mjs tests/ci-contract.test.mjs`を一度通す。`install.sh`は`bash -n install.sh`、`install.ps1`はPowerShell parserでも確認する。
3. GitHub ActionsのmacOS・Linux・Windows結果がすべて成功した`main`だけを公開対象にする。
4. version releaseでは、その`main`上のcommitへ注釈付き`vX.Y.Z` tagを作り、tagとGitHub Releaseを公開する。tag対象が公開`main`の祖先であることを実測してから行う。
5. 公開後に、最新追従installerによる新規導入または更新、`unai --version`、`unai factory-diagnostics --json`を実行し、Claude Code・Codex・Grok・Cursorの4面がすべて`ready`であることを確認する。

通常の修正は`main`で前進修正する。公開済みの履歴を書き換えず、壊れたversion releaseは修正版の新しい版数とtagで置き換える。

## 利用環境を既知の版へ戻す

rollbackは、選んだtagを版別の永続ディレクトリへcloneし、そのclone内のinstallerを実行する。作業用一時ディレクトリは、skillとCLIの参照先になるため使わない。

macOS / Linux（`v0.2.1`へ戻す例）:

```bash
unai_tag="v0.2.1"
unai_pinned_dir="$HOME/.local/share/unai-releases/$unai_tag"
git clone --depth 1 --branch "$unai_tag" https://github.com/kitepon/unai.git "$unai_pinned_dir"
bash "$unai_pinned_dir/install.sh"
unai --version
unai factory-diagnostics --json
```

Windows PowerShell 7（`v0.2.1`へ戻す例）:

```powershell
$unaiTag = 'v0.2.1'
$unaiPinnedDir = Join-Path $env:LOCALAPPDATA "unai-releases\$unaiTag"
git clone --depth 1 --branch $unaiTag https://github.com/kitepon/unai.git $unaiPinnedDir
& (Join-Path $unaiPinnedDir 'install.ps1')
unai --version
unai factory-diagnostics --json
```

対象ディレクトリが既にある場合は再cloneで上書きせず、そのcloneのtagと差分を確認する。最新版へ戻すときはREADMEの`main`向け1行installerを再実行する。固定版を外す場合は、その固定clone内のinstallerへ`--uninstall`または`-Uninstall`を渡して繋ぎ込みを外してから、残ったcloneを必要に応じて削除する。

現在のinstallerはskillとCLIの参照先が自分のcloneと一致する場合だけ外す。この所有権判定を備えた固定版から最新版へ張り直した後に固定版のuninstallを実行しても、最新版の配線は残る。判定導入前のtagに含まれるinstallerはこの保証の対象外なので、リンク先が別cloneなら過去installerを実行せず、過去cloneだけを削除する。Codexは公式面`~/.agents/skills/unai`を既定とし、旧面`~/.codex/skills/unai`は明示したlegacy profileだけに使い、両面を同居させない。
