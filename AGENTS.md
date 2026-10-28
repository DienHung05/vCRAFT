# AGENTS.md

Hướng dẫn cho mọi AI agent (Claude Code, Codex, Copilot, Cursor…) làm việc trong repo **vCraft**.

## 1. Đọc gì trước

Đọc theo thứ tự này trước khi sửa code:

1. [docs/SRS.md](docs/SRS.md): yêu cầu (mã `FR-*`, `NFR-*`, `BR-*`), máy trạng thái báo giá (§4), quy tắc khóa bản ghi (§4.4).
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): cấu trúc monorepo (§3), luật phụ thuộc (§3.2), cách tổ chức module backend (§4.1), design patterns (§5), mô hình dữ liệu (§6).
3. [docs/PLAN.md](docs/PLAN.md): tech stack, sprint hiện tại, backlog, Definition of Done (§8).
4. [docs/BRAND.md](docs/BRAND.md): màu, chữ, token chuyển động. Đọc khi làm giao diện.

Đề bài gốc: [docs/requirements/vCraft.pdf](docs/requirements/vCraft.pdf).

**Chia việc cho subagent:** trước khi giao task, đọc các định nghĩa agent trong [.claude/agents/](.claude/agents/) (tên, mô tả, model, effort, quy trình) để chọn đúng agent. Phiên chính (Opus) đọc tài liệu, lập kế hoạch, viết brief có phạm vi rõ và rà lại kết quả. Phần cài đặt code giao cho agent `coder` (Sonnet, effort high), không tự viết ở phiên chính, trừ sửa nhỏ một vài dòng hoặc sửa câu chữ trong tài liệu.

## 2. Bản đồ thư mục

| Thư mục | Chứa gì | Đặt code mới ở đây khi… |
|---|---|---|
| `apps/web` | Next.js: trang công khai, Studio, Admin | Làm route, trang, component riêng một nghiệp vụ (`src/features/<nghiệp-vụ>`), hiệu ứng thương hiệu (`src/experience`) |
| `apps/api` | NestJS REST JSON API `/api/v1` + SSE | Làm endpoint, use case (`src/modules/<module>/application`), guard/pipe/filter (`src/common`), adapter hạ tầng (`src/infrastructure`) |
| `apps/worker` | Tiến trình nền BullMQ | Làm job: xử lý ảnh, QR/PDF, mail, outbox, hẹn giờ |
| `packages/domain` | Lõi nghiệp vụ thuần TypeScript | Làm quy tắc nghiệp vụ: state machine, chia đơn, ghép hộ, chuỗi băm, value objects |
| `packages/contracts` | Zod schemas + DTO dùng chung FE/BE | Thêm/sửa dữ liệu vào ra của API |
| `packages/database` | MikroORM entities, repositories, migrations, seeders | Thêm bảng/cột, truy vấn phức tạp, dữ liệu mẫu |
| `packages/api-client` | fetch có kiểu, query hooks, SSE client | Frontend cần gọi API mới |
| `packages/ui` | Design system: token, component, motion | Component dùng lại, không mang nghiệp vụ |
| `packages/i18n` | Từ điển vi/en | Mọi chuỗi hiển thị cho người dùng |
| `packages/utils` | Tiện ích tiếng Việt, định dạng | Hàm thuần không nghiệp vụ |
| `tooling/typescript` | tsconfig dùng chung | — |
| `tests/e2e`, `tests/load` | Playwright, k6 | Test hành trình người dùng, test tranh chấp |
| `infra/` | compose, docker, caddy, scripts | Hạ tầng, reverse proxy, triển khai |
| `supabase/` | Migration SQL cho vector store của trợ lý Cáo (pgvector) | Đổi bảng/index/RPC/RLS của chỉ mục tri thức (ADR-13) |
| `docs/` | SRS, kiến trúc, kế hoạch, thương hiệu, ADR | Quyết định kiến trúc mới: `docs/adr/NNNN-*.md` |

## 3. Luật bắt buộc khi viết code

- **Ranh giới gói** (kiểm bằng `pnpm deps:check`):
  - `packages/domain` không import framework, ORM hay workspace khác.
  - `apps/web` không import `packages/database` hay `apps/*`.
  - `packages/ui` không import `domain`, `contracts`, `api-client`.
  - `packages/*` không import `apps/*`.
