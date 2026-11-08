# Triển khai production: Vercel (web) + Render (API, worker) + Supabase

> Quyết định và lý do: [ADR-16](../adr/0016-deploy-vercel-render.md). Mã đã sẵn sàng; tài liệu này là việc **chỉ người** làm được (tạo tài khoản, kết nối repo, dán biến môi trường, trỏ domain). Không có bí mật nào trong repo.
> Tài liệu demo và dự phòng: [docs/demo/README.md](../demo/README.md).

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
| `FIELD_ENCRYPTION_KEYS` | API, worker | Sinh mới: `v1:` + `openssl rand -base64 32`. **Giống nhau ở cả hai service**; giữ bản sao ở nơi an toàn, mất khóa là mất dữ liệu đã mã hóa. Thiếu hoặc sai định dạng thì API và worker không khởi động. Xoay khóa: đặt khóa mới lên đầu (`v2:<khóa mới>,v1:<khóa cũ>`), redeploy cả hai service, chạy `pnpm db:rotate-field-keys` (cần cùng `DB_*` và `FIELD_ENCRYPTION_KEYS`), rồi mới bỏ `v1` khỏi danh sách (xem ADR-18) |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | Web (Vercel) | Optional. Mailbox that receives personal-data requests the account page cannot handle (an order in progress blocks self-service deletion). Shown as a mailto link in the privacy policy (NFR-SEC-07); empty shows the generic Management Board wording. Build-time: Redeploy after changing it |
| `SMTP_URL`, `MAIL_FROM` | worker | Nhà cung cấp SMTP, vd. `smtps://user:pass@smtp.example.com:465`; `MAIL_FROM="vCraft <no-reply@<domain>>"` |
| `APP_URL` | API, worker | Origin công khai của web: `https://<domain>` (không có `/` cuối). Worker dùng để sinh liên kết trong email |

**CA của pooler.** Mặc định `render.yaml` đặt `DB_SSL_CA_FILE=/opt/render/project/src/infra/certs/supabase-root-2021.crt` (Render clone repo vào `/opt/render/project/src`). Nếu muốn dán PEM thay cho file: xóa `DB_SSL_CA_FILE` khỏi nhóm biến `vcraft-shared` trên Render, rồi đặt `DB_SSL_CA` ở cả hai service (chỉ đặt MỘT trong hai, nếu không API từ chối khởi động).

**Connection pool and health probes (vCRAFT-83g.45).** The Supavisor *session* pooler pins one server connection to each client connection and caps clients at the project's `pool_size` (default 15, Dashboard -> Database -> Settings) per user and database; further clients are queued for up to a minute. The API, the worker, the pre-deploy migration, `pg_cron` and every developer machine share that budget, so each process keeps a small pool (`DB_POOL_MAX`: API 5, worker 3 in `render.yaml`, see `.env.example` for all `DB_POOL_*` / `DB_QUERY_TIMEOUT_MS` knobs). Waiting for a connection is bounded (`DB_POOL_ACQUIRE_TIMEOUT_MS`, 5 s) and a statement that gets no answer is dropped (`DB_QUERY_TIMEOUT_MS`, 20 s), so a stuck pool shows up as fast `503 SERVICE_UNAVAILABLE` (with `Retry-After`) and heals by itself instead of hanging until restart.

- `GET /api/v1/health` is **liveness** only (no database); keep it as `healthCheckPath` and for the keep-alive ping.
- `GET /api/v1/health/ready` is **readiness**: a `select 1` through the request pool (2 s limit, `HEALTH_READY_TIMEOUT_MS`), returning pool counters (`total`, `idle`, `waiting`, `max`). Point an external monitor/alert at it; do not use it as `healthCheckPath`, or Render restarts the API whenever the database flaps.
- If `waiting` stays above 0 or readiness flaps, first look for other clients holding the pooler (`select usename, application_name, state, count(*) from pg_stat_activity group by 1,2,3`), then raise `pool_size` in the Dashboard (up to about 40-80% of `max_connections`, which is 60 on the free tier) or lower `DB_POOL_MAX` elsewhere.
- Transaction pooler (port 6543) lets many more clients share the same server connections, but the shared pooler then forbids prepared statements, session state (`set`, session advisory locks, `listen`/`notify`, temp tables) and cursors outside a transaction, and Supavisor ignores some startup parameters. The incident was caused by unbounded waits, not by the pooling mode, so the app stays on session mode (ADR-15). Revisit only if the `pool_size` budget above cannot be met, and then re-run the whole integration suite and the migrations against port 6543 first.

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

