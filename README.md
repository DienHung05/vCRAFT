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

Hệ thống chạy đầy đủ từ đầu đến cuối: web trên Vercel, API và worker trên Render, CSDL/Auth/Storage ở Supabase ([ADR-16](docs/adr/0016-deploy-vercel-render.md), [docs/operations/deploy.md](docs/operations/deploy.md)). Mọi màn hình dưới đây đọc và ghi qua API thật; dữ liệu mẫu (làng gốm Bát Tràng, hộ và người hư cấu) nạp bằng seeder, xem [docs/demo/README.md](docs/demo/README.md). Chi tiết yêu cầu nằm ở [SRS](docs/requirements/SRS.md), quyết định kiến trúc ở [docs/adr](docs/adr/README.md).

### Đã chạy được

| Mảng                      | Nội dung                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Triển lãm số              | Trang chủ, danh mục sản phẩm có lọc và tìm kiếm, trang sản phẩm, nghệ nhân, hộ sản xuất; yêu thích sản phẩm; tiếng Việt và tiếng Anh. Ảnh có ghi công ở `/ghi-nhan-anh`                                                                                          |
| Hồ sơ hộ và Studio        | Đăng ký hộ nhiều bước (wizard), Ban quản lý duyệt, từ chối hoặc yêu cầu bổ sung; trong Studio hộ sửa hồ sơ, xưởng (giờ mở cửa, đón khách), nghệ nhân, sản phẩm và xuất bản                                                                                      |
| Bản đồ làng nghề          | Bản đồ xưởng trong ranh giới xã Bát Tràng, trạng thái mở cửa, phương án ngoại tuyến khi tải bản đồ lỗi                                                                                                                                                        |
| Truy xuất nguồn gốc       | Mã QR ổn định `/q/<mã>` → trang truy xuất; nhật ký sản xuất là chuỗi mốc có ảnh, niêm phong bằng chuỗi băm SHA-256 và kiểm lại được trên trang ("Nhật ký toàn vẹn"); in tem QR (PDF) qua worker                                                                |
| Yêu cầu báo giá           | Khách sỉ tạo yêu cầu; hộ được mời (Khách chọn, hệ thống ghép hoặc Ban quản lý mời) **chào giá trực tiếp**, hoặc gửi đề xuất để Ban quản lý lập **chào giá liên kết** chia nhiều hộ; yêu cầu điều phối mở cho hộ đủ điều kiện ([ADR-0026](docs/adr/0026-open-coordinated-requests.md)); Khách so sánh và chốt, hộ thua nhận thông báo |
| Đơn hàng và phân bổ       | Chốt chào giá thành đơn, chia phân bổ cho từng hộ, hộ xác nhận, Ban quản lý bắt đầu sản xuất, hộ báo tiến độ, Khách xác nhận nhận hàng và đánh giá hộ; các job hẹn giờ xử lý hết hạn chào giá và kiểm tra điều phối                                                           |
| Thanh toán trực tuyến     | Đặt cọc và thanh toán đơn bằng chuyển khoản/VietQR (SePay), VNPay, MoMo; trên site đang chạy là **chế độ demo** ("Thanh toán thử — không trừ tiền thật", QR dẫn về trang xác nhận của chính vCraft) ([ADR-0021](docs/adr/0021-online-payment-for-orders.md), [ADR-0024](docs/adr/0024-payment-gateways-in-production.md), [ADR-0025](docs/adr/0025-demo-payment-mode.md)) |
| Tin tức                   | Ban quản lý viết tin làng và tin theo hộ; thông báo cắt điện theo khu vực, hiện cảnh báo trong Studio cho hộ thuộc khu vực đó ([ADR-0023](docs/adr/0023-outage-notice-areas-and-timing.md)); nhập tin từ RSS bằng worker khi được cấu hình                      |
| Quản trị                  | Duyệt hộ, điều phối yêu cầu, quản lý người dùng (khóa/mở), theo dõi tiến độ, thanh toán, nhật ký thao tác; Admin bắt buộc MFA TOTP (`aal2`)                                                                                                                       |
| Trợ lý Cáo                | Chatbot tra cứu tri thức (RAG) với trích dẫn và rào chắn chống injection, chạy trên OpenAI, chỉ mục vector trong Supabase ([ADR-0019](docs/adr/0019-assistant-on-openai.md))                                                                                     |
| Xử lý ảnh                 | Tải ảnh lên bucket riêng, worker xóa metadata và sinh biến thể AVIF/WebP 320/640/960/1280 sang bucket công khai                                                                                                                                                     |
| Thông báo                 | Thông báo trong ứng dụng (cập nhật trực tiếp qua SSE), thư điện tử qua hàng đợi, tùy chọn nhận thư theo người dùng                                                                                                                                              |
| Tài khoản và riêng tư     | Đăng ký/đăng nhập bằng email hoặc tên đăng nhập (và Google), Cloudflare Turnstile, quên mật khẩu, mời hộ qua email, đồng ý xử lý dữ liệu, xuất và xóa dữ liệu cá nhân ([ADR-0017](docs/adr/0017-personal-data-export-and-deletion.md)), mã hóa trường nhạy cảm ([ADR-0018](docs/adr/0018-field-level-encryption.md)) |

