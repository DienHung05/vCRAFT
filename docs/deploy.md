# Triển khai production: Vercel (web) + Render (API, worker) + Supabase

> Quyết định và lý do: [ADR-16](adr/0016-deploy-vercel-render.md). Mã đã sẵn sàng; tài liệu này là việc **chỉ người** làm được (tạo tài khoản, kết nối repo, dán biến môi trường, trỏ domain). Không có bí mật nào trong repo.
> Tài liệu demo và dự phòng: [docs/demo/README.md](demo/README.md).

## 0. Sơ đồ và nguyên tắc

```text
Trình duyệt ──HTTPS──> Vercel (apps/web)  ──rewrite /api/*──> Render: vcraft-api ──> Supabase (Postgres, Storage)
     │                                                              │
     └── supabase-js (đăng nhập) ──> Supabase Auth                  └── Render Key Value (Redis) <── Render: vcraft-worker
```

- Trình duyệt chỉ nói chuyện với **một origin** (domain của web). `/api/*` được Next chuyển tiếp sang API trên Render, nên không cần CORS và không có cookie xuyên origin.
- Token đăng nhập đi trong header `Authorization: Bearer`, không dùng cookie cho API.
- Chỉ nhánh **`main`** tự deploy production. Pull request vào `develop`/`main` có preview của web (Vercel). API và worker không có preview.

