<div align="center">

# vCraft

**Tinh hoa làng nghề, muôn phương lan tỏa**

Triển lãm số · Truy xuất nguồn gốc bằng QR · Báo giá & điều phối đơn sỉ · Bản đồ làng nghề

*Bài tập lớn INT3306 — Phát triển ứng dụng web · Fall 2026*

</div>

---

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [docs/SRS.md](docs/SRS.md) | Đặc tả yêu cầu: chức năng theo vai trò, máy trạng thái báo giá, quy tắc khóa, phi chức năng, truy vết tiêu chí chấm |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc C4, monorepo & luật ranh giới, backend, design patterns, mô hình dữ liệu, bảo mật, frontend, hoạt ảnh, ADR |
| [docs/PLAN.md](docs/PLAN.md) | Tech stack, phân vai, lộ trình sprint, backlog, kịch bản demo, chuẩn bị vấn đáp, rủi ro |
| [docs/BRAND.md](docs/BRAND.md) | Nhận diện thương hiệu: ấn triện, màu, chữ, hoa văn, ngôn ngữ chuyển động, giọng văn |
| [docs/requirements/vCraft.pdf](docs/requirements/vCraft.pdf) | Đề bài gốc |

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
infra/        compose, docker, caddy, scripts
docs/         SRS, kiến trúc, kế hoạch, thương hiệu
```

Luật phụ thuộc giữa các gói được kiểm tự động (`pnpm deps:check`) — xem [ARCHITECTURE §3.2](docs/ARCHITECTURE.md#32-đồ-thị-phụ-thuộc--luật-ranh-giới).

## Bắt đầu

```bash
corepack enable && corepack use pnpm@latest
pnpm install
cp .env.example .env
pnpm infra:up          # postgres, redis, minio, mailpit, caddy
pnpm db:migrate && pnpm db:seed
pnpm dev               # web :3000 · api :4000 · truy cập qua Caddy http://localhost:8080
```

Kiểm chứng độc lập CSDL: `docker compose -f infra/compose/compose.dev.yml --profile mysql up -d mysql`, đặt `DB_DRIVER=mysql`, `DB_PORT=3306`, chạy lại migrate/seed.

## Quy ước

Conventional Commits · nhánh `feat/<epic>-<mô-tả>` · PR cần 1 review + CI xanh · Definition of Done ở [PLAN §8](docs/PLAN.md#8-definition-of-done--quy-trình-làm-việc).
