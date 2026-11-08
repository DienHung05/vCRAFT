<div align="center">

# vCraft

**Tinh hoa làng nghề, muôn phương lan tỏa**

Triển lãm số · Truy xuất nguồn gốc bằng QR · Báo giá & điều phối đơn sỉ · Bản đồ làng nghề

_Bài tập lớn INT3306 — Phát triển ứng dụng web · Fall 2026_

</div>

---

## Tài liệu

| Tài liệu                                                     | Nội dung                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| [docs/requirements/SRS.md](docs/requirements/SRS.md)                                   | Đặc tả yêu cầu: chức năng theo vai trò, máy trạng thái báo giá, quy tắc khóa, phi chức năng, truy vết tiêu chí chấm  |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                 | Kiến trúc C4, monorepo & luật ranh giới, backend, design patterns, mô hình dữ liệu, bảo mật, frontend, hoạt ảnh, ADR |
| [docs/PLAN.md](docs/PLAN.md)                                 | Tech stack, phân vai, lộ trình sprint, backlog, kịch bản demo, chuẩn bị vấn đáp, rủi ro                              |
| [docs/design/BRAND.md](docs/design/BRAND.md)                               | Nhận diện thương hiệu: ấn triện, màu, chữ, hoa văn, ngôn ngữ chuyển động, giọng văn                                  |
| [docs/requirements/vCraft.pdf](docs/requirements/vCraft.pdf) | Đề bài gốc                                                                                                           |

## Cấu trúc monorepo

```
apps/
  web/        Next.js 16 — trang công khai, Studio nghệ nhân, Admin
  api/        NestJS 12 — REST JSON API /api/v1 + SSE
  worker/     BullMQ — tối ưu ảnh, QR/PDF, mail, outbox, job hẹn giờ
packages/
  domain/     Lõi nghiệp vụ thuần (state machine, chia đơn, chuỗi băm)
  contracts/  Zod schemas dùng chung FE/BE
  database/   MikroORM entities, repositories, migrations (PostgreSQL | MySQL)
  api-client/ fetch có kiểu + TanStack Query hooks + SSE
  ui/         Design system & motion primitives
  i18n/       vi / en
  utils/      Tiện ích tiếng Việt (slug, đọc số, SĐT, địa giới)
tooling/      tsconfig dùng chung
tests/        e2e (Playwright), load (k6)
infra/        compose, docker, caddy
docs/         SRS, kiến trúc, kế hoạch, thương hiệu
```