- Frontend chỉ lấy dữ liệu qua `@vcraft/api-client` (fetch → REST JSON). Không dùng Server Actions cho nghiệp vụ.
- Mọi kiểm tra dữ liệu dùng schema Zod trong `packages/contracts`, áp dụng cả FE lẫn BE.
- Ưu tiên API của MikroORM (entity, QueryBuilder). **Được phép viết SQL tay** khi ORM không diễn đạt được hoặc quá chậm (báo cáo, thống kê, truy vấn tối ưu), với điều kiện:
  - Chỉ đặt trong repository của `packages/database` hoặc trong migration; không viết SQL ở controller, service hay domain.
  - Luôn truyền tham số qua binding (`em.execute(sql, params)` / Knex), tuyệt đối không nối chuỗi từ input.
  - CSDL nghiệp vụ vẫn phải chạy được trên cả PostgreSQL và MySQL: dùng SQL chuẩn chạy được cả hai, hoặc viết riêng cho từng driver phía sau cùng một interface repository. Có integration test trên cả 2 CSDL.
  - Vector store của trợ lý Cáo trên Supabase (pgvector, ADR-13) được dùng tính năng riêng của PostgreSQL (bảng, index HNSW, hàm RPC, RLS trong `supabase/migrations`). Backend chỉ truy cập qua port `VectorStore`.
- Chuyển trạng thái RFQ/Bid/Allocation chỉ đi qua `packages/domain`, không tự sửa cột `status`.
- Controller chỉ làm việc của HTTP; logic nằm ở application service và domain.
- Giao diện dùng token trong `packages/ui`, không hard-code màu. Chuỗi hiển thị đi qua `packages/i18n`. Hiệu ứng phải tôn trọng `prefers-reduced-motion`.
- Comment/JSDoc ghi mã yêu cầu liên quan (vd. `// BR-L2`) khi cài một quy tắc nghiệp vụ.
- Lệnh kiểm tra trước khi báo xong: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm deps:check`.

## 4. Quy tắc Git

- **Không tự ý `git commit` hoặc `git push`** (kể cả amend, rebase, force push, tạo tag, tạo PR) **trừ khi user cho phép rõ ràng trong lần yêu cầu đó.** Được phép một lần không có nghĩa là được phép cho các lần sau.
- Khi được phép commit: theo Conventional Commits (`feat(rfq): ...`), **không thêm dòng `Co-Authored-By`** hay bất kỳ dòng ghi công AI nào. Commit chỉ đứng tên user.
- **Luồng nhánh:**
  - `main` chỉ dùng để deploy. Chỉ merge `develop` vào `main` khi phát hành, không commit hay mở PR feature thẳng vào `main`.
  - `develop` là nhánh tích hợp. Mọi feature đều merge vào đây qua PR.
  - Làm feature: tạo nhánh từ `develop` mới nhất, đặt tên `feat/<epic>-<mô-tả-ngắn>` (sửa lỗi: `fix/...`, tài liệu: `docs/...`, hạ tầng: `chore/...`). Mở PR **vào `develop`**.
  - Sau khi PR merge: **xóa nhánh feature** cả trên remote (`git push origin --delete <nhánh>` hoặc bật auto-delete trên GitHub) lẫn ở local (`git branch -d <nhánh>`), rồi `git fetch --prune` để repo không bị loãng nhánh.
- **Nhắc commit:** làm xong một feature, một task trong backlog hoặc một phần việc trọn vẹn tương đương (kiểm tra đã xanh), agent phải nhắc user commit để tiến độ trên git luôn khớp thực tế. Chỉ nhắc, không tự commit; vẫn áp dụng quy tắc xin phép ở trên.
- **Tick backlog:** làm xong mục nào trong backlog [docs/PLAN.md §5](docs/PLAN.md#5-backlog-chi-tiết-theo-epic) thì đổi `- [ ]` thành `- [x]` ngay ở mục đó, và đưa vào cùng commit với phần code. Chỉ tick khi mục đã xong trọn vẹn và kiểm tra đã xanh. Xong một phần thì để nguyên ô trống, ghi phần còn lại vào cuối dòng (vd. `— còn: Figma`).
- Không commit `.env`, bí mật, dữ liệu trong `infra/compose/.data/`.
- Repo git là chính thư mục này (`vCRAFT/`), không phải thư mục cha.

## 5. Về file này

Không tự ý thêm, sửa hay xóa nội dung trong `AGENTS.md` trừ khi user yêu cầu.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