### 5.1 Offline map fallback (GH#100)

The village map loads OpenFreeMap. If that style does not answer within 2.5 s, or its tiles start failing, the map switches to a PMTiles extract of Bát Tràng stored in Supabase Storage. It draws that extract with a small brand style and shows a "backup map" badge.

1. Install the [`pmtiles` CLI](https://github.com/protomaps/go-pmtiles/releases).
2. From the repository root, with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` exported, run `scripts/map/extract-bat-trang.sh`. It extracts the area from the latest Protomaps daily build, uploads it to the public bucket as `map/bat-trang.pmtiles`, and prints the public URL.
3. Vercel: set `NEXT_PUBLIC_MAP_PMTILES_URL` to that URL and redeploy.
4. Check: block `tiles.openfreemap.org` in the browser's DevTools (Network → Block request domain), reload `/vi/ban-do`. The map should appear in brand colours with the badge, and the workshop pins should still work.

Without `NEXT_PUBLIC_MAP_PMTILES_URL`, the map behaves as before and there is no probe.

## 6. Supabase Auth và SMTP

Dashboard → Authentication:

1. **URL Configuration → Site URL**: `https://<domain>`.
2. **Redirect URLs**: `https://<domain>/**`. Nếu muốn đăng nhập thử trên preview, thêm mẫu `https://*-<tên team>.vercel.app/**` (lấy tên team ở URL preview thật).
3. **SMTP Settings** (Authentication → Emails → SMTP): bật custom SMTP với cùng nhà cung cấp, `Sender` thuộc domain đã xác minh. SMTP mặc định của Supabase giới hạn rất thấp và chỉ gửi cho thành viên nhóm, không đủ cho ngày thi.
4. Gửi thử: đăng ký một tài khoản bằng email thật trên domain production, nhận email xác nhận, bấm liên kết và về đúng domain.
5. Worker: tạo một thông báo (vd. mời hộ chào giá) và kiểm tra email thông báo đến nơi; lỗi gửi hiện ở log `vcraft-worker`.

### 6.1 Sign in with Google (GH#122)

Owner steps; the code is already in place (`apps/web/src/features/auth/google-sign-in.tsx`, `apps/web/src/app/auth/callback/route.ts`).

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (Web application).
   - Authorised JavaScript origins: `https://<domain>` and `http://localhost:3000`.
   - Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase handles the Google leg).
2. Supabase Dashboard → Authentication → Sign In / Providers → Google: enable, paste the client ID and secret.
3. Supabase Dashboard → Authentication → URL Configuration → Redirect URLs: add `https://<domain>/auth/callback` and `http://localhost:3000/auth/callback` (the wildcard entries `https://<domain>/**` already cover it if present).
4. Local Supabase CLI: set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (read by `supabase/config.toml`).
5. Check: on `/vi/dang-nhap`, "Tiếp tục với Google" goes to Google and back to the site signed in; a first sign-in lands as a buyer, with the SIGN_UP consent recorded.

### 6.2 Cloudflare Turnstile (GH#84)

The sign-in, sign-up, password recovery and change-password forms show Turnstile when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and pass the token to Supabase, which verifies it server-side. Google sign-in is not covered: Supabase does not apply CAPTCHA to OAuth.

