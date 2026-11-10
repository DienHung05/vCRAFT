#!/bin/sh
# Chặn commit do Claude/Anthropic làm tác giả hoặc có dấu ghi công AI (trailer Co-Authored-By, Claude-Session, dòng "Generated with ... Code").
# Chạy trong CI (job quality) vì phiên cloud không chạy git hook cục bộ. Dùng: check-no-ai-attribution.sh <rev-range>, ví dụ origin/develop..HEAD.
# Exit 0 = sạch (range rỗng cũng sạch), 1 = có commit vi phạm, 2 = thiếu tham số.
if [ -z "$1" ]; then
  echo "Usage: $0 <rev-range>   (e.g. origin/develop..HEAD)" >&2
  exit 2
fi

found=0
for sha in $(git rev-list "$1"); do
  short=$(git rev-parse --short "$sha")
  subject=$(git show -s --format=%s "$sha")
  reasons=""

  # Identity: email noreply@anthropic.com, hoặc tên bắt đầu bằng "Claude".
  for field in an ae cn ce; do
    value=$(git show -s --format="%$field" "$sha")
    case "$field" in
      ae | ce) printf '%s\n' "$value" | grep -Eiq '^noreply@anthropic\.com$' && reasons="$reasons; $field=$value" ;;
      *) printf '%s\n' "$value" | grep -Eiq '^Claude( |$)' && reasons="$reasons; $field=$value" ;;
    esac
  done

  # Message: trailer/footer ghi công AI.
  body=$(git show -s --format=%B "$sha")
  printf '%s\n' "$body" | grep -Eiq '^Co-Authored-By:.*(claude|anthropic)' && reasons="$reasons; Co-Authored-By trailer"
  printf '%s\n' "$body" | grep -Eiq '^Claude-Session:' && reasons="$reasons; Claude-Session trailer"
  printf '%s\n' "$body" | grep -Eiq 'Generated with \[?Claude Code' && reasons="$reasons; Generated-with footer"

  if [ -n "$reasons" ]; then
    echo "$short $subject: ${reasons#; }"
    found=1
  fi
done

if [ "$found" -ne 0 ]; then
  echo "The commits above are authored by or attributed to Claude/Anthropic. Fix: set your own identity (git commit --amend --reset-author), or rewrite the commits (git rebase) to drop the Co-Authored-By / Claude-Session / 'Generated with' lines, then force-push the branch." >&2
  exit 1
fi
exit 0
