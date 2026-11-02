# Demo vấn đáp: dữ liệu mẫu, kịch bản QR → biên nhận, kiểm tra trước giờ thi

> Dành cho nhóm 3 người chuẩn bị buổi bảo vệ đầu tháng 1/2027 (GH#14, vCRAFT-83g mục demo). Mọi lệnh chạy ở thư mục gốc repo.
> Kịch bản phút-theo-phút nằm ở [PLAN §6](../PLAN.md#6-kịch-bản-demo-vấn-đáp); tài liệu này lo **dữ liệu**, **khôi phục**, **kiểm tra** và **phương án dự phòng**.

## 0. Hiện trạng thật (đọc trước)

- **Đã có và đã chạy thử:** seeder dữ liệu mẫu, `pnpm demo:reset` có cổng chặn, `pnpm demo:verify`, bộ kiểm tra `demo-seed.integration.test.ts` (chạy qua API thật trên cả PostgreSQL và MySQL), script tạo tài khoản Supabase Auth, script đo ảnh 12 MB, script đua hai tab.
- **Tin tức đã có:** entity `News`, API công khai `GET /api/v1/news` (+ `/news/:slug`) và trang `/vi/tin-tuc` (EN: `/en/news`). Trang này đọc API thật phía server qua `API_INTERNAL_URL` (xem `.env.example`; API không gọi được thì trang hiện thông báo, không lỗi). Seed nạp 18 tin.
- **Ảnh có giấy phép đã nằm trong CSDL và Supabase Storage** (GH#26, §1B): `pnpm demo:media` tải ảnh minh hoạ lên `vcraft-media`, giấy tờ mẫu lên `vcraft-private` và nối vào seed kèm ghi công (`media_link`, mô tả vi/en). `demo:media` cũng đặt `coverUrl`/`coverAlt`/`coverAltEn` của 2 sản phẩm (`BT7K2QXM`, `84PZKVJU`) và `coverUrl` của 4 hộ về URL trong bucket nên API công khai (GH#47) trả ảnh Supabase. Nhật ký không còn ảnh nào (xem quy tắc bên dưới).
- **Trang công khai của `apps/web` đọc API thật** (trang chủ, sản phẩm, nghệ nhân, truy xuất, bản đồ, tin tức). `apps/web/src/lib/demo/data.ts` chỉ còn phục vụ các màn yêu cầu báo giá và điều phối đang dùng dữ liệu minh họa.
- Một số bước chưa có màn hình (duyệt hộ của Admin, xuất bản của hộ): kịch bản e2e gọi thẳng API bằng đúng phiên đã đăng nhập và ghi chú ở từng bước.
- **Triển khai production (GH#39):** web trên Vercel, API + worker + Redis trên Render, CSDL/Auth/Storage ở Supabase ([ADR-16](../adr/0016-deploy-vercel-render.md)); cấu hình nằm trong repo (`render.yaml`, `apps/web/vercel.json`, `next.config.ts`), các bước tạo project và dán biến môi trường ở [docs/deploy.md](../deploy.md). Đã chạy thử local: build production và khởi động API/worker bằng đúng lệnh start, rewrite `/api/*`. **Chưa** chạy trên Vercel/Render thật vì cần tài khoản của nhóm.
- **Chưa kiểm chứng được ở máy phát triển:** chạy trên URL đã triển khai, Lighthouse, tạo người dùng trên Supabase Auth thật, dựng Supabase cục bộ. Các mục này nằm trong checklist §7 để làm một lần trước ngày thi.

## 1. Dữ liệu mẫu

Nạp bằng entity MikroORM, chạy giống hệt trên PostgreSQL và MySQL (`packages/database/src/seeders/demo/`). Số lượng đo được sau khi nạp:

| Thành phần | Số lượng | Ghi chú |
| --- | --- | --- |
| Tài khoản (`app_user`) | 23 | 4 cố định (§2) + 19 người đại diện hộ không đăng nhập được |
| Hộ sản xuất | 21 | 20 `APPROVED` + 1 `PENDING_REVIEW` ("Gốm Bảo Châu"); tên và người hư cấu, mô tả có nhãn `[Dữ liệu mẫu]` |
| Nghệ nhân / xưởng | 53 / 35 | Xưởng có tọa độ quanh Bát Tràng (20.9758, 105.9139) |
| Sản phẩm | 222 | 218 `PUBLISHED`; 4 `DRAFT` (2 của hộ household để xuất bản trực tiếp, 2 của hộ chờ duyệt) |
| Mốc nhật ký | 1.295 | Mỗi sản phẩm 4–7 mốc, chuỗi băm SHA-256 sinh bằng `sealChain` của `@vcraft/domain`, kiểm lại bằng `verifyChain`; công đoạn bị nhảy đều có lý do bỏ qua |
| Yêu cầu báo giá | 12 | Đủ 8 trạng thái RFQ (bảng bên dưới) |
| Đề xuất tham gia / chào giá / phân bổ | 24 / 7 / 12 | Chào giá dựng bằng `assembleCooperativeQuotation` nên đúng luật tổng và năng lực |
| Tin tức | 18 | Đều `PUBLISHED`: 6 tin chung của làng + 12 tin của hộ `APPROVED`, 2 tin ghim; nội dung có nhãn `[Dữ liệu mẫu]`; ngày đăng tính từ mốc đóng băng |

Ảnh: seed (`demo:reset`) để trống `images: []` ở nhật ký và không có ảnh bìa; ảnh có giấy phép được nối vào bằng `pnpm demo:media` (§1B). Chạy `demo:reset` mà không chạy `demo:media` thì `demo:verify` báo đỏ ở nhóm kiểm ảnh.

### Cái gì cố định, cái gì tính theo thời điểm nạp

- **Cố định (đóng băng):** mọi UUID (UUID v5 xác định), tên, mã truy xuất, nhật ký và dấu băm, ngày của hộ/sản phẩm/nhật ký (neo `2026-09-01`), số lượng, đơn giá. Reset bao nhiêu lần cũng ra đúng dữ liệu đó.
- **Tương đối theo `now` lúc nạp:** `biddingClosesAt`, `requiredBy`, `completionDate`, `createdAt` của yêu cầu, đề xuất, chào giá, phân bổ. Lý do: hạn chào giá phải còn trong tương lai khi thi (luật T1/T2 và `open()` của API). Mặc định yêu cầu mở có hạn chào giá **+30 ngày**, hạn giao **+75 ngày**. `pnpm demo:verify` báo đỏ nếu hạn còn dưới 3 ngày. **Luôn reset trong 24 giờ trước buổi thi.**

### Yêu cầu báo giá và vai trò của từng yêu cầu

| Khóa | Trạng thái | Dùng cho bước | UUID |
| --- | --- | --- | --- |
| `draft` | DRAFT | (nền) | `d3a10000-0000-4000-8000-000000000101` |
| `expired` | EXPIRED | (nền) | `d3a10000-0000-4000-8000-000000000102` |
| `sentPlain` | SENT | (nền) | `d3a10000-0000-4000-8000-000000000103` |
| `sentOptIn` | SENT, nhờ BQL, chưa ai nhận | Admin bấm **Nhận điều phối** | `d3a10000-0000-4000-8000-000000000104` |
| `sentCoordinated` | SENT, admin đã nhận | Hộ household được mời, chưa đề xuất: **Gửi đề xuất** | `d3a10000-0000-4000-8000-000000000105` |
| `biddingToAccept` | BIDDING, 1 chào giá chia 4 hộ | Buyer xem và **chốt** | `d3a10000-0000-4000-8000-000000000106` |
| `biddingReplaced` | BIDDING, chào giá cũ đã bị thay | (nền, minh họa lịch sử) | `d3a10000-0000-4000-8000-000000000107` |
| `acceptedConfirm` | ACCEPTED, 3 hộ đã xác nhận, phần của household còn chờ | Hộ **Xác nhận**, rồi Admin **Bắt đầu sản xuất** | `d3a10000-0000-4000-8000-000000000108` |
| `acceptedFresh` | ACCEPTED, 2 hộ chờ xác nhận | (nền) | `d3a10000-0000-4000-8000-000000000109` |
| `inProduction` | IN_PRODUCTION, **đơn chia đúng 4 hộ** | Hộ báo tiến độ 350 → 500/500, Buyer **nhận hàng** | `d3a10000-0000-4000-8000-000000000110` |
| `delivered` | DELIVERED | (nền) | `d3a10000-0000-4000-8000-000000000111` |
| `cancelled` | CANCELLED | (nền) | `d3a10000-0000-4000-8000-000000000112` |

Vì sao hai đơn riêng cho "xác nhận" và "tiến độ → nhận hàng": nhận hàng cần **mọi** hộ `DONE`, mà chỉ có một tài khoản hộ đăng nhập được. Đơn `inProduction` có sẵn 3 hộ `DONE` (Minh Hải 600, Lam Ngọc 500, Hạnh Thủy 400) và hộ household (Lò Đức Phát) đang 350/500; báo đủ 500 là Buyer nhận hàng được. Đơn `acceptedConfirm` chỉ đi tới "Đang sản xuất" vì ba hộ còn lại không có người thao tác.

### Chiếc cốc có QR

Sản phẩm cố định **`DF6P3WZE`** ("Cốc men trắng quai tròn", lô 300 cái, hộ Lò Đức Phát, 7 mốc, đã xuất bản). **QR dán lên cốc thật phải mã hóa đường dẫn ổn định `https://<DOMAIN>/q/DF6P3WZE`** (mã không đổi khi đổi tên/slug; `/q/<mã>` chuyển 308 sang trang truy xuất theo ngôn ngữ). In 3 cỡ, thử quét trên iOS và Android (PLAN §9). Mã `BT7K2QXM` (bình hút lộc, 7 mốc) và `HX2M9KQD` (bát vẽ sen men trong) cũng có sẵn làm vật thay thế.

## 1A. Dựng dữ liệu trên một project Supabase mới (thứ tự lệnh)

Làm một lần cho mỗi project (kết quả của GH#26 trên project hiện tại). Mọi lệnh chạy ở gốc repo; các script tự đọc `.env` ở gốc.

**Điều kiện ở Dashboard:** Storage có sẵn hai bucket `vcraft-media` (công khai) và `vcraft-private` (riêng tư, **không** bật public), mỗi bucket giới hạn 10 MB; đã tạo S3 access key (Storage → S3 Configuration).

**Khóa `.env` cần có** (mẫu đầy đủ ở `.env.example`; không commit):

| Nhóm | Khóa | Dùng cho |
| --- | --- | --- |
| CSDL | `DB_DRIVER=postgresql`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (Session pooler) | `db:migrate`, `demo:reset`, `demo:media`, `demo:verify` |
| TLS | `DB_SSL=true` và **một** trong `DB_SSL_CA_FILE=../../infra/certs/supabase-root-2021.crt` (đã commit, chứng chỉ công khai) hoặc `DB_SSL_CA` (nội dung PEM, xuống dòng viết `\n`) | mọi lệnh nói chuyện với CSDL; pooler Supabase dùng CA riêng nên thiếu cái này sẽ lỗi `self-signed certificate in certificate chain` |
| Storage | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_FORCE_PATH_STYLE=true`, `S3_BUCKET_PUBLIC=vcraft-media`, `S3_BUCKET_PRIVATE=vcraft-private`, `MEDIA_PUBLIC_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/vcraft-media` | `demo:media` |
| Auth | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DEMO_ADMIN_PASSWORD`, `DEMO_BUYER_PASSWORD`, `DEMO_HOUSEHOLD_PASSWORD`, `DEMO_PENDING_PASSWORD` | `demo:auth` |
| Cổng chặn | `APP_ENV=demo`, `DEMO_RESET_CONFIRM=<DB_HOST>:<DB_PORT>/<DB_NAME>` (gõ literal, đừng để dấu `$` trong `.env`), `NODE_ENV=production` khi reset | `demo:reset` (`demo:media` chỉ cần `APP_ENV=demo`) |

`DB_SSL_CA_FILE` là đường dẫn tương đối tính từ thư mục chạy lệnh; `packages/database`, `apps/worker` và `apps/api` đều cách gốc repo hai cấp nên cùng một giá trị `../../infra/certs/supabase-root-2021.crt` đúng cho cả ba. Dự án Supabase khác hoặc CA được đổi: tải lại ở Dashboard → Database → Settings → SSL Configuration và thay file.

**Thứ tự lệnh (chạy từ project trống):**

```bash
pnpm install
pnpm db:migrate                                  # 1. schema + RLS: 11 migration PostgreSQL (… news, media_link)
APP_ENV=demo NODE_ENV=production pnpm demo:reset # 2. xóa bảng nghiệp vụ và nạp seed (cần DEMO_RESET_CONFIRM trong .env)
APP_ENV=demo pnpm demo:media                     # 3. ảnh minh hoạ -> vcraft-media, giấy tờ mẫu -> vcraft-private, nối vào seed
pnpm demo:auth                                   # 4. bốn tài khoản Supabase Auth, id khớp app_user
APP_ENV=demo pnpm demo:verify                    # 5. mọi dòng PASS (gồm HEAD tới URL ảnh công khai); thêm -- --offline để bỏ HEAD
pnpm demo:auth -- --check
```

**Sau mỗi lần `demo:reset` phải chạy lại `pnpm demo:media`** (bước 3): reset xóa `media_asset`, `media_link` và dấu băm nhật ký có ảnh, nhưng không đụng tệp trong bucket; `demo:media` dựng lại đúng các dòng đó (cùng id, cùng key, ghi đè tệp cũ) nên chạy lại được bao nhiêu lần cũng ra cùng kết quả. Thứ tự `demo:reset` → `demo:media` → `demo:verify` là thứ tự chuẩn của buổi sáng thi (§7 mục 15).

## 1B. Ảnh có giấy phép và giấy tờ mẫu

**Cách làm (và vì sao):** `pnpm demo:media` đi đúng đường của API: bản gốc vào bucket riêng tư `originals/<chủ>/<id>`, dòng `media_asset` `PROCESSING`, rồi chính `processMediaAsset` của worker xóa metadata, sinh AVIF/WebP 320/640/1280 vào bucket công khai, đặt `READY`. Ảnh đầu vào là các ảnh Wikimedia Commons (CC0 / CC BY / CC BY-SA) đã cắt đúng tỉ lệ khung và đã nằm trong `apps/web/public/images/demo`, nên không cần mạng ngoài ngoài Supabase. Ghi công (tác giả, giấy phép, trang nguồn) và mô tả (`alt`) nằm trên chính dòng `media_asset` (`credit`, `alt_text`). Cân nhắc và phương án đã loại: xem mô tả PR GH#26.

| Gắn vào | Cách | Số lượng |
| --- | --- | --- |
| Sản phẩm (`BT7K2QXM`, `84PZKVJU`) | `media_link` (`PRODUCT`, `COVER`) | 2 ảnh bìa |
| Hộ (4 hộ có ảnh: Minh Hải, Lam Ngọc, Lò Đức Phát, Hạnh Thủy) | `media_link` (`HOUSEHOLD`, `PORTRAIT` / `BANNER` / `GALLERY` kèm `caption`) | 19 liên kết |
| Tin (ủ đất sét, lớp vuốt gốm) | `media_link` (`NEWS`, `COVER`) | 2 ảnh bìa |
| Mốc nhật ký (mọi sản phẩm) | không gắn ảnh: `journal_entry.images` luôn `[]`, `mediaChecksums` rỗng trong chuỗi băm (một ảnh chung của công đoạn không phải ảnh của món đồ) | 0 |
| Hộ chờ duyệt Gốm Bảo Châu | `media_asset` mục đích `CERTIFICATE`, riêng tư, chủ là người đại diện; `media_link` (`HOUSEHOLD`, `DOCUMENT`) | 3 giấy tờ mẫu |

**Photo rules (vCRAFT-83g.35).** An image may be attached to an object only if it shows that kind of object with the attributes in its name and description; the demo descriptions say "made by household X in Bát Tràng", so a photo of an object made elsewhere fails. Hence: no generic stage photos on products or journal entries, no cover for `HX2M9KQD` (a museum bowl that Commons does not call Bát Tràng ware) and `DF6P3WZE` (a New Zealand trial cup), no night-market photo on the night-market news, and no photo that Commons places outside Bát Tràng or attributes to another ware (a kiln in Châu Thành, Đồng Tháp; the Chu Đậu pieces of Hải Dương) in a Bát Tràng household's gallery. Where the context says Bát Tràng, Commons must confirm it: Gốm Minh Hải's banner (kilns whose place Commons does not state) was retired too, so that household shows a workshop illustration on cards and the map, and the home hero is the Commons-confirmed Bát Tràng vase `binh-men-lam-xam`; the firing photo of "A day in Bát Tràng" is a Bát Tràng-confirmed sagger photo. Those products and stories show a preset illustration of their kind (bowl, cup, vase, jar, plate, tea set, incense burner, generic; labelled as an illustration, not a photo), chosen in the web app from the product category and name. The mapping lives in `packages/database/src/seeders/demo/photo-manifest.ts`, which is now maintained by hand (the old `export-manifest.mjs` is retired); every link carries a Vietnamese `alt` and an English `altEn` (stored as `media_link.alt_en`). `RETIRED_DEMO_PHOTO_IDS` lists photos that must no longer exist: `demo:media` deletes their rows, links and storage objects. The second product with its own photo (vCRAFT-83g.48) is `84PZKVJU`, an "Ống đựng bút vẽ lam" of Gốm Đại Phong: Commons photo `ong-gom-lam-may` (CC0, Daderot), a Bát Tràng ceramic cylinder with a cobalt-blue cloud pattern in the Vietnam National Museum of Fine Arts; its alt text describes only what is visible, because the museum record calls the object a "tube for papers", not a pen holder. 214 products have no photo of their own and show the preset illustration.

**Ảnh bìa đang dùng ngay:** `demo:media` ghi đè `product.cover_url`/`cover_alt`/`cover_alt_en` (2 sản phẩm) và `household.cover_url` (ảnh bìa 4 hộ) bằng URL biến thể WebP 1280 trong bucket; API công khai của GH#47 trả đúng hai cột này nên không cần sửa API. **The API reads everything else (galleries, portraits, news covers, credits) from `media_link` (GH#54):** household/product/news images = `media_link` by (`target_type`, `target_id`, `role`, `position`) → `media_asset.variants` (URL = `MEDIA_PUBLIC_BASE_URL` + `key`), `credit`, `alt_text` (`media_link.alt_text` takes priority). `GET /households/{slug}` returns `portrait`, `banner`, `gallery`; `GET /news` and `GET /news/{slug}` return `cover`; `GET /products/{slug}` and `GET /trace/{code}` return `coverCredit`. Journal entry images: `journal_entry.images[].url` is already a public URL; `credit` is looked up by `images[].sha256` = `media_asset.sha256`. `DOCUMENT` files, private files and files that are not `READY` never reach the public API.

**Giấy tờ mẫu:** ba ảnh vẽ cục bộ bằng `scripts/demo-photos/make-specimen-docs.mjs` (căn cước, xác nhận cư trú, ảnh xưởng), toàn dữ liệu giả và đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ"; không bao giờ dùng giấy tờ thật. Chỉ nằm ở `vcraft-private`: Admin đọc qua `GET /media/{id}/read-url` (URL ký 5 phút), người khác bị từ chối, không có biến thể công khai.

```bash
APP_ENV=demo pnpm demo:media                 # tải lên + nối vào seed; chạy lại được
APP_ENV=demo pnpm demo:media -- --force      # làm lại cả tệp đã READY
APP_ENV=demo pnpm demo:media -- --check      # chỉ đọc lại bucket, so với CSDL (nội dung và kích thước)
APP_ENV=demo pnpm demo:media -- --dry-run    # chỉ tính việc sẽ làm (đặt lại mô tả, liên kết, ảnh bìa, nhật ký, gỡ ảnh), không ghi gì
# Staged rollout on shared data: limit the steps and the products touched, apply, check, then run without limits.
APP_ENV=demo pnpm demo:media -- --only=journal --journal-products=FWMHFYFK,DF6P3WZE
APP_ENV=demo pnpm demo:media -- --only=media,links,covers,prune   # steps: media, links, covers, journal, prune
# A second full run reports `changes: 0` and writes nothing.
```

## 2. Tài khoản cố định và cách khôi phục

`app_user.id` **phải bằng** `sub` của Supabase Auth, nên bốn tài khoản dùng UUID cố định ở cả hai nơi (`packages/database/src/seeders/demo/accounts.ts`). `demo:reset` ghi bảng `app_user`; `demo:auth` ghi Supabase Auth.

| Khóa | Vai trò | Email | UUID | Biến mật khẩu |
| --- | --- | --- | --- | --- |
| `admin` | ADMIN | `demo.admin@example.com` | `d3a10000-0000-4000-8000-000000000001` | `DEMO_ADMIN_PASSWORD` |
| `buyer` | BUYER | `demo.buyer@example.com` | `d3a10000-0000-4000-8000-000000000002` | `DEMO_BUYER_PASSWORD` |
| `household` | HOUSEHOLD (Lò Đức Phát, đã duyệt) | `demo.household@example.com` | `d3a10000-0000-4000-8000-000000000003` | `DEMO_HOUSEHOLD_PASSWORD` |
| `pending` | HOUSEHOLD (Gốm Bảo Châu, chờ duyệt) | `demo.pending@example.com` | `d3a10000-0000-4000-8000-000000000004` | `DEMO_PENDING_PASSWORD` |

Mật khẩu **không** nằm trong mã; đặt trong `.env` của máy demo (không commit) hoặc kho bí mật của nhóm.

```bash
# Trong .env của môi trường demo: APP_ENV=demo, SUPABASE_URL, SUPABASE_SECRET_KEY, bốn DEMO_*_PASSWORD
pnpm demo:auth                 # tạo hoặc cập nhật 4 người dùng (id cố định, email đã xác nhận); chạy lại được
pnpm demo:auth -- --check      # chỉ kiểm tra, không ghi
```

`auth.admin.createUser` nhận thuộc tính `id` (đã xác nhận trong kiểu `AdminUserAttributes` của `@supabase/auth-js`), nên không cần cách vòng. Nếu một email demo đã gắn với người dùng id khác (vd. đã đăng ký tay), script dừng và hướng dẫn xóa người dùng đó ở Dashboard → Authentication rồi chạy lại. Nếu tài khoản bị khóa hay đổi vai trò khi tập dượt thì `demo:reset` đưa `app_user` về đúng vai trò.

Sau khi tạo: đăng nhập từng tài khoản **một lần** trên đúng thiết bị thi (Buyer: Chrome, Hộ: điện thoại, Admin: Edge) và giữ phiên. Hạn token của Supabase là 15 phút nhưng trình duyệt tự làm mới bằng refresh token; kiểm tra phiên còn sống sáng hôm thi.

### Đăng nhập trên web và email xác thực tiếng Việt (GH#27)

Web đã có trang đăng nhập thật, nên **không cần chèn cookie** nữa: `/vi/dang-nhap` (EN `/en/login`), đăng ký khách `/vi/dang-ky`, quên mật khẩu `/vi/quen-mat-khau` → `/vi/dat-lai-mat-khau`, wizard hộ `/vi/dang-ky-nghe-nhan`, lời mời của Ban quản lý `/vi/chap-nhan-loi-moi`. Sau đăng nhập: Khách về trang chủ, người đại diện hộ vào `/vi/studio/ho-so`, Admin vào điều phối. Hộ chờ duyệt (`demo.pending`) chỉ xem được trang trạng thái hồ sơ; vào khu sai vai trò nhận trang 403. Kịch bản e2e `specs/buyer/sign-in.spec.ts` đăng nhập `demo.buyer` qua form thật (cần `E2E_BASE_URL` qua Caddy và `DEMO_BUYER_PASSWORD`).

Mẫu email Supabase Auth bằng tiếng Việt, mang thương hiệu vCraft, nằm ở `supabase/templates/*.html` (cấu hình tham chiếu ở `supabase/config.toml`). Repo **không** gọi API quản trị Supabase; áp lên project thật bằng tay một lần:

1. Dashboard → **Authentication → URL Configuration**: đặt **Site URL** là origin công khai của web (vd. `https://<DOMAIN>`; dev: `http://localhost:8080`) và thêm `https://<DOMAIN>/**` vào **Redirect URLs**. Mẫu thư dựng liên kết từ `{{ .SiteURL }}`, nên sai Site URL là liên kết trong thư sai.
2. **Authentication → Emails → Templates**, với từng mẫu dán nội dung tệp tương ứng và đặt tiêu đề:

   | Mẫu trong Dashboard | Tệp | Tiêu đề |
   | --- | --- | --- |
   | Confirm sign up | `confirmation.html` | Xác minh email để vào vCraft |
   | Invite user | `invite.html` | Ban quản lý mời hộ của bạn vào vCraft |
   | Reset password | `recovery.html` | Đặt lại mật khẩu vCraft |
   | Change email address | `email_change.html` | Xác nhận đổi email vCraft |
   | Reauthentication | `reauthentication.html` | Mã xác nhận vCraft |

3. **Authentication → Sign In / Providers → Email**: bật **Confirm email** (chưa xác minh thì chưa đăng nhập được, FR-AUTH-01); **Authentication → Policies** (hoặc Attack Protection): độ dài mật khẩu tối thiểu 8, yêu cầu chữ và số, bật chặn mật khẩu bị lộ nếu gói cho phép (khớp luật ở form web); **Sessions**: access token 900 giây, bật xoay vòng refresh token.
4. Gói Free của Supabase giới hạn số thư/giờ khi dùng SMTP mặc định: cấu hình SMTP riêng (đã nêu ở rủi ro Sprint 0) trước ngày thi.
5. Thử: đăng ký một email thật ở `/vi/dang-ky`, kiểm tra thư (tiếng Việt, nút "Xác minh email" về `/auth/confirm`), rồi đăng nhập. Thử quên mật khẩu và thư mời (Dashboard → Authentication → Users → Invite user: liên kết mở `/vi/chap-nhan-loi-moi`, dùng được đúng một lần).

Thay cho dán tay, có thể `pnpm exec supabase link --project-ref <ref>` rồi `pnpm exec supabase config push`, **sau khi** đọc kỹ phần chênh lệch (`supabase config push` ghi đè các mục auth trong `config.toml` lên project, gồm Site URL, độ dài mật khẩu và thời hạn token); đổi `site_url` trong `supabase/config.toml` sang domain thật trước. Đây là cách chưa diễn tập.

Liên kết trong thư dùng `token_hash` (không dùng PKCE), nên bấm ở thiết bị khác vẫn được. Với quên mật khẩu và lời mời, mã chỉ bị tiêu thụ khi người dùng bấm lưu mật khẩu mới (không phải lúc mở trang), nên trình quét liên kết của hộp thư không làm hỏng liên kết.

## 3. Reset dữ liệu và cổng chặn

```bash
# Trên máy/môi trường demo, .env có APP_ENV=demo, DB_* của CSDL demo
export DEMO_RESET_CONFIRM="<DB_HOST>:<DB_PORT>/<DB_NAME>"     # gõ lại đích danh CSDL sắp bị xóa
NODE_ENV=production pnpm demo:reset
pnpm demo:media                                               # nối lại ảnh và giấy tờ mẫu (APP_ENV=demo; xem §1B)
pnpm demo:verify                                              # kiểm dữ liệu còn nguyên (chỉ đọc)
```

`demo:reset` xóa **mọi** bảng nghiệp vụ (kể cả bản ghi do tập dượt, hộp thư, outbox, `media_asset`) theo thứ tự con trước cha rồi nạp lại, trong một giao dịch (lỗi giữa chừng thì không mất gì). Không đụng bảng migration, schema `auth`/`storage` của Supabase hay tệp trong bucket: vì vậy sau reset phải chạy `pnpm demo:media` để dựng lại `media_asset`, `media_link` và ảnh của nhật ký (chạy lại được, §1B).

**Cổng chặn** (hàm thuần `evaluateDemoResetGuard`, có unit test; chạy **trước** khi mở kết nối). Phải thỏa đồng thời:

1. `APP_ENV=demo` (dev, production, để trống đều bị từ chối);
2. `NODE_ENV` không phải `development` (vì vậy `.env` dev mặc định không reset được; môi trường demo đặt `NODE_ENV=production` hoặc truyền trên dòng lệnh);
3. `DB_HOST`/`DB_NAME` không chứa `prod`;
4. `DEMO_RESET_CONFIRM` đúng bằng `<DB_HOST>:<DB_PORT>/<DB_NAME>`.

Bị từ chối thì in **mọi** lý do, ghi "Không có dữ liệu nào bị xóa", thoát mã khác 0 (script gốc trả 2; qua `pnpm` hiện là 1), không chạm CSDL. `pnpm db:seed` cũng chỉ nạp khi `APP_ENV` là `development` hoặc `demo` và chỉ vào CSDL trống (nạp lần hai báo lỗi, bảo dùng `demo:reset`).

Lỗi thường gặp: `self-signed certificate in certificate chain` (thiếu `DB_SSL_CA_FILE`, §1A); `Dữ liệu demo đã tồn tại` (dùng `demo:reset`, đừng dùng `db:seed`); `Thiếu cột/bảng` (chưa `pnpm db:migrate`; migration `*_quotation_notice_inbox` và `*_media_asset` cần được áp).

## 4. Ma trận nghiệm thu

Một dòng một bước. Cột "Giám khảo thấy gì" là điều để kiểm bằng mắt; cột cuối nói thật điều gì đã có.

| # | Bước | Giám khảo thấy gì trên màn hình | Vai trò thao tác | Dữ liệu / trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| 1 | Quét QR trên cốc | Điện thoại mở `/q/DF6P3WZE` → trang truy xuất: dòng thời gian 7 mốc lửa, "Nhật ký toàn vẹn" xanh | Giám khảo (khách vãng lai) | API `/trace/DF6P3WZE` chạy trên dữ liệu seed (test tích hợp). Trang web hiển thị dữ liệu minh họa tĩnh cho tới khi nối API |
| 2 | Duyệt hộ | Hàng đợi có "Gốm Bảo Châu"; sau duyệt hộ thành `APPROVED`, ghi nhật ký thao tác | Admin | Có API; **chưa có màn hình** (nav Admin ghi "Hàng đợi duyệt: sắp có"). E2E gọi API |
| 3 | Hộ xuất bản sản phẩm | Điện thoại hộ: sản phẩm nháp chuyển `PUBLISHED`, trang QR của nó mở được thay vì "không tìm thấy" | Hộ (điện thoại) | Có API và 2 bản nháp 7 mốc sẵn sàng; **chưa có màn hình** |
| 4 | Khám phá xưởng | Trang hộ Lò Đức Phát, bản đồ làng có ghim xưởng, giờ mở cửa | Giám khảo / Buyer | Trang web dùng dữ liệu tĩnh; API `/households/lo-duc-phat`, `/map/workshops` có dữ liệu seed |
| 5 | Tin tức | Trang tin có 15+ bài, gồm tin chung của làng và tin theo từng hộ | Buyer | Có màn `/vi/tin-tuc` đọc API thật, 18 tin seed (tin chung + tin theo hộ, không có bảng giá); lọc theo hộ qua `?household=<slug>` |
| 6 | Buyer báo giá | `/vi/yeu-cau-bao-gia/<biddingToAccept>`: chào giá chia 4 hộ, tổng tiền, phụ phí, điều khoản vận chuyển; sau khi chốt, đơn "Đã chốt" và 4 phân bổ chờ xác nhận | Buyer (Chrome) | Có màn xem và nút "Chốt chào giá này" (mở hộp thoại xác nhận); E2E thao tác qua UI |
| 7 | Admin điều phối | `/vi/admin/dieu-phoi/<sentOptIn>`: nút "Nhận điều phối" biến mất sau khi nhận; yêu cầu `sentCoordinated` hiện các đề xuất hộ | Admin (Edge) | Có màn (`LiveCoordination`) |
| 8 | Hộ xác nhận phân bổ | `/vi/studio/de-xuat-tham-gia/<acceptedConfirm>`: "Chờ xác nhận" → bấm "Xác nhận" → "Đã xác nhận"; Admin bấm "Bắt đầu sản xuất", đơn thành "Đang sản xuất" | Hộ (điện thoại), rồi Admin | Có màn |
| 9 | Tiến độ | `/vi/studio/de-xuat-tham-gia/<inProduction>`: 350 / 500 → nhập 500 → "Báo cáo" → 500 / 500, "Đã xong" | Hộ (điện thoại) | Có màn |
| 10 | Biên nhận | `/vi/yeu-cau-bao-gia/<inProduction>`: bấm "Xác nhận đã nhận hàng" → trạng thái "Đã giao" | Buyer | Có màn |

Kịch bản tự động bao trùm bước 1–10: `tests/e2e/specs/demo/qr-to-receipt.spec.ts`.

```bash
pnpm demo:reset                                   # bắt buộc trước mỗi lần chạy (kịch bản làm bẩn dữ liệu)
E2E_BASE_URL=https://<DOMAIN> pnpm demo:e2e       # đọc DEMO_*_PASSWORD, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY từ .env
pnpm demo:reset                                   # trả dữ liệu về nguyên trạng sau khi chạy
```

Thiếu `E2E_BASE_URL` hoặc thông tin đăng nhập thì cả kịch bản tự bỏ qua kèm lý do (CI không bị đỏ). Ba hồ sơ đăng nhập được dựng bằng đăng nhập REST của Supabase rồi chèn cookie `sb-<ref>-auth-token` đúng định dạng `@supabase/ssr` (web chưa có trang đăng nhập). Bước 5 mở `/vi/tin-tuc` và đếm ≥ 15 bài, nên cần web trỏ đúng `API_INTERNAL_URL` tới API đã nạp seed.

## 5. Chiếc cốc và URL ổn định

- QR dán lên cốc: `https://<DOMAIN>/q/DF6P3WZE`. Domain phải là domain thật dùng cả khi thi (cũng là domain của Cloudflare Tunnel dự phòng, xem §8), vì mã QR in ra không đổi được.
- `NEXT_PUBLIC_SITE_URL` được nhúng vào mã QR hiển thị trên web lúc **build**: build bản triển khai với đúng domain. Trên Vercel đặt biến này ở Environment Variables rồi Redeploy ([deploy.md §4](../deploy.md#4-vercel-tạo-project)).
- Ngày thi: thử quét bằng ít nhất một iPhone và một Android khác máy của nhóm, ở mạng 4G (không dùng Wi-Fi nhà).

## 6. Sao lưu và khôi phục

Dữ liệu mẫu tự khôi phục bằng `demo:reset`. Sao lưu để bảo vệ phần **không** có trong seed: ảnh đã tải lên, người dùng Auth, thay đổi tay sau khi chốt dữ liệu.

```bash
# DB_* lấy từ .env (Session pooler của Supabase, ADR-15). Nếu dùng CA riêng: thêm sslrootcert.
export PGPASSWORD="$DB_PASSWORD"
DB_URL="postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=verify-full&sslrootcert=$DB_SSL_CA_FILE"

# Sao lưu: chỉ schema public (bảng nghiệp vụ); không lấy auth, storage, schema hệ thống của Supabase
pg_dump "$DB_URL" --format=custom --no-owner --no-privileges --schema=public \
  --file="backup/vcraft-$(date +%Y%m%d-%H%M).dump"

# Ảnh (bucket vcraft-media, vcraft-private) qua giao thức S3 của Supabase
AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  aws s3 sync "s3://$S3_BUCKET_PUBLIC" backup/media --endpoint-url "$S3_ENDPOINT" --region "$S3_REGION"
```

**Khôi phục (diễn tập, không đè lên CSDL đang dùng):**

```bash
docker run -d --name vc-restore -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=vcraft -p 127.0.0.1:55433:5432 postgres:17-alpine
pg_restore --no-owner --no-privileges --dbname="postgresql://postgres:pw@127.0.0.1:55433/vcraft" backup/vcraft-<mốc>.dump
DB_DRIVER=postgresql DB_HOST=127.0.0.1 DB_PORT=55433 DB_USER=postgres DB_PASSWORD=pw DB_NAME=vcraft DB_SSL=false pnpm demo:verify
docker rm -f vc-restore
```

`demo:verify` đỏ ở mục nào thì nơi đó khôi phục chưa đủ. Khôi phục thật lên project Supabase mới: chạy `pnpm db:migrate` trước (tạo schema và RLS), rồi `pg_restore --data-only` (hoặc `demo:reset` + `demo:media`, §1A), rồi `pnpm demo:auth` (tạo lại người dùng với đúng id), rồi `aws s3 sync` ngược lại. Ghi lại **thời gian khôi phục** của lần diễn tập vào checklist §7.

## 7. Kiểm tra trước giờ thi (trên dữ liệu đóng băng)

Làm theo thứ tự, trên bản đã triển khai, **sau** `pnpm demo:reset`. Mục có "ghi" cần lưu ảnh chụp/kết quả làm bằng chứng.

| # | Kiểm tra | Lệnh / cách làm | Kết quả đạt | Thời gian ~ |
| --- | --- | --- | --- | --- |
| 1 | Dữ liệu còn nguyên | `pnpm demo:verify` | Mọi dòng `PASS` (hộ, sản phẩm, chuỗi băm, 12 yêu cầu, đơn 4 hộ, ≥ 15 tin tức, 4 tài khoản, hạn còn ≥ 3 ngày, ảnh gắn đủ và có ghi công, 3 giấy tờ mẫu ở bucket riêng tư, URL ảnh mở được) | 1 phút |
| 2 | Tài khoản Auth | `pnpm demo:auth -- --check` | 4 dòng `PASS` | 1 phút |
| 3 | Kịch bản QR → biên nhận | §4: `pnpm demo:reset && E2E_BASE_URL=... pnpm demo:e2e && pnpm demo:reset` | Các bước chạy được xanh (kể cả bước tin tức) | 5 phút |
| 4 | Lighthouse ≥ 90 | Xem lệnh bên dưới, 5 trang × (mobile, desktop) | Performance, Accessibility, Best Practices, SEO đều ≥ 90 ở mỗi trang; ghi điểm | 15 phút |
| 5 | Không nạp lại toàn trang | `E2E_BASE_URL=... pnpm demo:e2e:preexam -g "không nạp lại"`; trực quan: DevTools → Network → bật "Preserve log", chuyển trang qua thanh điều hướng, chỉ thấy Fetch/XHR, không có dòng `Doc` mới | Test xanh; Network không có `Doc` mới | 5 phút |
| 6 | WCAG AA | `pnpm demo:e2e:preexam -g "WCAG"` (axe: wcag2a, wcag2aa, wcag21a, wcag21aa) rồi duyệt tay: tương phản, nhãn form, thứ tự focus, chữ phóng 200% | Không có vi phạm axe; duyệt tay không lỗi | 20 phút |
| 7 | Đáp ứng 360–1440 px | `pnpm demo:e2e:preexam -g "đáp ứng"` (360, 768, 1024, 1440: không cuộn ngang); xem tay trên điện thoại thật | Test xanh; không vỡ layout | 10 phút |
| 8 | Đường QR chỉ dùng bàn phím | `pnpm demo:e2e:preexam -g "bàn phím"`; tay: mở `/q/DF6P3WZE`, chỉ dùng Tab/Enter/Shift+Tab | Mọi phần tử focus thấy vòng focus; kích hoạt được liên kết bằng Enter | 5 phút |
| 9 | Ảnh 12 MB → ≤ 1,5 MB | `pnpm demo:check:media` (gọi đúng `convertImage` của worker); thêm `-- --file ảnh-thật.jpg` với ảnh điện thoại thật ≥ 12 MiB. Tay: tải ảnh 12 MB lên Studio, xem Network + kích thước biến thể | Mọi biến thể AVIF/WebP ≤ 1,5 MB. Lưu ý API từ chối tệp > 10 MB (`MEDIA_MAX_BYTES`), ảnh 12 MB thật phải được trình duyệt nén trước khi gửi | 5 phút |
| 10 | Tranh chấp hai tab | `pnpm demo:check:concurrency` (hai phiên Admin, cùng `If-Match`, đồng thời); sau đó **`pnpm demo:reset`**. Tay: hai tab Buyer bấm cùng lúc | Đúng một `200`, một `409` mã `STALE_VERSION` | 3 phút |
| 11 | Độc lập CSDL | CI ma trận Postgres + MySQL xanh trên nhánh thi. Tay: `cd apps/api && npx vitest run --config vitest.integration.config.mts` rồi lặp lại với `DB_DRIVER=mysql`; trình diễn `DB_DRIVER=mysql pnpm db:migrate && pnpm demo:reset` | Hai lần chạy đều xanh | 10 phút (cần Docker) |
| 12 | Sao lưu và khôi phục | §6, bao gồm `demo:verify` trên bản khôi phục | `demo:verify` xanh trên bản khôi phục; ghi thời gian | 15 phút |
| 13 | QR vật lý | Quét cốc thật bằng 1 iPhone + 1 Android, mạng 4G | Mở đúng trang, dưới 3 giây | 5 phút |
| 14 | Dự phòng | Diễn tập §8 một lần trọn vẹn (chuyển DNS sang tunnel, giả lập Vercel/Render mất) | Dựng được bản local + tunnel trong ≤ 10 phút | 30 phút |
| 15 | Đóng gói | Sáng thi: `pnpm demo:reset`, `pnpm demo:media`, `pnpm demo:verify`, đăng nhập ba thiết bị, kiểm project Supabase Free chưa bị tạm dừng (trang Usage), sạc đầy pin | Mọi thứ sẵn sàng | 10 phút |

Lệnh Lighthouse (cần Chrome; không thêm dependency, dùng `npx`):

```bash
BASE=https://<DOMAIN>
for path in vi vi/nghe-nhan vi/nghe-nhan/lo-duc-phat vi/san-pham vi/truy-xuat/DF6P3WZE; do
  name=$(echo "$path" | tr '/' '-')
  # Mobile (mặc định của Lighthouse)
  npx lighthouse "$BASE/$path" --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new" --output=html --output=json --output-path="backup/lh-$name-mobile"
  # Desktop
  npx lighthouse "$BASE/$path" --preset=desktop --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new" --output=html --output=json --output-path="backup/lh-$name-desktop"
done
```

Hoặc Chrome DevTools → Lighthouse (chế độ Navigation, tắt extension, cửa sổ ẩn danh). Chạy trên bản **build production** (domain Vercel, hoặc `next start` sau Caddy ở local), không dùng `next dev`. Lighthouse dao động vài điểm giữa các lần; chạy 3 lần lấy trung vị cho trang sát ngưỡng.

Kiểm tra máy không làm thay được, cần người: đọc thử mô tả ảnh bằng trình đọc màn hình (NVDA/VoiceOver) ở trang truy xuất; kiểm reduced-motion; xác nhận nội dung tiếng Việt/Anh không lẫn.

## 8. Phương án dự phòng khi mất dịch vụ tại địa điểm thi

Nguyên tắc: **nếu dịch vụ ngoài lỗi thì mở bản local + tunnel trước**, không sửa sự cố ngay trước mặt giám khảo. Hạ tầng chính: Vercel (web) + Render (API, worker, Redis) + Supabase (Auth, Postgres, Storage) + SMTP ([ADR-16](../adr/0016-deploy-vercel-render.md), [deploy.md](../deploy.md)); dự phòng: Cloudflare Tunnel. ~~1 VPS + Caddy~~ là kế hoạch cũ, đã bị ADR-16 thay thế.

Cây quyết định:

| Triệu chứng | Làm gì |
| --- | --- |
| Trang chậm hoặc lỗi nhưng Supabase ổn | Render → service `vcraft-api` hoặc `vcraft-worker` → *Manual Deploy → Restart service* (Vercel: *Redeploy*), không quá 2 phút; quá thì sang bậc A |
| Vercel hoặc Render hỏng, Supabase ổn | **Bậc A**: chạy web/api/worker trên laptop, dùng Supabase thật, qua tunnel |
| Supabase (Auth/DB/Storage) lỗi | **Bậc B**: chạy cả CSDL và lưu trữ cục bộ; Auth xem ghi chú bên dưới |
| Mất cả Internet | **Bậc C**: chạy local hoàn toàn trên laptop, giám khảo xem trên màn hình laptop hoặc điện thoại cùng hotspot |
| Mọi thứ hỏng | Video quay sẵn kịch bản + ảnh chụp trang truy xuất in giấy (PLAN §9) |

Chuẩn bị sẵn từ trước (không làm được lúc đó): `git clone` + `pnpm install` + `pnpm build` trên laptop thi; kéo sẵn image Docker (`postgres:17-alpine`, `mysql:8.4`, `redis:7-alpine`, `axllent/mailpit`, `caddy:2-alpine`); cài `cloudflared`; một bản `.env.local-demo` đã điền (không commit).

### Bậc B: dựng stack cục bộ

```bash
pnpm infra:up                                  # redis, mailpit, caddy ở 127.0.0.1 (caddy :8080 -> web :3000, api :4000)
# CSDL cục bộ: Postgres hoặc MySQL (kiểm chứng độc lập CSDL)
docker run -d --name vcraft-pg -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=vcraft -p 127.0.0.1:5432:5432 postgres:17-alpine
#   hoặc MySQL: docker compose -f infra/compose/compose.dev.yml --profile mysql up -d mysql
```

`.env` cục bộ (tham chiếu `.env.example`; ghi đè các khóa sau):

```bash
APP_ENV=demo
NODE_ENV=production
APP_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:8080      # nhúng vào mã QR lúc build; xem ghi chú tunnel
DB_DRIVER=postgresql                            # hoặc mysql (DB_PORT=3306, DB_USER=vcraft, DB_PASSWORD=vcraft)
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=vcraft
DB_USER=postgres
DB_PASSWORD=pw
DB_SSL=false
REDIS_URL=redis://localhost:6379
SMTP_URL=smtp://localhost:1025                  # Mailpit: xem thư ở http://localhost:8025
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=../../infra/compose/.data/media          # Caddy phục vụ thư mục này ở /media/*
STORAGE_LOCAL_PRIVATE_DIR=../../infra/compose/.data/private # KHÔNG được phục vụ, chỉ đọc qua URL ký 5 phút
STORAGE_SIGNING_KEY=<chuỗi ngẫu nhiên >= 16 ký tự>          # openssl rand -base64 32
MEDIA_PUBLIC_BASE_URL=http://localhost:8080/media
DEMO_RESET_CONFIRM=127.0.0.1:5432/vcraft
```

```bash
pnpm db:migrate                                  # áp toàn bộ migration (có *_media_asset, *_quotation_notice_inbox)
pnpm demo:reset && pnpm demo:verify              # nạp lại dữ liệu mẫu, kiểm
pnpm build                                       # nếu chưa build
pnpm --filter @vcraft/api start &                # :4000
pnpm --filter @vcraft/worker start &
pnpm --filter @vcraft/web start &                # :3000, mở http://localhost:8080
```

**Đăng nhập khi Supabase Auth không dùng được.** API xác thực token qua `@supabase/server` (JWKS + `getUser`), nên cần một máy chủ Supabase Auth. Cách đã dự kiến, **chưa diễn tập, thử một lần trước ngày thi**: dùng Supabase cục bộ bằng CLI đã có sẵn trong devDependencies (`pnpm exec supabase init` rồi `pnpm exec supabase start`; cần Docker và kéo image trước). Lấy `API URL`, publishable và secret key từ `pnpm exec supabase status`, đặt `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL=<API URL>/auth/v1/.well-known/jwks.json` và các biến `NEXT_PUBLIC_SUPABASE_*` (cần **build lại web** vì chúng nhúng lúc build), rồi chạy `pnpm demo:auth` để tạo lại bốn người dùng với đúng id. CSDL nghiệp vụ vẫn dùng Postgres ở bậc này (cổng 54322 nếu muốn dùng chung chính Postgres của Supabase cục bộ). Nếu không kịp, giữ phiên đã đăng nhập sẵn thì **chỉ xem được trang công khai**, không thao tác được vai trò.

### Bậc A: laptop + Supabase thật + tunnel

Như Bậc B nhưng giữ `.env` trỏ tới Supabase (DB qua Session pooler, `STORAGE_DRIVER=s3`), chỉ chạy `pnpm infra:up` (Caddy, Redis, Mailpit) và ba tiến trình ứng dụng.

### Tunnel công khai để QR vẫn quét được

```bash
# Nhanh: URL ngẫu nhiên dạng https://<tên>.trycloudflare.com (đổi mỗi lần chạy)
cloudflared tunnel --url http://localhost:8080
```

URL ngẫu nhiên **không khớp** QR đã in trên cốc (QR mã hóa domain chính). Hai cách:

1. **Tunnel có tên trên chính domain thi** (khuyến nghị, làm sẵn từ trước): `cloudflared tunnel login`, `cloudflared tunnel create vcraft-demo`, `cloudflared tunnel route dns vcraft-demo <DOMAIN>` rồi chạy `cloudflared tunnel run vcraft-demo` với ingress `http://localhost:8080`. Cần domain quản lý DNS ở Cloudflare và TTL bản ghi đặt thấp (60 giây). Khi chuyển, **thay bản ghi trỏ về Vercel bằng CNAME của tunnel** (ADR-16), rồi trả lại bản ghi Vercel sau buổi thi. **Chưa diễn tập**, hạng mục 14 của checklist.
2. **Quick tunnel**: dùng trang truy xuất mở trên màn hình (build lại web với `NEXT_PUBLIC_SITE_URL=<URL tunnel>` để mã QR trên trang trỏ đúng) và để giám khảo quét mã đó thay vì quét cốc; nói rõ với giám khảo lý do.

Tunnel chỉ phơi cổng 8080 (Caddy), không phơi Redis/Mailpit/CSDL (compose chỉ bind `127.0.0.1`). Dừng tunnel ngay sau buổi thi.

Sau khi chuyển sang local, nhớ: dữ liệu local độc lập với Supabase, nên `pnpm demo:reset` ở local không ảnh hưởng dữ liệu trên Supabase; ngược lại ảnh tải lên ở local nằm ở `infra/compose/.data/` (đã `.gitignore`).

## 9. Danh sách lệnh nhanh

| Lệnh | Việc |
| --- | --- |
| `pnpm demo:reset` | Xóa bảng nghiệp vụ và nạp lại dữ liệu mẫu (có cổng chặn, §3) |
| `pnpm demo:media [-- --force \| --check]` | Tải ảnh có giấy phép + giấy tờ mẫu lên Storage và nối vào seed (cần `APP_ENV=demo`; chạy sau mỗi `demo:reset`, §1B) |
| `pnpm demo:verify [-- --offline]` | Kiểm dữ liệu demo còn nguyên, gồm ảnh và giấy tờ (chỉ đọc; `--offline` bỏ HEAD tới URL ảnh) |
| `pnpm demo:auth [-- --check]` | Tạo/kiểm 4 người dùng Supabase Auth với id cố định |
| `pnpm demo:e2e` | Kịch bản QR → biên nhận trên `E2E_BASE_URL` (làm bẩn dữ liệu, reset sau) |
| `pnpm demo:e2e:preexam` | WCAG, đáp ứng, không nạp lại trang, bàn phím (đặt `DEMO_PREEXAM=1` tự động) |
| `pnpm demo:check:media` | Ảnh 12 MB → biến thể ≤ 1,5 MB bằng `convertImage` của worker |
| `pnpm demo:check:concurrency` | Hai tab tranh nhau, một bên nhận `STALE_VERSION` (làm bẩn dữ liệu, reset sau) |
| `cd apps/api && npx vitest run --config vitest.integration.config.mts test/integration/demo-seed.integration.test.ts` | Test tích hợp seed + kịch bản demo qua API (thêm `DB_DRIVER=mysql` cho MySQL) |