| Cần có trước | Ghi chú |
| --- | --- |
| Tài khoản GitHub có quyền vào repo | Vercel và Render đều đăng nhập bằng GitHub |
| Tài khoản Vercel, Render | Render cần thẻ thanh toán (gói `starter`, xem §7) |
| Project Supabase đang chạy | Lấy được các giá trị ở bảng §2. Vùng hiện tại `eu-west-1` (Ireland) quyết định vùng Render/Vercel bên dưới |
| Domain thi | Quản lý DNS được; QR in trên cốc mã hóa domain này nên **không được đổi sau khi in** |
| Nhà cung cấp SMTP | Gửi email xác thực (Supabase Auth) và thông báo (worker); đã xác minh domain gửi (SPF/DKIM) |
| File `infra/certs/supabase-root-2021.crt` đã có trên `main` | CA của pooler Supabase (thêm bởi GH#26). Thiếu file thì API không khởi động được; hoặc dùng `DB_SSL_CA` (§2) |

Thứ tự làm: Supabase (§2) → Render (§3) → Vercel (§4) → domain (§5) → Supabase Auth URL (§6) → kiểm tra (§8).

## 1. Chuẩn bị mã

1. Merge `develop` vào `main` (chỉ khi cần phát hành; `main` chỉ để deploy). CI phải xanh vì Render đợi (`checksPass`).
2. Xác nhận `infra/certs/supabase-root-2021.crt` có trên `main`.

## 2. Gom giá trị cần dán

Tất cả lấy từ Supabase Dashboard (đường dẫn trong ngoặc theo `.env.example`). Mô tả đầy đủ từng biến ở `.env.example`.

| Giá trị | Dùng ở | Lấy ở đâu |
| --- | --- | --- |
| `DB_HOST`, `DB_USER` | API, worker | Connect → **Session pooler** (host `aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`) |
| `DB_PASSWORD` | API, worker | Mật khẩu database (đặt lại ở Database → Settings nếu quên) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | API, worker | Storage → S3 Configuration (tạo access key mới) |
| `MEDIA_PUBLIC_BASE_URL` | API, worker | `https://<ref>.supabase.co/storage/v1/object/public/vcraft-media` |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL` | API (+ `SUPABASE_URL` cho worker) | Project URL; JWKS: `<URL>/auth/v1/.well-known/jwks.json` |
| `SUPABASE_PUBLISHABLE_KEY` | API | Settings → API Keys (khóa `sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | API, worker | Khóa `sb_secret_...`. **Chỉ dán vào Render**, không bao giờ vào Vercel |
| `FIELD_ENCRYPTION_KEYS` | API, worker | Sinh mới: `v1:` + `openssl rand -base64 32`. **Giống nhau ở cả hai service**; giữ bản sao ở nơi an toàn, mất khóa là mất dữ liệu đã mã hóa |
| `SMTP_URL`, `MAIL_FROM` | worker | Nhà cung cấp SMTP, vd. `smtps://user:pass@smtp.example.com:465`; `MAIL_FROM="vCraft <no-reply@<domain>>"` |
| `APP_URL` | API, worker | Origin công khai của web: `https://<domain>` (không có `/` cuối). Worker dùng để sinh liên kết trong email |

**CA của pooler.** Mặc định `render.yaml` đặt `DB_SSL_CA_FILE=/opt/render/project/src/infra/certs/supabase-root-2021.crt` (Render clone repo vào `/opt/render/project/src`). Nếu muốn dán PEM thay cho file: xóa `DB_SSL_CA_FILE` khỏi nhóm biến `vcraft-shared` trên Render, rồi đặt `DB_SSL_CA` ở cả hai service (chỉ đặt MỘT trong hai, nếu không API từ chối khởi động).

## 3. Render: tạo Blueprint

1. Render Dashboard → **New → Blueprint** → kết nối GitHub, chọn repo vCraft, nhánh **`main`**, file `render.yaml` (mặc định).
2. Render liệt kê ba tài nguyên, cả ba ở vùng **Frankfurt** (gần `eu-west-1` của Supabase nhất; không đổi được sau khi tạo, và phải cùng vùng để Redis kết nối nội bộ): `vcraft-api` (web), `vcraft-worker` (background worker), `vcraft-redis` (Key Value). Kiểm tra gói `starter` đã hiển thị giá.
3. Màn hình hỏi giá trị cho các biến `sync: false`: dán theo bảng §2 cho **cả hai** service (biến trùng tên nhập hai lần, giá trị giống nhau).
4. **Apply**. Lần đầu Render build, chạy migration (`pnpm --filter @vcraft/database db:migrate`) rồi mới khởi động API. Migration lỗi thì deploy bị hủy và log nằm ở tab *Events* của `vcraft-api`.
5. Khi `vcraft-api` báo *Live*, ghi lại URL `https://vcraft-api.onrender.com` (tên thật có thể có hậu tố). Mở `<URL>/api/v1/health`, phải thấy `{"status":"ok",...}`.
6. `vcraft-worker` *Live* khi log có dòng `queues ready: media, mail, outbox`.

Biến không cần đặt tay: `PORT` (Render tự đặt, API đọc), `REDIS_URL` (lấy từ Key Value qua Blueprint), `TRUST_PROXY=true`, `NODE_VERSION=24`, các giá trị không bí mật trong nhóm `vcraft-shared`. **Không** đặt `DEMO_*` trên Render (xem `.env.example`).

Tùy chọn: `CORS_ORIGINS=https://<domain>` ở `vcraft-api` chỉ khi có client gọi thẳng API chéo origin (mặc định không cần).

## 4. Vercel: tạo project

1. Vercel Dashboard → **Add New → Project** → import repo vCraft.
2. **Root Directory: `apps/web`**. Giữ bật *Include source files outside of the Root Directory in the Build Step* (mặc định bật, cần vì web dùng các package trong `packages/`).
3. Framework Preset **Next.js**. Install và Build Command lấy từ `apps/web/vercel.json` (không cần sửa: cài từ gốc repo bằng pnpm, build bằng `turbo run build --filter=@vcraft/web`). Output Directory `.next`.
4. Settings → General → **Node.js Version: 24.x**. Vùng hàm SSR đã khai báo `fra1` (Frankfurt) trong `vercel.json`, để SSR → API → CSDL cùng ở châu Âu; kiểm tra ở Settings → Functions → Function Region. Trang tĩnh vẫn phục vụ từ edge gần người dùng. Nếu đổi vùng project Supabase, đổi lại cả `regions` ở đây và vùng Render.
5. Settings → Git → **Production Branch: `main`**. Pull request có preview tự động.
6. Settings → Environment Variables (đánh dấu **Production** và **Preview**):

   | Biến | Giá trị |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://<domain>` (nhúng vào QR lúc build) |
   | `API_INTERNAL_URL` | `https://<URL Render của vcraft-api>/api/v1` (rewrite `/api/*` lấy origin từ biến này) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Khóa `sb_publishable_...` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key Turnstile (nếu dùng) |
   | `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_CENTER` | Như `.env.example` (tùy chọn) |
   | `NEXT_PUBLIC_USD_VND_RATE` | Optional. Fallback VND-per-USD rate (default `25000`) used only when the daily rate source is unreachable; see below |

   Mọi biến ở trên được **chốt lúc build**: sửa xong phải **Redeploy**. Không đặt `SUPABASE_SECRET_KEY` hay bất kỳ bí mật nào ở Vercel; web không cần.
7. **Deploy**. Mở URL `*.vercel.app` được cấp.

**Daily USD reference rate (BR-07).** The English site shows a USD figure next to VND prices. The Next.js server on Vercel fetches the VND-per-USD rate from the keyless fawazahmed0/currency-api (jsDelivr CDN, Cloudflare Pages mirror) and keeps it in Next's data cache for 24 hours (`revalidate: 86400`), so there is no extra service, API route or worker job and no request from the visitor's browser. The date of the rate is shown in the rate note under the price. If both hosts fail, time out (3 s each) or return a rate outside 10,000 to 60,000, the site uses `NEXT_PUBLIC_USD_VND_RATE` (or 25,000) and the note says "about" with no date. A failed fetch is not cached by Next, but the page that rendered with the fallback stays cached until its next 24-hour revalidation, so a one-off outage can show the fallback for up to a day. The Vietnamese site never shows USD and does not fetch the rate.

Preview deployment dùng chung API và CSDL production (không có staging); đừng thao tác phá hủy từ bản preview.

## 5. Domain và HTTPS

1. Vercel → Settings → Domains → thêm `<domain>` (và `www.<domain>` nếu dùng, đặt một bên chuyển hướng sang bên kia).
2. Tại nhà cung cấp DNS tạo bản ghi theo hướng dẫn Vercel hiển thị (apex: `A` tới IP Vercel; subdomain: `CNAME` tới `cname.vercel-dns.com`). Vercel cấp và gia hạn chứng chỉ HTTPS tự động, chuyển HTTP sang HTTPS.
3. Đặt TTL thấp (60 giây) cho bản ghi để chuyển sang tunnel dự phòng nhanh (demo README §8).
4. Sau khi domain chạy: kiểm tra `NEXT_PUBLIC_SITE_URL` đúng domain này, nếu vừa sửa thì Redeploy.
5. `vcraft-api` giữ URL `onrender.com`; không cần domain riêng vì người dùng không gọi thẳng API. Nếu muốn domain riêng (`api.<domain>`), thêm ở Render → Settings → Custom Domains rồi sửa `API_INTERNAL_URL` và Redeploy web.
6. Cloudflare Turnstile: thêm `<domain>` vào danh sách hostname của widget.

## 6. Supabase Auth và SMTP

Dashboard → Authentication:

1. **URL Configuration → Site URL**: `https://<domain>`.
2. **Redirect URLs**: `https://<domain>/**`. Nếu muốn đăng nhập thử trên preview, thêm mẫu `https://*-<tên team>.vercel.app/**` (lấy tên team ở URL preview thật).
3. **SMTP Settings** (Authentication → Emails → SMTP): bật custom SMTP với cùng nhà cung cấp, `Sender` thuộc domain đã xác minh. SMTP mặc định của Supabase giới hạn rất thấp và chỉ gửi cho thành viên nhóm, không đủ cho ngày thi.
4. Gửi thử: đăng ký một tài khoản bằng email thật trên domain production, nhận email xác nhận, bấm liên kết và về đúng domain.
5. Worker: tạo một thông báo (vd. mời hộ chào giá) và kiểm tra email thông báo đến nơi; lỗi gửi hiện ở log `vcraft-worker`.

## 7. Giữ API thức vào ngày thi

- **Khuyến nghị: gói trả phí `starter`** (đã đặt trong `render.yaml`). Service luôn chạy, không ngủ, nên request đầu tiên không bị cold start. Gói `free` ngủ sau 15 phút, lần gọi đầu mất vài chục giây và vượt hạn 30 giây của proxy Vercel, nên lúc đó trang tin tức hiện "không khả dụng" và thao tác bị lỗi.
- Gói `free` cũng không có `preDeployCommand`, tức mất migration tự động. Không dùng `free` cho production.
- **Phương án thêm, rẻ: keep-alive.** Dùng dịch vụ giám sát bên ngoài (vd. UptimeRobot, cron-job.org) gọi `GET https://<URL Render>/api/v1/health` mỗi 5 phút. Chỉ bổ sung cho `starter` (phát hiện sự cố sớm), không thay thế nếu để `free`.
- Trước giờ thi 1 giờ: mở `<URL Render>/api/v1/health` và `https://<domain>/vi`, chạy `pnpm demo:e2e:preexam` (demo README), và nhìn Render → *Metrics* xem không có restart lặp lại.
- Supabase Free tự tạm dừng sau 7 ngày không hoạt động: vào Dashboard khôi phục nếu cần, trước ngày thi ít nhất một ngày.

## 8. Kiểm tra sau triển khai

```bash
curl -fsS https://<URL Render>/api/v1/health                  # {"status":"ok",...}
curl -fsS https://<domain>/api/v1/health                      # cùng kết quả: rewrite hoạt động
curl -sI https://<domain>/q/DF6P3WZE                          # 308, Location: /vi/truy-xuat/DF6P3WZE
curl -sI https://<domain>/vi | grep -i strict-transport       # có HSTS
```

Kiểm tay một lần: đăng nhập vai hộ sản xuất và tải lên một ảnh ~9 MB (gần giới hạn 10 MB) qua Studio, hoặc gọi endpoint media của API qua `https://<domain>/api/v1/...` nếu chưa có màn hình, để chắc rewrite của Vercel không chặn body lớn (ADR-16); nếu bị chặn, xem phương án trong ADR-16.

Mở `https://<domain>/vi/tin-tuc`: phải có bài (API gọi được từ server Next). Quét thử QR bằng điện thoại ở mạng 4G.

## 9. Triển khai tiếp theo, rollback, sự cố

- **Triển khai:** merge vào `main`. Vercel build web; Render đợi CI xanh rồi build, chạy migration, khởi động API và worker. Migration luôn chạy trước khi bản API mới nhận traffic; viết migration tương thích ngược (thêm cột trước, bỏ cột sau).
- **Rollback web:** Vercel → Deployments → chọn bản cũ → *Promote to Production*. **Rollback API:** Render → *Deploys* → *Rollback*. Rollback **không** hoàn tác migration.
- Đổi biến môi trường Render tự khởi động lại service; đổi biến Vercel cần Redeploy (biến chốt lúc build).
- `/api/*` trả 404 trên domain: `API_INTERNAL_URL` chưa đặt (hoặc đặt sau khi build). Đặt rồi Redeploy.
- API không khởi động, log nói *Không đọc được DB_SSL_CA_FILE*: thiếu file CA trên `main` hoặc sai đường dẫn (§2).
- Trang đăng nhập về `localhost` hoặc báo URL không hợp lệ: Site URL / Redirect URLs trong Supabase (§6).
- Sự cố trước mặt giám khảo: không sửa tại chỗ, chuyển sang phương án dự phòng (demo README §8).
