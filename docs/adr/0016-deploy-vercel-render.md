# ADR-16 — Triển khai web trên Vercel, API và worker trên Render, giữ Supabase

- Trạng thái: **Chấp nhận** (31/10/2026)
- Thay thế một phần: kế hoạch "1 VPS + Docker Compose + Caddy" ở [ARCHITECTURE §13.1](../ARCHITECTURE.md#131-môi-trường) và [PLAN §2.4](../PLAN.md); ý "Redis vẫn chạy cục bộ" ở mục 5 của [ADR-15](0015-business-db-on-supabase.md). Phần Supabase của ADR-11, ADR-14, ADR-15 giữ nguyên.
- Liên quan: GH#39, ADR-02, ADR-11, ADR-14, ADR-15, NFR-REL-01

## Bối cảnh

Kế hoạch ban đầu là một VPS 2 vCPU / 4 GB chạy Docker Compose (caddy, web, api, worker, redis), Caddy cấp HTTPS và gộp web với API về một origin. Nhóm phải tự vá hệ điều hành, tự dựng pipeline deploy qua SSH, tự giữ máy chạy đúng ngày thi, và chưa có VPS nào được dựng. Trong khi đó CSDL, Auth, Storage đã ở Supabase (ADR-11, 14, 15), nên VPS chỉ còn chạy ba tiến trình ứng dụng và Redis.

Nhóm chọn dùng nền tảng quản lý sẵn: Vercel cho Next.js, Render cho NestJS và worker. Mã giữ nguyên, chỉ thêm cấu hình triển khai.

## Quyết định

1. **Web (`apps/web`) trên Vercel.** Project trỏ vào thư mục gốc `apps/web` của monorepo, cấu hình trong `apps/web/vercel.json` (cài và build từ gốc repo bằng pnpm + `turbo run build --filter=@vcraft/web`). Nhánh production là `main`; mỗi pull request có preview.
2. **API và worker trên Render** theo `render.yaml` ở gốc repo (Blueprint): `vcraft-api` (web service, health check `/api/v1/health`, `preDeployCommand` chạy migration), `vcraft-worker` (background worker), `vcraft-redis` (**Render Key Value**, `noeviction` cho BullMQ). Web service và worker dùng gói trả phí `starter` (luôn chạy). Deploy khi push `main` và CI xanh (`autoDeployTrigger: checksPass`).
3. **Supabase giữ nguyên** cho Postgres, Auth, Storage. Pooler vẫn cần CA riêng: Render đọc `DB_SSL_CA_FILE=/opt/render/project/src/infra/certs/supabase-root-2021.crt` (file nằm trong repo), hoặc dán PEM vào `DB_SSL_CA`.
4. **Hai origin nhưng trình duyệt chỉ thấy một.** Thay cho `reverse_proxy /api/*` của Caddy, `apps/web/next.config.ts` khai báo **rewrite `/api/:path*` tới origin lấy từ `API_INTERNAL_URL`**. Trình duyệt vẫn gọi `/api/v1/...` cùng origin với web như khi đứng sau Caddy, nên:
   - không cần CORS cho luồng chính; API vẫn có allow-list `CORS_ORIGINS` (mặc định tắt) cho trường hợp phải gọi chéo origin;
   - không có cookie xuyên origin: API chỉ nhận `Authorization: Bearer` (ARCHITECTURE §8.1, mục CSRF), cookie phiên Supabase `SameSite=Lax` chỉ thuộc origin của web;
   - `API_INTERNAL_URL` (server Next gọi trực tiếp, vd. trang tin tức) và đích rewrite là cùng một biến, nên chỉ một nơi để sai.
5. **Header bảo mật chuyển từ Caddy sang Next** (`headers()` trong `next.config.ts`): HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` giữ nguyên giá trị của `routes.caddy`, thêm CSP chống nhúng iframe (`frame-ancestors 'none'; base-uri 'self'; object-src 'none'`). Phản hồi API đi qua rewrite không nhận header của Next (đã kiểm với `next start`), nên API tự đặt header qua `@fastify/helmet`.
6. **API chạy được trên Render:** nghe `0.0.0.0` tại `API_PORT`, nếu trống thì `PORT` (Render đặt), nếu trống thì 4000; `TRUST_PROXY=true` để lấy IP thật từ `X-Forwarded-For`; production start bằng `node apps/<app>/dist/main.js` (không phụ thuộc công cụ dev).
7. **Mã QR và domain:** domain thi trỏ vào Vercel (HTTPS tự động); `NEXT_PUBLIC_SITE_URL` nhúng vào QR lúc build phải đúng domain đó, nên đặt trước khi build production.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Giữ 1 VPS + Caddy | Phải tự vận hành máy, vá lỗi, dựng deploy; một điểm hỏng duy nhất vào ngày thi; chưa dựng được |
| Web + API cùng chạy trên Render | Mất preview theo PR và CDN/edge của Vercel cho trang công khai; Next trên Render cũng cần gói trả phí |
| Web và API gọi chéo origin (CORS + cookie) | Phải cấu hình CORS, `credentials`, `SameSite=None` nếu dùng cookie; thêm một lần preflight cho mỗi request có `Authorization`; rewrite đơn giản hơn và giữ nguyên mã `fetch('/api/v1/...')` |
| API trên Vercel Functions | Thay đổi kiến trúc NestJS, BullMQ cần tiến trình sống lâu; không hợp worker |
| Render Postgres thay Supabase | Mất Auth, Storage, vector store gắn với project Supabase (ADR-11, 13, 14) |

## Hệ quả

- Tốt: không còn máy chủ phải tự quản; HTTPS, gia hạn chứng chỉ, preview theo PR và rollback có sẵn; CI xanh mới deploy API; migration chạy tự động trước mỗi bản mới và hủy deploy nếu lỗi.
- **Hai origin, một bề mặt.** Mọi gọi API đi qua Vercel nên Vercel là điểm mà ba giới hạn dưới đây áp dụng:
  - thời gian chờ tối đa của yêu cầu được proxy là 30 giây (Vercel); API phải trả lời trong hạn đó;
  - SSE hiện chưa đi qua `/api` (cập nhật trực tiếp dùng Supabase Realtime); nếu thêm SSE qua API thì phải kiểm lại giới hạn thời gian này;
  - chưa kiểm chứng giới hạn dung lượng body của rewrite với tệp tải lên lớn (tối đa 10 MB, `MEDIA_MAX_BYTES`; ảnh đã nén ở trình duyệt xuống ~1,5 MB). **Thử bằng tay trên bản đã deploy: tải lên một ảnh ~9 MB** (`pnpm demo:check:media` chỉ kiểm worker, không đi qua rewrite); nếu bị chặn thì cho riêng đường tải lên gọi thẳng API và đặt `CORS_ORIGINS`.
- **Cold start.** Vercel không đáng kể cho trang SSR/tĩnh. Render gói free ngủ sau 15 phút không có request (cold start vài chục giây, vượt hạn proxy 30 giây) và không có `preDeployCommand`, vì thế API và worker dùng `starter` (luôn chạy). Chi tiết ngày thi ở [deploy.md](../deploy.md#7-giữ-api-thức-vào-ngày-thi).
- **Chi phí** (giá tham khảo, kiểm tra lại trên trang giá): Vercel Hobby 0 USD (điều khoản chỉ cho dự án phi thương mại, đủ cho đồ án); Render `vcraft-api` + `vcraft-worker` mỗi cái khoảng 7 USD/tháng; Key Value free 0 USD (25 MB, không lưu bền: restart mất job đang chờ, outbox trong CSDL vẫn là nguồn sự thật; nâng lên `starter` nếu cần lưu bền); Supabase giữ gói hiện tại (Free tạm dừng sau 7 ngày không hoạt động, PLAN §9).
- **Preview của web dùng chung API và CSDL production** (không có môi trường staging). Đừng chạy `demo:reset` hay thao tác phá hủy từ bản preview.
- **CSP chưa có `script-src` theo nonce.** Hiện chỉ có các chỉ thị không cần phân tích script. ARCHITECTURE §8.1 mô tả CSP đầy đủ có nonce: cần `proxy.ts` sinh nonce cho từng request và rà `connect-src`, `img-src`, worker của MapLibre, Turnstile. Đây là việc riêng, không nằm trong ADR này.
- **Cloudflare Tunnel dự phòng vẫn dùng được, đổi điểm chuyển.** Laptop thi vẫn chạy stack cục bộ (Caddy `:8080`, `STORAGE_DRIVER=local`) và phơi ra bằng tunnel có tên trên chính domain thi (demo README §8). Khác trước: thay vì "tắt VPS", phải **chuyển bản ghi DNS của domain từ Vercel sang tunnel** (TTL 60 giây), rồi trả lại sau buổi thi. Nếu domain không do Cloudflare quản lý DNS thì dùng quick tunnel như cũ.
- Hạ tầng cũ còn lại để chạy cục bộ và làm dự phòng: `infra/caddy` (dev, bậc A/B/C), `infra/compose`. `Caddyfile.prod` không còn dùng cho production; giữ làm tham chiếu cho dự phòng tự host, không xóa lịch sử.
- Việc còn lại cho người (tạo tài khoản, dán biến môi trường, cấu hình domain, Supabase Auth URL, SMTP): [docs/deploy.md](../deploy.md).
