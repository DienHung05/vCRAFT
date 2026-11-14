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
| `SUPABASE_URL` | API, worker | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | API | Settings → API Keys (khóa `sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | API, worker | Khóa `sb_secret_...`. **Chỉ dán vào Render**, không bao giờ vào Vercel |
| `FIELD_ENCRYPTION_KEYS` | API, worker | Sinh mới: `v1:` + `openssl rand -base64 32`. **Giống nhau ở cả hai service**; giữ bản sao ở nơi an toàn, mất khóa là mất dữ liệu đã mã hóa. Thiếu hoặc sai định dạng thì API và worker không khởi động. Xoay khóa: đặt khóa mới lên đầu (`v2:<khóa mới>,v1:<khóa cũ>`), redeploy cả hai service, chạy `pnpm db:rotate-field-keys` (cần cùng `DB_*` và `FIELD_ENCRYPTION_KEYS`), rồi mới bỏ `v1` khỏi danh sách (xem ADR-18) |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | Web (Vercel) | Optional. Mailbox that receives personal-data requests the account page cannot handle (an order in progress blocks self-service deletion). Shown as a mailto link in the privacy policy (NFR-SEC-07); empty shows the generic Management Board wording. Build-time: Redeploy after changing it |
| `SMTP_URL`, `MAIL_FROM` | worker | Nhà cung cấp SMTP, vd. `smtps://user:pass@smtp.example.com:465`; `MAIL_FROM="vCraft <no-reply@<domain>>"` |
| `NEWS_IMPORT_FEEDS` | worker | Optional (GH#314). RSS or Atom feeds of newspapers and portals for the automatic news import, separated by newline or `;`, each `https://feed-url` or `Publisher|https://feed-url` (the publisher is the "Nguồn" line shown to visitors; the host is used when left out). **Empty or no valid https feed turns the import off.** The job `news.import` runs on the scheduler queue; each run logs fetched / imported / skipped (with reasons) and a bad feed never stops the worker |
| `NEWS_IMPORT_VILLAGES`, `NEWS_IMPORT_CRAFTS` | worker | Optional, comma-separated. A feed story is kept only if its headline or snippet names one village and one craft word (accents and case ignored). Defaults: `Bát Tràng`; `gốm,sứ,gốm sứ,ceramic,pottery` |
| `NEWS_IMPORT_PUBLISH` | worker | Optional, default `true`. `false` saves imported stories as drafts for review in `/admin/tin-tuc` (filter "Origin") |
| `NEWS_IMPORT_EVERY_MINUTES`, `NEWS_IMPORT_MAX_PER_RUN` | worker | Optional, defaults `360` and `5`. Positive integers: how often the import runs, and the most stories imported per run |
| `WEB_REVALIDATE_URL`, `REVALIDATE_SECRET` | worker | ADR-0027. The worker's outbox relay calls `WEB_REVALIDATE_URL` (`https://<domain>/api/revalidate`, for example `https://vcraft-vn.vercel.app/api/revalidate`) with `Authorization: Bearer <REVALIDATE_SECRET>` so the web drops its cached public pages the moment a suspension, withdrawal or edit commits. `REVALIDATE_SECRET` is a long random value (`openssl rand -hex 32`), **the same on Vercel and on Render**. Either unset: nothing is sent and cached pages expire after 60 s. Behind Caddy use the web's own address, because `/api/*` goes to the API there. Check the worker boot log: "web revalidation off" means one of them is missing |
| `MEDIA_ORPHAN_SWEEP` | worker | Optional. Unset: the daily orphan media sweep (GH#381) only logs candidates; set `delete` to remove unlinked assets older than 7 days and their files (cannot be undone) |
| `NEWS_FILLER_MIN_PUBLISHED` | worker | Optional, default `6`. When fewer stories than this went live in the last 30 days, and `OPENAI_API_KEY` is set, the job writes evergreen craft articles (clay, glazes, firing, care, history, visitor guide; no events, people, quotes or prices; references listed). Without an LLM key the filler is skipped and the import stores only title, link and a one-line snippet |
| `API_RATE_LIMIT_PER_MINUTE` | API | Optional, default `600`. Requests per minute per caller across the whole API (NFR-SEC-04): a signed-in caller is counted by a hash of its bearer token, an anonymous one by IP; over it the API answers `429` problem+json (`RATE_LIMITED`) with `Retry-After`. `GET /health*` is never limited. Sign-in, sign-up and username checks keep their own stricter limits. Needs `TRUST_PROXY` set to the real hop count (see its row) so the IP is the visitor's, not the proxy's. Counting signed-in callers by token keeps page renders on Vercel, which share a few server IPs, from sharing one bucket; anonymous renders still share one, so raise the limit if many guests browse at once |
| `SLOW_REQUEST_MS` | API | Optional, default `500` (GH#537). A request slower than this is logged as a warning (`SlowRequest`): method, route pattern (never the raw URL, so ids and query strings stay out), status and milliseconds. The live-events and assistant streams are skipped. Every non-stream response also carries `Server-Timing: app;dur=<ms>` |
| `SLOW_QUERY_MS` | API | Optional, default `200` (GH#537). A SQL statement at least this slow is logged as a warning (`SlowQuery`) with its duration and the statement with literals replaced by `?` |
| `TRUST_PROXY` | API | Number of proxy hops in front of the API whose `X-Forwarded-For` entry is trusted, or a comma-separated list of proxy IPs/CIDRs. `false` or unset trusts none (`req.ip` is the socket address). The Blueprint sets `1`: Render's proxy appends the real client IP, so the last entry is the visitor and anything the client put before it is ignored. **If Cloudflare proxying is enabled in front of Render, set `2`** (or list Cloudflare's IP ranges), otherwise every visitor shares a Cloudflare edge IP. `true` is deprecated: it is read as `1` hop and logs a startup warning; the API never trusts every hop, because that lets a caller choose its own IP and dodge the per-IP limits |
| `ASSISTANT_RATE_LIMIT_PER_MINUTE`, `ASSISTANT_RATE_LIMIT_PER_DAY` | API | Optional, defaults `10` and `100`. Assistant messages per IP and per conversation per minute and per day (BR-AST-04). Unset uses the default; a positive integer overrides it; an explicit `0` turns that window off. Needs a correct `TRUST_PROXY` to see the visitor's IP |
| `ASSISTANT_DAILY_TOKENS` | API | Optional, default `2000000`. Daily token ceiling for all visitors, counted per village calendar day (Asia/Ho_Chi_Minh). Past it the assistant pauses and the rest of the site keeps working. An explicit `0` turns the ceiling off, so watch the OpenAI spend by hand |
| `ASSISTANT_IP_SALT` | API | **Set in production.** Without it the API derives a stable salt from `SUPABASE_SECRET_KEY` and logs a warning (random per process if that is missing too). A long random secret (for example `openssl rand -hex 32`) shared by every API instance. It salts the hash of the visitor IP used in rate limits and logs; with a different salt per instance or per restart, per-IP limits multiply with the instance count and reset on every deploy. In dev and test it is optional: a random salt per process is used, with a warning |
| `ASSISTANT_LLM`, `ASSISTANT_VECTOR_STORE` | API (`ASSISTANT_VECTOR_STORE` also worker) | Optional, leave unset in production. `ASSISTANT_LLM=scripted` swaps the OpenAI chat model for an offline scripted stand-in; `ASSISTANT_VECTOR_STORE=memory` forces the in-memory vector store instead of Supabase pgvector. Both exist for CI and demos without keys |
| `API_PORT` | API | Optional. Listen port for local runs; falls back to `PORT` (Render sets it), then `4000`. Leave unset on Render |
| `DB_DEBUG` | API, worker | Optional, default off. `true` logs every SQL query; do not leave it on in production |
| `API_RATE_LIMIT_ENABLED` | API | Optional, default `true`. `false` turns the global limiter off (for example while a load test runs) |
| `APP_URL` | API, worker | Origin công khai của web: `https://<domain>` (không có `/` cuối). Worker dùng để sinh liên kết trong email |
| `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_NAME`, `SEPAY_BANK_ACCOUNT_NUMBER`, `SEPAY_BANK_ACCOUNT_NAME` | API | Online payment (ADR-0021, ADR-0024, GH#205). Optional; payment is off until all four are set. The API key is a secret: the value you give SePay's bank-account webhook, sent back as `Authorization: Apikey <key>`. Account details are those of the village administration's bank account linked to SePay. **Render only** (API service), never Vercel. See "Online payment" below |
| `SEPAY_BANK_CODE`, `SEPAY_BANK_BIN`, `SEPAY_QR_BASE_URL` | API | Optional. Bank short name (e.g. `MBBank`) builds the QR image URL on `qr.sepay.vn`; the six-digit NAPAS BIN builds the VietQR payload. Without them the buyer sees the bank details and payment code but no QR |
| `PAYMENT_DEPOSIT_PERCENT`, `PAYMENT_EXPIRES_IN_HOURS`, `PAYMENTS_DEPOSIT_REQUIRED` | API | Optional. Deposit share of the order total (default `30`, whole percent 1-99); how long a pending **bank-transfer** payment waits for the money before the worker expires it (default `24`); whether production waits for a paid deposit (default: on once SePay is configured, `false` turns the gate off) |
| `PAYMENT_WALLET_EXPIRES_IN_MINUTES` | API | Optional, default `30`, positive whole number. How long a pending VNPay or MoMo payment waits (also sent to VNPay as `vnp_ExpireDate`). A payment that expired within the last 60 minutes is still settled if the provider reports the money (late money) |
| `VNPAY_MODE`, `MOMO_MODE` | API | `off`, `sandbox` or `production`, one per gateway (ADR-0024). Unset: `sandbox` when the legacy `PAYMENTS_SANDBOX_GATEWAYS=true`, else `off`. A gateway in `sandbox` mode is **never offered when `APP_ENV=production`** (fake money on a live site); the boot log says so. An unknown value turns the gateway off |
| `PAYMENTS_SANDBOX_GATEWAYS` | API | **Legacy.** `true` is read as `VNPAY_MODE=sandbox` and `MOMO_MODE=sandbox` for a gateway whose own mode is unset. Prefer the two `*_MODE` variables |
| `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET` | API | VNPay merchant (sandbox merchant at sandbox.vnpayment.vn, or the production merchant from the contract). `VNPAY_HASH_SECRET` is a secret. Needed whenever `VNPAY_MODE` is not `off` |
| `VNPAY_PAY_URL`, `VNPAY_API_URL` | API | VNPay payment page and merchant API (`querydr`). Default to the sandbox URLs in `sandbox` mode. **Required in `production` mode**: VNPay hands the production URLs over at merchant onboarding, the code never guesses them. Both must be `https` |
| `VNPAY_SERVER_IP` | API | Optional, default `127.0.0.1`. The server IP VNPay wants in the status query (`vnp_IpAddr`); use the API's outbound IP if VNPay registered one |
| `VNPAY_MAX_AMOUNT_VND`, `MOMO_MAX_AMOUNT_VND` | API | Optional positive whole numbers. Upper limit of one payment (defaults `999999999` and `50000000`; minimums are fixed at `5000` and `1000`). An order part outside the limits cannot be paid with that method (`PAYMENT_AMOUNT_OUT_OF_RANGE`), the buyer picks bank transfer |
| `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY` | API | MoMo credentials (test credentials from developers.momo.vn, or the production keys from the contract). `MOMO_SECRET_KEY` is a secret. Needed whenever `MOMO_MODE` is not `off` |
| `MOMO_ENDPOINT`, `MOMO_QUERY_ENDPOINT` | API | MoMo `captureWallet` create endpoint and status query endpoint. Default to the test environment in `sandbox` mode. **`MOMO_ENDPOINT` is required in `production` mode** (from the MoMo contract); `MOMO_QUERY_ENDPOINT` defaults to it with a trailing `/create` replaced by `/query`, and must be set when that is not possible. Both must be `https` |
| `PAYMENTS_DEMO_MODE` | API | Optional, default off; `true` turns on **demo payment mode** (ADR-0025). All three methods are offered with no credentials; each payment shows a QR of a link to our own confirm page, which a phone opens to confirm, and nothing is sent to SePay, VNPay or MoMo. Allowed under `APP_ENV=production`, labelled as a rehearsal on every screen. The deposit gate defaults to off (an explicit `PAYMENTS_DEPOSIT_REQUIRED` still wins). **Unset it before any real-money method is switched on.** The boot log says `online payment is in DEMO mode` |
| `PAYMENTS_PROVIDER_SYNC_EVERY_SECONDS` | API | Optional, default `120`; `0` turns it off. How often the API asks VNPay and MoMo about payments still pending (older than 2 minutes) or expired within the last hour, in case an IPN never arrived. API only: the worker holds no gateway secrets. Always off under `NODE_ENV=test` |

### Online payment (ADR-0021, ADR-0024, GH#205)

The village administration's bank account receives the money through SePay's bank-account webhook; VNPay and MoMo pay into the merchant account of their own contract. The code supports all three in production; **what is switched on is decided by the environment** and needs the owner's merchant contracts and the legal check first. Each of VNPay and MoMo has its own mode (`off`, `sandbox`, `production`); a sandbox gateway is never offered when `APP_ENV=production`.

1. **SePay.** Link the administration's bank account in SePay and add a webhook of type "Bank account transactions": URL `https://<domain>/api/v1/payments/webhooks/sepay` (it goes through the Vercel rewrite like every API call), authentication "API Key" with the value of `SEPAY_WEBHOOK_API_KEY`. The API answers `200 {"success": true}` for every authenticated call, including transfers it cannot match (no payment code, other account, wrong amount), so SePay does not retry them; those are only logged. A wrong or missing key gets `401`.
2. **Payment code.** Each payment has a unique code (`VCP` plus ten characters) that the buyer types as the transfer content. Matching needs the exact code and the exact amount; a short or long transfer leaves the payment pending and shows up in the log (`payment <code>: received X, expected Y`) and in `raw_last_event` of the payment row.
3. **Expiry.** The worker (`payment.expire-sweep`, every minute) expires pending payments: after `PAYMENT_EXPIRES_IN_HOURS` for bank transfer, after `PAYMENT_WALLET_EXPIRES_IN_MINUTES` for VNPay and MoMo, and tells the buyer. Money that still arrives for a payment expired within the last 60 minutes (wallets) or later (bank transfer), with the exact amount, settles it.
4. **Production gate.** With SePay configured (or `PAYMENTS_DEPOSIT_REQUIRED=true`) an order cannot start production until its deposit is `PAID`. Leave SePay unset and nothing changes for existing orders.
5. **Wallet callbacks.** IPN URLs are `https://<domain>/api/v1/payments/webhooks/vnpay` (GET) and `.../webhooks/momo` (POST); the browser returns to `.../payments/return/{vnpay,momo}`, which redirects to the web status page (`/vi/thanh-toan/<code>`). The IPN answers VNPay with its `RspCode` envelope (`00` ok, `01` order not found, `02` already confirmed, `04` wrong amount, `97` bad signature, `99` error) and MoMo with `204`. MoMo results `1000`, `7000` and `7002` mean "still in progress" and leave the payment pending; `9000` (authorized) counts as paid because we create 1-step payments (`autoCapture: true`).
6. **Missed IPNs.** A payment is never marked paid from the browser return itself, but the API asks the provider directly (VNPay `querydr`, MoMo `query`) when the buyer returns with a valid signature, when the buyer's status page polls a payment older than 30 s, and every `PAYMENTS_PROVIDER_SYNC_EVERY_SECONDS` for payments still pending or expired within the hour. At most one query per payment every 20 s. Each query logs `provider query <PROVIDER> ref <code>: <PAID|FAILED|PENDING|UNKNOWN>`; a settled one adds `reconciled: PAID`. A provider answer that fails its checksum is logged as a warning and ignored. A later IPN with the same transaction id is a duplicate and changes nothing.
7. **Boot log.** At start the API logs one line, `online payment methods on: SEPAY_TRANSFER, VNPAY(production), MOMO(sandbox)` (or `online payment is off`), and a warning for every problem that keeps a method off: missing credential or production URL, non-`https` URL, sandbox refused under `APP_ENV=production`, a half-filled SePay account. Check it after every deploy. Warnings never contain secret values.
8. **Simulate transfer.** Where `APP_ENV` is not `production`, an administrator sees "Simulate transfer (sandbox)" on a pending bank-transfer payment; it applies a synthetic SePay event through the same reconciliation. Production sets `APP_ENV=production` in `vcraft-shared`, which removes the button and refuses the endpoint.
9. **Secrets** (`SEPAY_WEBHOOK_API_KEY`, `VNPAY_HASH_SECRET`, `MOMO_SECRET_KEY`, `MOMO_ACCESS_KEY`) are set in the Render dashboard for `vcraft-api` only. The worker needs none of them. CI and tests use signed fake webhooks and fake provider answers and never call a gateway.
10. **Refunds are manual.** No gateway refund call exists. Return the money from the provider's merchant portal (or the bank), then use "mark refunded" on the payment in the administration with the reason.

#### Demo payment mode (ADR-0025)

For the project defense and the live demo, where no merchant contract exists. Set `PAYMENTS_DEMO_MODE=true` on `vcraft-api` (it works with `APP_ENV=production`; no payment credential is needed).

1. The buyer picks bank transfer, VNPay or MoMo and presses "Tạo mã QR thanh toán". The page shows a QR that encodes `https://<domain>/vi/thanh-toan/thu/<code>?k=<secret>`, a page of ours. It is never a VietQR or bank code.
2. The buyer scans it with a phone, presses "Xác nhận thanh toán" (or "Hủy giao dịch thử"), and the desktop page flips to paid within a few seconds (it polls every 3 s). The payment goes through the normal reconciliation, so the order, the notices and the deposit state behave as for a real payment; `raw_last_event` of the row holds `{"demo": true, "source": "demo-confirm"}` and the transaction id is `DEMO-<code>`.
3. Nothing is sent to SePay, VNPay or MoMo, even if their credentials are set, and the provider sweep skips these payments. Every method counts as "sandbox" in the method list; the amount limits stay; a demo payment expires after `PAYMENT_WALLET_EXPIRES_IN_MINUTES` whatever the method.
4. Anyone holding the QR or its link can confirm that one payment. That is accepted because no money moves. The API logs every view and confirmation with the payment code and the outcome (`DemoPayments` logger), never the secret.
5. **Switch it off** (unset `PAYMENTS_DEMO_MODE`) before turning on any real method; confirm links then answer 404 and pending demo payments just expire. The boot log shows `online payment is in DEMO mode` and a warning while it is on.

**Go-live checklist.** Do one method at a time, on `APP_ENV=production` with an `https` `APP_URL`.

- **SePay (bank transfer and VietQR).**
  1. The real village administration account is linked in SePay.
  2. In SePay's payment-code settings set the prefix `VCP`, so SePay detects our code in the transfer content (`code` in the webhook).
  3. Create the "Bank account transactions" webhook with the URL above and the API key; set the four `SEPAY_*` variables on `vcraft-api`.
  4. `APP_ENV=production` (no simulate button). Make one real small deposit end to end (pay, see it `PAID`, notices sent), then refund it by hand.
- **VNPay.**
  1. Sign the merchant contract. VNPay's onboarding mail gives the production TMN code, hash secret, payment URL and API URL. Use the URLs and keys from the onboarding mail (the amount limits, 5,000 to 999,999,999 VND, were verified in ADR-0024; `VNPAY_MAX_AMOUNT_VND` can override the upper limit).
  2. Register the IPN URL `https://<domain>/api/v1/payments/webhooks/vnpay` in the VNPay merchant portal; VNPay does not take it per request. The return URL is sent with every payment.
  3. Set `VNPAY_MODE=production`, `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_PAY_URL`, `VNPAY_API_URL` (and `VNPAY_SERVER_IP` if VNPay whitelisted one). Check the boot log shows `VNPAY(production)`.
  4. Make one real small payment (VNPay minimum is 5,000 VND), then refund it from the VNPay portal and mark it refunded.
- **MoMo.**
  1. Sign the merchant contract; MoMo gives the production partner code, access key, secret key and endpoints. Use the URLs and keys from the onboarding mail (the query signature, `resultCode` list and amount limits, 1,000 to 50,000,000 VND, were verified in ADR-0024; `MOMO_MAX_AMOUNT_VND` can override the upper limit).
  2. Set `MOMO_MODE=production`, `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_ENDPOINT` (and `MOMO_QUERY_ENDPOINT` if it is not the same path with `/query`). The IPN URL is sent with every payment. Check the boot log shows `MOMO(production)`.
  3. Make one real small payment (MoMo minimum is 1,000 VND), then refund it from the MoMo portal and mark it refunded.
- **After every go-live.** The boot log has no warning left for that method; trigger a payment, close the browser tab before returning, and confirm within a few minutes that the log shows the provider query settling it if the IPN did not.

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

Biến không cần đặt tay: `PORT` (Render tự đặt, API đọc), `REDIS_URL` (lấy từ Key Value qua Blueprint), `TRUST_PROXY=1`, `NODE_VERSION=24`, các giá trị không bí mật trong nhóm `vcraft-shared`. **Không** đặt `DEMO_*` trên Render (xem `.env.example`).

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
   | `INTERNAL_API_KEY` | Shared secret (GH#362), the same value as on `vcraft-api`. Lets `/q/<code>` forward the visitor's IP and User-Agent so the API counts repeat scans once per 30 minutes. Unset: every scan is counted, without dedupe. Read at runtime, no redeploy needed |
   | `REVALIDATE_SECRET` | ADR-0027. Bearer secret of `POST /api/revalidate` (`openssl rand -hex 32`), the same value as on `vcraft-worker`. Unset: the route answers 503 and cached public pages only expire after 60 s. Read at runtime, no redeploy needed once the route is deployed |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Khóa `sb_publishable_...` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key Turnstile (nếu dùng) |
   | `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_CENTER` | Như `.env.example` (tùy chọn) |
| `NEXT_PUBLIC_MAP_GLYPHS_URL` | Optional. Label-font (glyphs) URL template for the offline map style; default is the Protomaps glyph host. It is added to the CSP allow-list. Build-time |
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

### Auth audit follow-up (GH#238, Beads vCRAFT-b2q)

The web and API require new passwords to have at least 10 characters, with ASCII uppercase and lowercase letters and a digit. `supabase/config.toml` records `minimum_password_length = 10`, `password_requirements = "lower_upper_letters_digits"` and `jwt_expiry = 900`. These repository values do not update hosted Auth settings. Existing passwords remain usable for sign-in.

An owner with Cloudflare, Vercel, Supabase and SMTP access must apply the hosted settings tracked in `vCRAFT-b2q.2`:

1. Record sanitized current Auth settings, then update only the intended settings. Do not push the whole local config, which contains localhost URLs and disables CAPTCHA for local development.
2. Deploy the matching Turnstile site key on Vercel before enabling server enforcement with its secret in Supabase, as described in section 6.2. Use production keys and the production hostname.
3. Set the hosted minimum password length to 10 and require uppercase, lowercase and digits. Enable leaked-password protection if the current provider plan supports it. If unavailable, record the plan limitation and an explicit maintainer decision in `vCRAFT-b2q.2`; the client policy does not check breached-password lists.
4. Set access-token lifetime to 900 seconds. Keep refresh-token rotation and verify that an existing session refreshes successfully.
5. Configure Supabase custom SMTP with a verified sender and confirm delivery of verification and recovery messages. Worker SMTP configuration does not configure Supabase Auth mail.
6. With an owner-controlled test account, verify that missing or invalid CAPTCHA tokens fail at Supabase, valid tokens permit the auth flows, weak passwords fail for sign-up and password updates, and `exp - iat` equals 900 for a fresh access token. Record only the lifetime, never the token. Check the three public auth pages in a real browser at 360 px and 1440 px.

Password recovery uses the same generic UI outcome for success and quota errors, including HTTP 429. The browser still calls Supabase `/auth/v1/recover` directly, so a caller can inspect the provider status and error code. Custom SMTP reduces quota exhaustion but does not prove that the provider prevents account enumeration. Compare direct provider responses for existing and unknown owner-controlled addresses after configuration. If responses still differ, keep `vCRAFT-b2q.2` and the parent audit open for a provider mitigation or an architecture decision. UI masking alone does not satisfy that network-level requirement.

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

### 7.1 Cloudflare in front of the API host (owner-only)

`vcraft-api.onrender.com` can sit behind a Cloudflare proxy that Render controls. Its Bot Fight or rate rules answer a burst of requests (a few dozen from one IP, such as an exam room behind one NAT, or the Vercel servers calling `/me` on every signed-in page) with an HTML "Just a moment..." challenge, `429` or `503`, even for `/api/v1/health`. Those answers are not RFC 9457 and the web app cannot solve a challenge. The app now retries once and shows a retryable "session unavailable" state instead of an HTTP 500, but the edge rule is the real cause and only the account owner can change it:

- In the Cloudflare dashboard for the API host, relax or skip Bot Fight Mode, Super Bot Fight Mode and any rate-limiting rule for `/api/v1/*` (a WAF custom rule with action *Skip* on `starts_with(http.request.uri.path, "/api/v1/")` is enough), or rely on the application limiter above, which answers in problem+json with `Retry-After`.
- Challenge pages must never be served to the Vercel server-side fetches (`API_INTERNAL_URL`): they run without a browser and cannot pass a challenge. If the host is not under your control, put the API on a domain you own behind your own Cloudflare zone and add the skip rule there.
- Check: `for i in $(seq 60); do curl -s -o /dev/null -w '%{http_code} %{content_type}
' https://<URL Render>/api/v1/health; done` should print only `200 application/json`.

## 8. Kiểm tra sau triển khai

```bash
curl -fsS https://<URL Render>/api/v1/health                  # {"status":"ok",...}
curl -fsS https://<domain>/api/v1/health                      # cùng kết quả: rewrite hoạt động
curl -sI https://<domain>/q/DF6P3WZE                          # 308, Location: /vi/truy-xuat/DF6P3WZE
curl -sI https://<domain>/vi | grep -i strict-transport       # có HSTS
```

Kiểm tay một lần: đăng nhập vai hộ sản xuất và tải lên một ảnh ~14 MB (gần giới hạn 15 MB) qua Studio, hoặc gọi endpoint media của API qua `https://<domain>/api/v1/...` nếu chưa có màn hình, để chắc rewrite của Vercel không chặn body lớn (ADR-16); nếu bị chặn, xem phương án trong ADR-16.

**Media upload limit (GH#252).** The API accepts images up to 15 MiB (`MEDIA_MAX_BYTES`) and HEIC/HEIF originals. The owner must raise the production Storage limit to 15 MiB: Supabase Dashboard → Storage → Settings (global file size limit) and, for each of the buckets `vcraft-media` and `vcraft-private`, Edit bucket → *Restrict file upload size* = 15 MB; also add `image/heic` and `image/heif` to the allowed MIME types of `vcraft-private`. `supabase/migrations/20261108151000_media_limits_15mib.sql` does the same for a local or freshly linked project. Until then, files between 10 and 15 MiB are accepted by the API but rejected by Storage.

Mở `https://<domain>/vi/tin-tuc`: phải có bài (API gọi được từ server Next). Quét thử QR bằng điện thoại ở mạng 4G.

## 9. Triển khai tiếp theo, rollback, sự cố

- **Deploy:** merging to `main` runs CI; when it is green, `.github/workflows/deploy.yml` deploys the API to Render (migrations included), then the web to Vercel, then runs smoke checks (§12). Neither platform deploys `main` on its own once the setup in §12 is done.

- **Release checklist, public read contract changes:** when a release changes the shape of a public API response (a new or renamed field in `/news`, `/products`, `/map` and so on), purge the Vercel Data Cache after the web deploy (`vercel cache purge --type data`). Cached reads that fail schema validation are refetched uncached by the web app (GH#395), but purging removes any stale entry at once.

- **Release note, new image width (GH#530):** the worker now also makes a 960w variant (320/640/960/1280/2048). New uploads get it automatically. Existing photos only get the 960w file once reprocessed; until then their `srcset` stays valid with the old widths. For demo photos the owner runs `APP_ENV=demo pnpm demo:media -- --force` against production storage (reprocesses READY files; see demo README §1B). There is no reprocess job for user-uploaded media, so old non-demo uploads keep their current variants.

- **Rollback web:** Vercel → Deployments → chọn bản cũ → *Promote to Production*. **Rollback API:** Render → *Deploys* → *Rollback*. Rollback **không** hoàn tác migration.
- Đổi biến môi trường Render tự khởi động lại service; đổi biến Vercel cần Redeploy (biến chốt lúc build).
- A suspended household or a withdrawn product is still visible on the site: the web caches public pages for 60 s and drops them when the worker calls `/api/revalidate` (ADR-0027). Check the worker log for "web revalidation off" (env missing) and the failed outbox count for `exhibition.changed` events (wrong URL or secret: the web answers 401/503). To purge by hand: `curl -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" -H 'content-type: application/json' -d '{"tags":["exhibition"]}' https://<domain>/api/revalidate`. A retired item (API 404) stays visible until that purge, so do it after fixing a failed event.
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

### Daily credential check

`.github/workflows/deploy-credentials.yml` (`Deploy credentials`) runs every day at 01:17 UTC, and on demand with `gh workflow run deploy-credentials.yml`. It uses the same `production` environment secrets and variables as `deploy.yml` and is skipped unless `CD_ENABLED` is `true`. `scripts/ci/check-deploy-credentials.sh` makes one read-only request per credential and expects HTTP 200: `GET /v1/services/$RENDER_SERVICE_ID` (and `$RENDER_WORKER_SERVICE_ID` when set) with `RENDER_API_KEY`, and `GET /v9/projects/$VERCEL_PROJECT_ID?teamId=$VERCEL_ORG_ID` with `VERCEL_TOKEN`. The point is to learn that a key was revoked or expired (HTTP 401) days before the next deploy, instead of during it. A failed run sends GitHub's usual failed-workflow notification.

Each failure is an `::error::` annotation naming the credential and the HTTP status. 401 or 403 means the key or token was rejected; 404 means the service or project id variable is wrong. Network errors and 5xx are retried a few times before they count as a failure. The script never prints secret values, and its tests run with `pnpm test:scripts`.

Rotate a rejected credential, then re-run the check:

```bash
gh secret set RENDER_API_KEY --env production    # new key: Render → Account Settings → API Keys
gh secret set VERCEL_TOKEN --env production      # new token: Vercel → Account Settings → Tokens
gh workflow run deploy-credentials.yml
```

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
