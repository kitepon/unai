#!/usr/bin/env bash
# unai installer — Claude Code / Codex / Grok / Cursor の部品置き場へ繋ぎ込む。
# 使い方:
#   curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
#   bash install.sh              # clone済みのrepo内から
#   bash install.sh --uninstall  # 繋ぎ込みを外す（実体は残る）
set -euo pipefail

REPO_URL="https://github.com/kitepon/unai.git"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/unai"

# skillの実体の場所を決める。repo内から実行されたらその場を使い、
# パイプ実行なら DATA_DIR へ取得してから続きを行う。
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-/dev/null}")" 2>/dev/null && pwd || true)"
if [ -n "$SELF_DIR" ] && [ "$SELF_DIR" = "$DATA_DIR" ]; then
  # 利用者用の複製の中から再実行された場合も、公開版から最新を取り直す
  git -C "$DATA_DIR" pull --ff-only
  SRC_DIR="$DATA_DIR"
elif [ -n "$SELF_DIR" ] && [ -f "$SELF_DIR/skills/unai/SKILL.md" ]; then
  SRC_DIR="$SELF_DIR"
else
  if [ -d "$DATA_DIR/.git" ]; then
    git -C "$DATA_DIR" pull --ff-only
  else
    git clone --depth 1 "$REPO_URL" "$DATA_DIR"
  fi
  SRC_DIR="$DATA_DIR"
fi

SKILL_SRC="$SRC_DIR/skills/unai"
CLI_SRC="$SRC_DIR/bin/unai.mjs"
CLI_TARGET="$HOME/.local/bin/unai"
TARGETS=(
  "$HOME/.claude/skills/unai"
  "$HOME/.codex/skills/unai"
  "$HOME/.agents/skills/unai"
  "$HOME/.grok/skills/unai"
  "$HOME/.cursor/skills/unai"
)

if [ "${1:-}" = "--uninstall" ]; then
  for t in "${TARGETS[@]}"; do
    if [ -L "$t" ]; then
      rm "$t"
      echo "外した: $t"
    fi
  done
  if [ -L "$CLI_TARGET" ]; then
    rm "$CLI_TARGET"
    echo "外した: $CLI_TARGET"
  fi
  echo "完了。実体 ($SRC_DIR) は残っている。不要なら削除してよい。"
  exit 0
fi

for t in "${TARGETS[@]}"; do
  parent="$(dirname "$t")"
  # そのホストを使っていない環境（親の親が無い）には作らない
  if [ ! -d "$(dirname "$parent")" ]; then
    echo "skip: $t （ホスト未導入）"
    continue
  fi
  mkdir -p "$parent"
  if [ -e "$t" ] && [ ! -L "$t" ]; then
    echo "skip: $t （実ファイルがあるため上書きしない）"
    continue
  fi
  ln -sfn "$SKILL_SRC" "$t"
  echo "繋いだ: $t -> $SKILL_SRC"
done

mkdir -p "$(dirname "$CLI_TARGET")"
if [ -e "$CLI_TARGET" ] && [ ! -L "$CLI_TARGET" ]; then
  echo "skip: $CLI_TARGET （実ファイルがあるため上書きしない）"
else
  ln -sfn "$CLI_SRC" "$CLI_TARGET"
  echo "繋いだ: $CLI_TARGET -> $CLI_SRC"
fi

echo "完了。更新はこの1行の再実行でよい。"