1. Cloudflare Dashboard → Turnstile → *Add widget*: hostnames `<domain>` and `localhost`, mode *Managed*. Copy the site key and the secret.
2. Vercel: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the site key and redeploy (it is fixed at build time).
3. Supabase Dashboard → Authentication → Attack Protection → *Enable Captcha protection*: provider Turnstile, paste the secret.
4. Order matters: deploy the web build with the site key first, then turn captcha on in Supabase. Done the other way round, every sign-in fails until the new build is live.
5. Check: `/vi/dang-nhap` shows the widget; signing in works; with the widget not done, the form says to complete the check.
6. Local or CI: Cloudflare's test pair (site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`) always passes.

### 6.3 Admin two-factor authentication (GH#83)

Every admin route of the API needs an `aal2` session, meaning the admin has passed a TOTP code. With only a password (`aal1`) the API answers `403 AUTH_MFA_REQUIRED`. Instead of the admin pages, the web shows a screen to scan a QR code on first use, or to enter the 6-digit code on later sign-ins.

1. Supabase Dashboard → Authentication → Multi-Factor: check that TOTP is enabled (it is by default).
2. Each admin signs in and opens `/vi/admin`, scans the QR code with an authenticator app, and enters the code.
3. Lost phone: in Supabase Dashboard → Authentication → Users → the admin → delete the TOTP factor. The next sign-in enrols a new one.
4. `AUTH_ADMIN_MFA=off` on the API lifts the rule. Use it only for a local demo without Supabase MFA, never in production.

The account page (`/vi/tai-khoan`) lists the last 20 sign-ins. The API records one row per Supabase session (method and assurance level, no IP address). The page also has a button that signs the account out of every device.

## 7. Giữ API thức vào ngày thi

- Production currently runs on the free plans with a keep-alive job; see §11 (and §10 for the wizard that moves it to `starter`).
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

- **Deploy:** merging to `main` runs CI; when it is green, `.github/workflows/deploy.yml` deploys the API to Render (migrations included), then the web to Vercel, then runs smoke checks (§12). Neither platform deploys `main` on its own once the setup in §12 is done.

- **Rollback web:** Vercel → Deployments → chọn bản cũ → *Promote to Production*. **Rollback API:** Render → *Deploys* → *Rollback*. Rollback **không** hoàn tác migration.
- Đổi biến môi trường Render tự khởi động lại service; đổi biến Vercel cần Redeploy (biến chốt lúc build).
- `/api/*` trả 404 trên domain: `API_INTERNAL_URL` chưa đặt (hoặc đặt sau khi build). Đặt rồi Redeploy.
- API không khởi động, log nói *Không đọc được DB_SSL_CA_FILE*: thiếu file CA trên `main` hoặc sai đường dẫn (§2).
- Trang đăng nhập về `localhost` hoặc báo URL không hợp lệ: Site URL / Redirect URLs trong Supabase (§6).
- Sự cố trước mặt giám khảo: không sửa tại chỗ, chuyển sang phương án dự phòng (demo README §8).

## 10. Release wizard (steps only a human can do)

