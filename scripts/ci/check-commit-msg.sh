#!/bin/sh
# Hook commit-msg (lefthook): kiểm Conventional Commits. Đặt trong file riêng vì lefthook trên Windows
# làm hỏng dấu nháy của script nhiều dòng viết thẳng trong lefthook.yml.
grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .+' "$1" || {
  echo "Commit message phải theo Conventional Commits, ví dụ: feat(rfq): accept bid with pessimistic lock"
  exit 1
}
# Không cho phép dấu ghi công AI trong message (trailer Co-Authored-By Claude/Anthropic, Claude-Session:, dòng "Generated with ... Code").
if grep -Eiq '^Co-Authored-By:.*(claude|anthropic)|^Claude-Session:|Generated with \[?Claude Code' "$1"; then
  echo "Commit message không được chứa dấu ghi công AI (Co-Authored-By Claude/Anthropic, Claude-Session:, Generated with ... Code). Hãy xoá các dòng đó."
  exit 1
fi