Luật phụ thuộc giữa các gói được kiểm tự động (`pnpm deps:check`) — xem [ARCHITECTURE §3.2](docs/ARCHITECTURE.md#32-đồ-thị-phụ-thuộc--luật-ranh-giới).

## Trạng thái hiện tại

Repo đang ở giai đoạn đầu. Bảng dưới tách **những gì đã chạy được** khỏi **kiến trúc dự định** trong [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); các mục chưa tick trong [docs/PLAN.md §5](docs/PLAN.md#5-backlog-chi-tiết-theo-epic) là chưa có.

| Phần                                        | Đã có                                                                                       | Chưa có (mới chỉ là thiết kế)                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/domain`                           | Máy trạng thái RFQ/Bid/Allocation, kiểm tra chia đơn, ghép hộ, chuỗi băm; có unit test      | Chưa backend nào gọi, nên chưa có gì ép buộc các quy tắc này trên dữ liệu thật      |
| `apps/web`                                  | Giao diện demo dùng **dữ liệu giả** trong `src/lib/demo`; thao tác trên màn hình chỉ là mô phỏng cục bộ | Gọi API thật, đăng nhập, lưu dữ liệu; một số route điều hướng và `/q/<mã>` chưa có |
| `apps/api`                                  | Chỉ có `GET /health` (chưa kiểm tra DB/Redis/storage)                                       | Xác thực, phân quyền, module RFQ/sản phẩm, SSE, idempotency, khóa giao dịch         |
| `apps/worker`                               | Khung tiến trình                                                                            | Mọi job (outbox, ảnh, QR/PDF, mail, hẹn giờ)                                        |
| `packages/database`                         | Entity `OutboxEvent`, migration cho PostgreSQL và MySQL, integration test trên cả hai CSDL  | Các entity nghiệp vụ (RFQ, bid, sản phẩm…), repository, seeder dữ liệu mẫu          |
| `packages/contracts`, `packages/api-client` | Schema dùng chung ở mức khung (lỗi, phân trang, kiểu cơ bản)                                | Schema và hook cho từng nghiệp vụ                                                   |

## Bắt đầu

```bash
# Yêu cầu: Node ≥ 24, Docker. pnpm được ghim trong package.json (field packageManager).
# Node ≥ 25 không còn kèm corepack: chạy `npm i -g corepack` trước.
corepack enable pnpm
pnpm install
cp .env.example .env
pnpm infra:up          # redis, mailpit, caddy (cổng chỉ mở ở 127.0.0.1)
```

Sau đó chuẩn bị CSDL (mục dưới) rồi chạy `pnpm dev` (web :3000 · api :4000 · truy cập qua Caddy http://localhost:8080).

### CSDL: hai hệ migration, chạy theo thứ tự

CSDL nghiệp vụ là Postgres của Supabase (ADR-15). Có **hai** hệ migration độc lập, và `pnpm db:migrate` **chỉ chạy hệ thứ hai**:

| Thứ tự | Hệ migration                       | Nội dung                                                                                                                                                                                                    | Cách chạy                                                         |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1      | `supabase/migrations/*.sql`        | `business_db_guard`: thu quyền mặc định của `anon`/`authenticated`, tạo event trigger `ensure_rls` tự bật RLS cho **bảng tạo sau đó** trong `public`. `storage_buckets`: hai bucket `vcraft-media`, `vcraft-private` | Supabase CLI (`supabase db push`, hoặc `supabase db reset` cục bộ) |
| 2      | `packages/database/src/migrations` | Bảng nghiệp vụ do MikroORM quản lý (hiện có `outbox_event`)                                                                                                                                                 | `pnpm db:migrate`                                                 |

Event trigger và quyền mặc định chỉ tác động lên đối tượng tạo **sau** khi chúng tồn tại, nên phải chạy hệ 1 **trước** hệ 2. Chạy ngược thứ tự thì bảng đã tạo giữ nguyên quyền mặc định của Supabase cho `anon`/`authenticated` (migration RLS của MikroORM chỉ bật RLS, không thu quyền) và phải sửa tay.

**Quyền cần có.** Cả hai hệ chạy bằng vai trò `postgres` của project (chủ bảng, đúng vai trò backend dùng, bỏ qua RLS). Hệ 1 còn cần quyền tạo event trigger và schema `private`, nên không chạy được bằng `anon`, `authenticated` hay `service_role`. Mật khẩu database lấy ở Dashboard → Connect; không commit.

**Kiểm tra sau khi chạy.** Trong SQL Editor (hoặc `psql`) với vai trò `postgres`:

```sql
-- hệ 1: event trigger có mặt và đang bật
select evtname, evtenabled from pg_event_trigger where evtname = 'ensure_rls';
-- hệ 1: hai bucket tồn tại, vcraft-private không public
select id, public from storage.buckets where id in ('vcraft-media', 'vcraft-private');
-- hệ 2: mọi bảng nghiệp vụ đã bật RLS (relrowsecurity = true)
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p');
-- hệ 2: anon/authenticated không đọc được bảng nghiệp vụ (kỳ vọng: false, false)
select has_table_privilege('anon', 'public.outbox_event', 'select'),
       has_table_privilege('authenticated', 'public.outbox_event', 'select');
```

**TLS.** `DB_SSL=true` luôn xác thực chứng chỉ máy chủ. Pooler của Supabase dùng CA riêng: tải CA ở Dashboard → Database → Settings → SSL Configuration → Download certificate, lưu thành file (ví dụ `certs/supabase-ca.crt`) và đặt `DB_SSL_CA_FILE` trỏ tới nó (hoặc `DB_SSL_CA` là nội dung PEM). Lỗi kiểu `self-signed certificate in certificate chain` nghĩa là còn thiếu CA; không có cách tắt xác thực.

**Dùng chung hay cô lập.**

- Project Supabase dùng chung của nhóm **chỉ** nhận migration đã review và đã merge vào `develop`, do người giữ project áp. **Không** chạy thử migration, `pnpm db:seed` hay script thử nghiệm lên project này khi làm quen repo: seed có thể ghi đè dữ liệu người khác đang dùng.
- Để thử nghiệm, dùng môi trường riêng: project Supabase cá nhân (gói Free), hoặc Supabase CLI chạy cục bộ (`supabase init` nếu chưa có `supabase/config.toml`, rồi `supabase start`; `supabase db reset` áp `supabase/migrations`, sau đó `pnpm db:migrate` với `.env` trỏ về CSDL cục bộ, cổng mặc định 54322, `DB_SSL=false`). Repo chưa có `config.toml` và quy trình cục bộ này chưa được kiểm chứng.
- Cách nhanh nhất để kiểm chứng cả hai hệ migration trên CSDL dùng một lần: `pnpm --filter @vcraft/api test:integration`. Testcontainers dựng Postgres/MySQL tạm, áp `business_db_guard` rồi migration MikroORM đúng thứ tự trên (cần Docker). Bộ test này không bao giờ trỏ vào Supabase.

### Kiểm chứng độc lập CSDL (MySQL)

```bash
docker compose -f infra/compose/compose.dev.yml --profile mysql up -d mysql
# .env: DB_DRIVER=mysql, DB_HOST=localhost, DB_PORT=3306, DB_NAME/DB_USER/DB_PASSWORD=vcraft, DB_SSL=false
pnpm db:migrate
```

MySQL chỉ có hệ migration của MikroORM (không có `supabase/migrations`). Trong CI, cùng bộ integration test chạy trên cả PostgreSQL và MySQL (`DB_DRIVER=postgresql|mysql`).

### Reverse proxy

- Dev: `infra/caddy/Caddyfile.dev` (HTTP `:8080`, `auto_https off`), `pnpm infra:up` nạp sẵn.
- Production chính thức: web trên Vercel, API + worker trên Render, không dùng Caddy ([ADR-16](docs/adr/0016-deploy-vercel-render.md), [docs/operations/deploy.md](docs/operations/deploy.md), `render.yaml`). `Caddyfile.prod` dưới đây chỉ còn cho phương án tự host/dự phòng.
- Tự host: `infra/caddy/Caddyfile.prod` dùng `{$DOMAIN}`, bật auto HTTPS, chuyển hướng HTTP sang HTTPS, kèm HSTS. Đặt `DOMAIN`, `API_UPSTREAM`, `WEB_UPSTREAM` rồi chạy `caddy run --config Caddyfile.prod --adapter caddyfile`. Cú pháp đã qua `caddy validate`; việc cấp chứng chỉ thật chưa thử, cần kiểm tra trên máy có tên miền trước khi ra mắt.

## Quy ước

- `main` chỉ để deploy; `develop` là nhánh tích hợp.
- Feature: nhánh `feat/<epic>-<mô-tả>` tách từ `develop` → PR vào `develop` (1 review + CI xanh) → merge xong xóa nhánh.
- Conventional Commits · Definition of Done ở [PLAN §8](docs/PLAN.md#8-definition-of-done--quy-trình-làm-việc) · quy tắc cho AI agent ở [AGENTS.md](AGENTS.md).
