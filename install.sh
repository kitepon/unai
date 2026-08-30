#!/usr/bin/env bash
# unai installer — Claude Code / Codex / Grok / Cursor の部品置き場へ繋ぎ込む。
# 使い方:
#   curl -fsSL https://raw.githubusercontent.com/kitepon/unai/main/install.sh | bash
#   bash install.sh              # clone済みのrepo内から
#   bash install.sh --profile legacy
#   bash install.sh --uninstall  # 繋ぎ込みを外す（実体は残る）
set -euo pipefail

REPO_URL="https://github.com/kitepon/unai.git"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/unai"

PROFILE="official"
UNINSTALL=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    --profile)
      if [ "$#" -lt 2 ]; then
        echo "error: --profile には official または legacy が必要" >&2
        exit 2
      fi
      PROFILE="$2"
      shift 2
      ;;
    *)
      echo "error: 未知の引数: $1" >&2
      exit 2
      ;;
  esac
done

if [ "$PROFILE" != "official" ] && [ "$PROFILE" != "legacy" ]; then
  echo "error: --profile は official または legacy" >&2
  exit 2
fi

# skillの実体の場所を決める。repo内から実行されたらその場を使い、
# パイプ実行なら DATA_DIR へ取得してから続きを行う。
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-/dev/null}")" 2>/dev/null && pwd || true)"

canonical_path() {
  local candidate="$1"
  local candidate_parent
  local candidate_name
  if [ -d "$candidate" ]; then
    (cd "$candidate" 2>/dev/null && pwd -P)
    return
  fi
  candidate_parent="$(dirname "$candidate")"
  candidate_name="$(basename "$candidate")"
  if [ -d "$candidate_parent" ]; then
    printf '%s/%s\n' "$(cd "$candidate_parent" 2>/dev/null && pwd -P)" "$candidate_name"
  else
    printf '%s\n' "$candidate"
  fi
}

owned_symlink() {
  local link_path="$1"
  local expected_target="$2"
  local actual_target
  [ -L "$link_path" ] || return 1
  actual_target="$(readlink "$link_path")"
  case "$actual_target" in
    /*) ;;
    *) actual_target="$(dirname "$link_path")/$actual_target" ;;
  esac
  [ "$(canonical_path "$actual_target")" = "$(canonical_path "$expected_target")" ]
}

# uninstallは取得・更新より先に処理する。リンク先がこのinstallerのcloneと
# 一致する場合だけ外すため、別versionから張り直された現在の配線は残る。
if $UNINSTALL; then
  if [ -n "$SELF_DIR" ] && [ -f "$SELF_DIR/skills/unai/SKILL.md" ]; then
    SRC_DIR="$SELF_DIR"
  else
    SRC_DIR="$DATA_DIR"
  fi
  SKILL_SRC="$SRC_DIR/skills/unai"
  CLI_SRC="$SRC_DIR/bin/unai.mjs"
  CLI_TARGET="$HOME/.local/bin/unai"
  UNINSTALL_TARGETS=(
    "$HOME/.claude/skills/unai"
    "$HOME/.agents/skills/unai"
    "$HOME/.codex/skills/unai"
    "$HOME/.grok/skills/unai"
    "$HOME/.cursor/skills/unai"
  )

  for t in "${UNINSTALL_TARGETS[@]}"; do
    if owned_symlink "$t" "$SKILL_SRC"; then
      rm "$t"
      echo "外した: $t"
    fi
  done
  if owned_symlink "$CLI_TARGET" "$CLI_SRC"; then
    rm "$CLI_TARGET"
    echo "外した: $CLI_TARGET"
  fi
  echo "完了。このinstallerが繋いだ面だけを外した。実体 ($SRC_DIR) は残っている。"
  exit 0
fi

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
COMMON_TARGETS=(
  "$HOME/.claude/skills/unai"
  "$HOME/.grok/skills/unai"
  "$HOME/.cursor/skills/unai"
)

if [ "$PROFILE" = "official" ]; then
  CODEX_TARGET="$HOME/.agents/skills/unai"
  CODEX_OPPOSITE="$HOME/.codex/skills/unai"
else
  CODEX_TARGET="$HOME/.codex/skills/unai"
  CODEX_OPPOSITE="$HOME/.agents/skills/unai"
fi

install_skill_target() {
  local t="$1"
  local parent
  parent="$(dirname "$t")"
  mkdir -p "$parent"
  if [ -e "$t" ] && [ ! -L "$t" ]; then
    echo "skip: $t （実ファイルがあるため上書きしない）"
    return
  fi
  ln -sfn "$SKILL_SRC" "$t"
  echo "繋いだ: $t -> $SKILL_SRC"
}

for t in "${COMMON_TARGETS[@]}"; do
  install_skill_target "$t"
done

# Codexは公式面と旧面を同居させない。同じcloneが作った反対面だけは移行時に外す。
if [ -e "$CODEX_OPPOSITE" ] || [ -L "$CODEX_OPPOSITE" ]; then
  if owned_symlink "$CODEX_OPPOSITE" "$SKILL_SRC"; then
    if [ -e "$CODEX_TARGET" ] && [ ! -L "$CODEX_TARGET" ]; then
      echo "skip: $CODEX_TARGET （実ファイルがあるため反対profileを保持）"
    else
      rm "$CODEX_OPPOSITE"
      echo "外した: $CODEX_OPPOSITE （反対profileの重複）"
      mkdir -p "$(dirname "$CODEX_TARGET")"
      install_skill_target "$CODEX_TARGET"
    fi
  else
    echo "skip: $CODEX_TARGET （反対profileに別のunaiがある: ${CODEX_OPPOSITE}）"
  fi
else
  mkdir -p "$(dirname "$CODEX_TARGET")"
  install_skill_target "$CODEX_TARGET"
fi

mkdir -p "$(dirname "$CLI_TARGET")"
CLI_CONFLICT=false
if [ -e "$CLI_TARGET" ] && [ ! -L "$CLI_TARGET" ]; then
  echo "skip: $CLI_TARGET （実ファイルがあるため上書きしない）"
  CLI_CONFLICT=true
else
  ln -sfn "$CLI_SRC" "$CLI_TARGET"
  echo "繋いだ: $CLI_TARGET -> $CLI_SRC"
fi

DIAGNOSTICS_EXIT=0
if node "$CLI_SRC" factory-diagnostics --json --profile "$PROFILE"; then
  :
else
  DIAGNOSTICS_EXIT=$?
fi
if $CLI_CONFLICT || [ "$DIAGNOSTICS_EXIT" -ne 0 ]; then
  echo "error: unaiのinstall projectionがreadyではない" >&2
  exit 1
fi

echo "完了。4ホストのskill projectionはready。更新はこの1行の再実行でよい。"
