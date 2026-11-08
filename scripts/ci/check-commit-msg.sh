#!/bin/sh
# Hook commit-msg (lefthook): kiểm Conventional Commits. Đặt trong file riêng vì lefthook trên Windows
# làm hỏng dấu nháy của script nhiều dòng viết thẳng trong lefthook.yml.
grep -Eq '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?!?: .+' "$1" || {
  echo "Commit message phải theo Conventional Commits, ví dụ: feat(rfq): accept bid with pessimistic lock"
  exit 1
}
