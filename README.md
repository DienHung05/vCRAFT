<div align="center">

# vCraft

**Tinh hoa làng nghề, muôn phương lan tỏa**

Nền tảng triển lãm số, truy xuất nguồn gốc bằng QR và điều phối đơn sỉ cho làng nghề truyền thống Việt Nam.

[![Production](https://img.shields.io/badge/production-vcraft.click-8B2E1F?style=flat-square)](https://vcraft.click)
[![API docs](https://img.shields.io/badge/API-OpenAPI%203.1-2E5E4E?style=flat-square)](https://vcraft-api.onrender.com/api/docs)
[![CI](https://github.com/DienHung05/vCRAFT/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/DienHung05/vCRAFT/actions/workflows/ci.yml)

**[🌐 vcraft.click](https://vcraft.click)** · [Tài liệu API](https://vcraft-api.onrender.com/api/docs) · [SRS](docs/requirements/SRS.md) · [Kiến trúc](docs/ARCHITECTURE.md)

_Bài tập lớn INT3306 — Phát triển ứng dụng web · Fall 2026_

</div>

## Giới thiệu

vCraft kết nối hộ sản xuất làng nghề với người mua qua ba chức năng chính:

- **Triển lãm số** — giới thiệu làng, hộ, nghệ nhân, sản phẩm và bản đồ xưởng.
- **Truy xuất nguồn gốc** — mỗi sản phẩm có mã QR dẫn tới nhật ký sản xuất, niêm phong bằng chuỗi băm SHA-256.
- **Báo giá và đơn sỉ** — khách sỉ gửi yêu cầu; hộ chào giá trực tiếp, hoặc Ban quản lý làng ghép nhiều hộ thành một chào giá liên kết.

Dữ liệu mẫu dựng trên làng gốm Bát Tràng; hộ và người trong dữ liệu là hư cấu.

## Demo

| Thành phần   | Địa chỉ                                                                          |
| ------------ | -------------------------------------------------------------------------------- |
| Website      | https://vcraft.click                                                             |
| Tài liệu API | https://vcraft-api.onrender.com/api/docs                                         |
| QR mẫu       | [vcraft.click/q/DF6P3WZE](https://vcraft.click/q/DF6P3WZE) — trang truy xuất chiếc cốc mẫu |

> [!NOTE]
> Thanh toán chạy ở **chế độ demo**, không có giao dịch thật. Tài khoản demo xem tại [docs/demo/README.md](docs/demo/README.md).

## Tính năng

- **Khách** — xem sản phẩm, nghệ nhân, bản đồ, tin tức (Việt/Anh); quét QR xem nguồn gốc; hỏi trợ lý AI "Cáo".
- **Khách sỉ** — gửi yêu cầu báo giá, so sánh và chốt chào giá, thanh toán (VietQR, VNPay, MoMo), đánh giá hộ.
- **Hộ sản xuất** — quản lý hồ sơ, xưởng, sản phẩm, nhật ký sản xuất trong Studio; chào giá; cập nhật tiến độ đơn.
- **Ban quản lý** — duyệt hộ, điều phối và chia đơn cho nhiều hộ, quản lý người dùng, đăng tin; bắt buộc MFA.

## Công nghệ

| Lớp      | Công nghệ                                                              |
| -------- | ---------------------------------------------------------------------- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TanStack Query, MapLibre         |
| Backend  | NestJS 12 (REST `/api/v1` + SSE), BullMQ + Redis, Zod                  |
| Dữ liệu  | PostgreSQL (Supabase) qua MikroORM, Supabase Auth & Storage, pgvector |
| AI       | OpenAI (RAG cho trợ lý Cáo)                                            |
| Hạ tầng  | Vercel (web), Render (API, worker), Supabase, GitHub Actions           |

## Cấu trúc

```
apps/
  web/        Giao diện Next.js — trang công khai, Studio, Admin
  api/        REST API NestJS
  worker/     Việc nền: xử lý ảnh, QR/PDF, email, job hẹn giờ
packages/
  domain/     Logic nghiệp vụ thuần (state machine, chia đơn, chuỗi băm)
  database/   Entity, migration, seeder
  contracts/  Schema Zod dùng chung
  ui/ i18n/ api-client/ knowledge/ storage/ utils/
docs/         SRS, kiến trúc, ADR, hướng dẫn deploy
```

## Chạy cục bộ

Yêu cầu: Node ≥ 24, Docker, một project Supabase để thử nghiệm.

```bash
corepack enable pnpm
pnpm install
cp .env.example .env     # điền thông tin Supabase, CSDL, Redis
pnpm infra:up            # Redis, Mailpit, Caddy

supabase db push         # 1. migration Supabase (quyền, RLS, bucket) — chạy trước
pnpm db:migrate          # 2. migration nghiệp vụ
pnpm db:seed             # dữ liệu mẫu

pnpm dev                 # http://localhost:8080
```

| Lệnh              | Tác dụng                          |
| ----------------- | --------------------------------- |
| `pnpm dev`        | Chạy web, API, worker             |
| `pnpm build`      | Build toàn bộ                     |
| `pnpm lint`       | Kiểm tra mã bằng Biome            |
| `pnpm typecheck`  | Kiểm tra kiểu TypeScript          |
| `pnpm test`       | Unit test (Vitest)                |
| `pnpm test:e2e`   | Test đầu-cuối (Playwright)        |

Hướng dẫn triển khai production: [docs/operations/deploy.md](docs/operations/deploy.md).

## Tài liệu

- [Đặc tả yêu cầu (SRS)](docs/requirements/SRS.md)
- [Kiến trúc](docs/ARCHITECTURE.md) · [Quyết định kiến trúc (ADR)](docs/adr/README.md)
- [Triển khai](docs/operations/deploy.md) · [Demo](docs/demo/README.md)
- [Kế hoạch](docs/PLAN.md) · [Thương hiệu](docs/design/BRAND.md)

## Quy ước

- `develop` là nhánh tích hợp, `main` để deploy; mọi thay đổi qua PR vào `develop` với CI xanh.
- Commit theo [Conventional Commits](https://www.conventionalcommits.org/).

---

<div align="center">
<sub>Nhóm 3 thành viên · INT3306 · Dự án phục vụ mục đích học tập</sub>
</div>