`scripts/release-wizard.sh` walks the owner through the release steps that need a person: linking Vercel to GitHub, the optional Render paid plan and custom domain, Supabase Auth URLs, SMTP, the field-encryption key backup, rotating the Storage S3 key, the privacy mailbox, and the release verification checklist (GH#39, GH#40). Each step opens the right page, says what to click, and verifies the result with a real check where one is possible.

```bash
scripts/release-wizard.sh              # run; finished steps are skipped on re-run
scripts/release-wizard.sh --status     # which steps are done
scripts/release-wizard.sh --reset s7   # run step s7 again (--reset all clears everything)
```

Requirements: `curl`, `jq`, `git`, `node`, the repo's `.env` (override with `ENV_FILE=...`), the Vercel CLI login (`npx vercel login`, or `VERCEL_TOKEN`) and the Render CLI login (`render login`, or `RENDER_API_KEY`). Optional: `gh` (reads the CI result), `pg_dump` and `aws` (backup helper).

| Step | What it does | Automated checks |
| --- | --- | --- |
| s1 Vercel ↔ GitHub | You connect GitHub to Vercel and grant the Vercel app access to the repo; the script links the project through the API and sets the production branch to `main` | Vercel account has a GitHub connection; `link.repo` is this repo; production branch is `main` |
| s2 Render paid plan (optional) | You add a card; the script moves `vcraft-api` to `starter`, restores the `render.yaml` build/start/pre-deploy commands and creates the `vcraft-worker` background worker | Plan is `starter`; worker exists and its deploy is live; API `/health` |
| s3 Custom domain (optional) | Adds the domain to Vercel, shows the DNS records (TTL 60), then switches `NEXT_PUBLIC_SITE_URL` and `APP_URL` and redeploys both | Vercel domain config is not misconfigured; HTTPS and the API rewrite answer on the domain |
| s4 Supabase Auth URLs | You set Site URL and Redirect URLs in the dashboard | Reads `mailer_autoconfirm` from the public Auth settings; the URLs themselves need your confirmation (no public API) |
| s5 SMTP | You verify a sender and enter the credentials (password hidden); the script builds `SMTP_URL`, sets it and `MAIL_FROM` on Render and redeploys | Real SMTP login with nodemailer (no mail sent); Render value fingerprint matches |
| s6 Field encryption key | Confirms Render has the same `FIELD_ENCRYPTION_KEYS` as `.env`, helps you copy it to a password manager without printing it | Format check and SHA-256 fingerprint (first 8 hex chars) of both copies |
| s7 Rotate the S3 key | New key → test it → update `.env` (backup first, mode 600) and Render → redeploy → test → you revoke the old key → re-test | Real `ListObjectsV2` on both buckets with the new key; the old key must be rejected afterwards |
| s8 Privacy mailbox | Sets `NEXT_PUBLIC_PRIVACY_EMAIL` on Vercel (production + preview) and redeploys the web from `origin/main` | The privacy page contains the `mailto:` link |
| s9 Release verification | Runs the GH#40 checks and asks you to confirm the physical ones | Health through the rewrite and direct, 308 for `/q/DF6P3WZE`, HSTS and CSP via GET, news list, no cold start, CI integration matrix (PostgreSQL + MySQL); optional `demo:verify`, `demo:auth -- --check`, `demo:e2e:preexam`. Never runs `demo:reset` |

Progress is kept in `~/.vcraft-release-wizard.state` (override with `WIZARD_STATE_FILE`): step ids and non-secret values only. Secrets are read with `read -s`, sent to the APIs through stdin and never printed or stored in the state file.

## 11. Production on the free plans (current setup)

Render's free web service has no background workers, no pre-deploy command, and 750 instance-hours per month for the whole workspace. Production therefore currently runs like this (service `vcraft-api`, workspace without a payment card):

- **Worker inside the API container.** The start command runs the BullMQ worker in a restart loop in the background and the API in the foreground:

  ```bash
  sh -c '(while true; do node --max-old-space-size=192 apps/worker/dist/main.js; echo "vcraft-worker exited, restarting in 5s" >&2; sleep 5; done) & exec node --max-old-space-size=256 apps/api/dist/main.js'
  ```

  The API is `exec`'d so it replaces the shell and receives Render's SIGTERM directly; the heap caps keep both processes inside the 512 MB limit. There is no separate `vcraft-worker` service, so the worker's log lines are in the `vcraft-api` log.
- **Migrations in the build command.** With no pre-deploy command, `pnpm --filter @vcraft/database db:migrate` is appended to the build command (after `turbo run build --filter=@vcraft/api... --filter=@vcraft/worker...`). A failing migration fails the build and the previous version keeps running, the same guarantee as pre-deploy.
- **Shared database.** `FIELD_ENCRYPTION_KEYS` on Render is the same key as the root `.env`, because production uses the Supabase database whose demo households were encrypted with it (wizard step s6 compares them).
- **No mail yet.** `SMTP_URL` and `MAIL_FROM` are unset until wizard step s5; mail jobs fail until then.
- **Keep-alive with `pg_cron`.** A free web service sleeps after 15 minutes; a Supabase job pings it every 10 minutes. It also keeps the Supabase Free project from pausing. Enable the `pg_cron` and `pg_net` extensions (Dashboard → Database → Extensions), then in the SQL editor:

  ```sql
  -- create
  select cron.schedule(
    'vcraft-keep-alive',
    '*/10 * * * *',
    $$select net.http_get('https://vcraft-api.onrender.com/api/v1/products?limit=1')$$
  );

  -- inspect: job, last runs, last HTTP responses
  select jobid, jobname, schedule, active from cron.job where jobname = 'vcraft-keep-alive';
  select status, return_message, start_time from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'vcraft-keep-alive')
    order by start_time desc limit 5;
  select id, status_code, created from net._http_response order by created desc limit 5;

  -- remove
  select cron.unschedule('vcraft-keep-alive');
  ```

  A 200 every 10 minutes in `net._http_response` means it works. If the Render URL changes (service renamed or recreated), unschedule and create the job again with the new URL.
- **750-hour budget.** One always-on free service uses about 744 hours in a 31-day month, so it fits, but only one free web service fits. Do not add a second free web service to the same workspace, and do not leave a preview or test service running; the free instance suspends for the rest of the month when the budget runs out. Check usage under Render → Account → Billing.
- **Limits you accept.** 512 MB RAM shared by API and worker, cold start of tens of seconds if the keep-alive misses a beat, the Redis free Key Value is not durable (the outbox in the database remains the source of truth).

### Moving back to the starter Blueprint

Do this after adding a payment card. Wizard step s2 does it through the API; by hand:

1. Render → `vcraft-api` → Settings → Instance Type → **Starter**.
2. Same page, set the commands to match `render.yaml`: Build `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm exec turbo run build --filter=@vcraft/api...` (no `db:migrate`, no worker filter), Pre-Deploy `corepack enable && pnpm --filter @vcraft/database db:migrate`, Start `node apps/api/dist/main.js`.
3. New → **Background Worker** named `vcraft-worker`: same repo and branch, Frankfurt, **Starter**, Build `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm exec turbo run build --filter=@vcraft/worker...`, Start `node apps/worker/dist/main.js`. Link the `vcraft-shared` env group and copy the worker variables listed in `render.yaml` from `vcraft-api` (same `FIELD_ENCRYPTION_KEYS`, `SMTP_URL`, `MAIL_FROM`, `REDIS_URL`).
4. Deploy `vcraft-api`; check the worker log for `queues ready: media, mail, outbox`.
5. Remove the keep-alive job (SQL above) or keep it: it is harmless, and still stops the Supabase project from pausing.

## 12. Continuous deployment (GitHub Actions)

`.github/workflows/deploy.yml` is the only production deployer for both the API and the web app. It deploys a commit only after the full CI run (`quality`, `integration`, `e2e`) passed on `main`. Merging the file changes nothing until `CD_ENABLED` is `true`.

### Flow

1. CI finishes green for a push to `main` (`workflow_run`), or someone starts the workflow by hand (`workflow_dispatch`).
2. `guard` resolves the SHA. For `workflow_run` it skips the run when the SHA is no longer the tip of `origin/main` (a newer merge will deploy itself). For `workflow_dispatch` it fails unless the SHA is an ancestor of `origin/main`.
3. `api` calls the Render API (`scripts/ci/render-deploy.sh`): deploy that exact commit, poll every 15 s up to 25 min until `live`, then check `$API_ORIGIN/api/v1/health` (up to 20 tries 15 s apart, so a free-plan cold start does not fail the run). Render answers the trigger with 201 + deploy JSON, or with 202 and an empty body when the deploy is queued behind another one; the script then finds the deploy by commit SHA in the deploys list. Transient trigger failures (curl error, 429, 5xx) are retried with backoff. A deploy that ends `deactivated` counts as success only if the live deploy is the same commit. If `RENDER_WORKER_SERVICE_ID` is set, that service is deployed the same way afterwards. The script is tested against a mock Render API with `pnpm test:scripts`.
4. `web` runs only after `api` succeeded, so migrations (which run in the Render build, §11, or in the pre-deploy command on `starter`) are live before the new web code. It runs the Vercel CLI `pull`, `build --prod` and `deploy --prebuilt --prod`, then `scripts/ci/smoke.sh "$PROD_ORIGIN"`.
5. `summary` writes the SHA, Render deploy id, Vercel URL and result to the job summary.

Runs are serialized (`concurrency: deploy-production`, never cancelled). Both deploy jobs use the GitHub environment `production`, so the owner can add required reviewers there.

All Vercel CLI commands run from the **repository root**, not from `apps/web`: the CLI reads the project's Root Directory (`apps/web`) from the pulled project settings, and running from `apps/web` fails with "Could not retrieve Project Settings". `vercel build` honours `installCommand` and `buildCommand` in `apps/web/vercel.json` (both `cd ../..`). `deploy --prebuilt` uploads `.vercel/output` produced by `vercel build`. The CLI is fetched with `npx --yes vercel@latest`. The `.vercel/` directory is git-ignored.

Vercel's own Git deployments are disabled for the project (Settings → Git, `createDeployments` off), so there are no automatic PR previews and the workflow is the only web deployer. `apps/web/vercel.json` also sets `git.deploymentEnabled.main: false` so that `main` stays off even if the project setting is relaxed later.

### Secrets and variables

Secrets live in the `production` environment (Settings → Environments → production).

| Secret | How to create |
| --- | --- |
| `RENDER_API_KEY` | Render → Account Settings → API Keys → Create API Key |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create, scope limited to the team that owns the project |

Variables (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
| --- | --- |
| `CD_ENABLED` | `true` to turn the pipeline on; anything else (or unset) turns it off |
| `RENDER_SERVICE_ID` | `vcraft-api` service id, e.g. `srv-dbjfrvetlv9c73d3rs0g` |
| `RENDER_WORKER_SERVICE_ID` | Optional. Id of a separate `vcraft-worker` service (starter Blueprint). Empty skips it |
| `API_ORIGIN` | `https://vcraft-api.onrender.com` |
| `PROD_ORIGIN` | `https://vcraft-vn.vercel.app` (or the custom domain) |
| `VERCEL_ORG_ID` | Vercel team id (Team Settings → General, or `.vercel/project.json` after `vercel link`) |
| `VERCEL_PROJECT_ID` | e.g. `prj_SCqbRhbbXBnJO4mAZI2vFhDdO2uX` |

### One-time setup order

1. Create the two secrets and the variables above. Leave `CD_ENABLED` unset.
2. Merge the PR that adds `deploy.yml`. Nothing deploys yet.
3. Set `CD_ENABLED=true`, then start the workflow once (`gh workflow run deploy.yml`) or merge to `main`.
4. Confirm the first Deploy run is green (Render live, Vercel deployed, smoke checks passed).
5. Only then turn off Render's own auto-deploy: Render → `vcraft-api` → Settings → Build & Deploy → Auto-Deploy → *Off*. `render.yaml` already sets `autoDeployTrigger: "off"`, but the live service was not created from the Blueprint sync, so its setting does not change by itself. Until this step, a push to `main` deploys on Render twice.

### Manual redeploy and rollback

```bash
gh workflow run deploy.yml                  # redeploy the current tip of main
gh workflow run deploy.yml -f ref=<sha>     # deploy a specific commit that is on main
scripts/ci/smoke.sh https://vcraft-vn.vercel.app   # the same read-only checks, from your machine
```

Rolling back is unchanged: Vercel → Deployments → *Promote to Production*, Render → *Deploys* → *Rollback* (§9). To roll forward to an older commit, dispatch it with `ref`. The workflow never undoes a migration, so keep migrations backward compatible.

### Branch protection

PR #96 merged with red CI because the branches were unprotected. Protect `main` and `develop` with these required status checks; the names must match exactly:

- `quality`
- `integration (postgresql)`
- `integration (mysql)`
- `e2e`

If a job is added to or renamed in `ci.yml`, update the required checks to match, otherwise merges block on a check that never reports (or the new job is not enforced).