Theo từng gói:

| Phần                                        | Hiện có                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain`                           | Máy trạng thái RFQ/Bid/Allocation, chia đơn và ghép hộ, chuỗi băm nhật ký, ranh giới làng, khu vực; có unit test, được API và worker gọi thật                              |
| `apps/web`                                  | Trang công khai, Studio hộ, Buyer, Admin, thanh toán; gọi API thật qua `@vcraft/api-client`, đăng nhập Supabase Auth                                                      |
| `apps/api`                                  | REST `/api/v1` theo module (catalog, hộ, sản phẩm, nhật ký, truy xuất, RFQ, đơn, thanh toán, tin, media, thông báo, trợ lý, quyền riêng tư, admin), SSE, idempotency, khóa lạc quan `If-Match` |
| `apps/worker`                               | Hàng đợi BullMQ: outbox, ảnh, QR/PDF, thư, thông báo, job hẹn giờ RFQ, nhập tin, lập chỉ mục trợ lý                                                                       |
| `packages/database`                         | Entity và migration cho PostgreSQL và MySQL, RLS bật mặc định cho Supabase, seeder dữ liệu mẫu và công cụ `demo:*`, integration test trên cả hai CSDL |
| `packages/contracts`, `packages/api-client` | Schema Zod dùng chung và hook TanStack Query cho từng nghiệp vụ                                                                                                           |

### Cố ý ngoài phạm vi

- Thanh toán tiền thật: cần hợp đồng merchant của làng nghề; site đang chạy ở chế độ demo, VNPay/MoMo/SePay chỉ bật khi có tài khoản tương ứng ([SRS §1.2](docs/requirements/SRS.md), ADR-0021, ADR-0024).
- Tích hợp vận chuyển, ứng dụng di động native, hóa đơn điện tử.
- Đấu thầu công khai: yêu cầu báo giá là **riêng tư**, chào giá được niêm phong giữa các hộ (FR-RFQ-06); hộ ngoài danh sách mời chỉ thấy bản tóm tắt đã che của yêu cầu điều phối mở (ADR-0026).

Chưa kiểm chứng trên hạ tầng thật (checklist ở [docs/demo/README.md §7](docs/demo/README.md#7-kiểm-tra-trước-giờ-thi-trên-dữ-liệu-đóng-băng)): Lighthouse, tunnel dự phòng, khôi phục sao lưu.

Các mục chưa tick trong [docs/PLAN.md §5](docs/PLAN.md#5-backlog-chi-tiết-theo-epic) là việc còn lại.

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
| 2      | `packages/database/src/migrations` | Bảng nghiệp vụ do MikroORM quản lý (RFQ, đơn, sản phẩm, hộ, nhật ký, thanh toán, tin tức…)                                                                                                                                                 | `pnpm db:migrate`                                                 |

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
- Conventional Commits · Definition of Done ở [PLAN §8](docs/PLAN.md#8-definition-of-done--quy-trình-làm-việc) · quy tắc cho AI agent ở [CLAUDE.md](CLAUDE.md).
