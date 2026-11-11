# Demo vấn đáp: dữ liệu mẫu, kịch bản QR → biên nhận, kiểm tra trước giờ thi

> Dành cho nhóm 3 người chuẩn bị buổi bảo vệ đầu tháng 1/2027 (GH#14, vCRAFT-83g mục demo). Mọi lệnh chạy ở thư mục gốc repo.
> Kịch bản phút-theo-phút nằm ở [PLAN §6](../PLAN.md#6-kịch-bản-demo-vấn-đáp); tài liệu này lo **dữ liệu**, **khôi phục**, **kiểm tra** và **phương án dự phòng**.

## 0. Hiện trạng thật (đọc trước)

- **Đã có và đã chạy thử:** seeder dữ liệu mẫu, `pnpm demo:reset` có cổng chặn, `pnpm demo:verify`, bộ kiểm tra `demo-seed.integration.test.ts` (chạy qua API thật trên cả PostgreSQL và MySQL), script tạo tài khoản Supabase Auth, script đo ảnh 12 MB, script đua hai tab.
- **Tin tức đã có:** entity `News`, API công khai `GET /api/v1/news` (+ `/news/:slug`) và trang `/vi/tin-tuc` (EN: `/en/news`). Trang này đọc API thật phía server qua `API_INTERNAL_URL` (xem `.env.example`; API không gọi được thì trang hiện thông báo, không lỗi). Seed loads 21 real village stories with their sources (GH#314, GH#333).
- **Ảnh có giấy phép đã nằm trong CSDL và Supabase Storage** (GH#26, §1B): `pnpm demo:media` tải ảnh minh hoạ lên `vcraft-media`, giấy tờ mẫu lên `vcraft-private` và nối vào seed kèm ghi công (`media_link`, mô tả vi/en). `demo:media` cũng đặt `coverUrl`/`coverAlt`/`coverAltEn` của 210 sản phẩm (`BT7K2QXM`, `84PZKVJU` và 208 sản phẩm có ảnh riêng `pp-<mã>` hoặc `pp2-<mã>`) và `coverUrl` của 4 hộ về URL trong bucket nên API công khai (GH#47) trả ảnh Supabase. Mọi mốc nhật ký của các món demo (hộ Lò Đức Phát, `BT7K2QXM`, `HX2M9KQD`) có ảnh công đoạn thật, ghi rõ là ảnh minh họa (GH#472, xem quy tắc bên dưới).
- **Trang công khai của `apps/web` đọc API thật** (trang chủ, sản phẩm, nghệ nhân, truy xuất, bản đồ, tin tức). Màn yêu cầu báo giá và điều phối cũng đọc API thật; `apps/web/src/lib/demo/data.ts` chỉ còn được import cho kiểu dữ liệu (`LogStage`, `DemoPhotoRef`) ở trang chủ, trình kiểm chuỗi nhật ký, `ImageSlot` và `lib/demo/stage-photos.ts` (ảnh và ghi công nằm riêng ở `photo-credits.ts`), không còn là nguồn dữ liệu của màn nào.
- Mọi bước của kịch bản e2e đều thao tác qua màn hình: Admin duyệt hộ ở `/admin/duyet-ho` (`household-review.tsx`: Duyệt, Từ chối, Yêu cầu bổ sung) và hộ xuất bản sản phẩm trong Studio (`product-list.tsx`, `product-editor.tsx`).
- **Triển khai production (GH#39):** web trên Vercel, API + worker + Redis trên Render, CSDL/Auth/Storage ở Supabase ([ADR-16](../adr/0016-deploy-vercel-render.md)); cấu hình nằm trong repo (`render.yaml`, `apps/web/vercel.json`, `next.config.ts`), các bước tạo project và dán biến môi trường ở [docs/operations/deploy.md](../operations/deploy.md). Đã chạy thử local: build production và khởi động API/worker bằng đúng lệnh start, rewrite `/api/*`. **Chưa** chạy trên Vercel/Render thật vì cần tài khoản của nhóm.
- **Chưa kiểm chứng được ở máy phát triển:** chạy trên URL đã triển khai, Lighthouse, tạo người dùng trên Supabase Auth thật, dựng Supabase cục bộ. Các mục này nằm trong checklist §7 để làm một lần trước ngày thi.

## 1. Dữ liệu mẫu

Nạp bằng entity MikroORM, chạy giống hệt trên PostgreSQL và MySQL (`packages/database/src/seeders/demo/`). Số lượng đo được sau khi nạp:

| Thành phần | Số lượng | Ghi chú |
| --- | --- | --- |
| Tài khoản (`app_user`) | 23 | 4 cố định (§2) + 19 người đại diện hộ không đăng nhập được |
| Hộ sản xuất | 21 | 20 `APPROVED` + 1 `PENDING_REVIEW` ("Gốm Bảo Châu"); tên và người hư cấu; mỗi hộ có một câu chuyện riêng nêu nghề và địa chỉ xưởng (GH#204), không ghi nhãn mẫu |
| Nghệ nhân / xưởng | 53 / 35 | Xưởng có tọa độ quanh Bát Tràng (20.9758, 105.9139) |
| Sản phẩm | 222 | 218 `PUBLISHED`; 4 `DRAFT` (2 của hộ household để xuất bản trực tiếp, 2 của hộ chờ duyệt) |
| Mốc nhật ký | 1.295 | Mỗi sản phẩm 4–7 mốc, chuỗi băm SHA-256 sinh bằng `sealChain` của `@vcraft/domain`, kiểm lại bằng `verifyChain`; công đoạn bị nhảy đều có lý do bỏ qua |
| Yêu cầu báo giá | 14 | Đủ 8 trạng thái RFQ (bảng bên dưới); mỗi yêu cầu có tiêu đề, mô tả (số lượng, men, đóng gói) và yêu cầu riêng như in logo (GH#477) |
| Đề xuất tham gia / chào giá / phân bổ | 24 / 10 / 12 | Chào giá hợp tác dựng bằng `assembleCooperativeQuotation`, 3 báo giá trực tiếp bằng `assembleDirectQuotation` (GH#479), nên đúng luật tổng và năng lực. Thêm 2 đánh giá của Buyer cho hai hộ ở đơn `delivered` |
| Tin tức | 28 | Đều `PUBLISHED`: 21 tin thật của làng (không có tin của hộ) + 6 bảng giá nguyên liệu + 1 lịch cắt điện; nội dung không còn nhãn mẫu (GH#204); ngày đăng tính từ mốc đóng băng |

Ảnh: seed (`demo:reset`) để trống `images: []` ở nhật ký và không có ảnh bìa (`pnpm demo:media` gắn ảnh công đoạn vào nhật ký của các món demo và niêm phong lại chuỗi băm); ảnh có giấy phép được nối vào bằng `pnpm demo:media` (§1B). Chạy `demo:reset` mà không chạy `demo:media` thì `demo:verify` báo đỏ ở nhóm kiểm ảnh.

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
| `biddingDirect` | BIDDING, không điều phối, 3 báo giá trực tiếp của Gốm Minh Hải, Gốm Kim Liên, Gốm Ngọc Diệp (khác giá, ngày giao, đánh giá) | Buyer so sánh và **chốt** một báo giá; hai hộ còn lại "Không được chọn" | `d3a10000-0000-4000-8000-000000000113` |
| `sentDirect` | SENT, không điều phối, hộ household được mời, chưa báo giá | Hộ **Gửi báo giá**, sửa và rút | `d3a10000-0000-4000-8000-000000000114` |

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
| Sản phẩm (`BT7K2QXM`, `84PZKVJU` và 206 sản phẩm `pp-<mã>`, 2 sản phẩm `pp2-<mã>`) | `media_link` (`PRODUCT`, `COVER`) | 210 ảnh bìa |
| Hộ (20 hộ đã duyệt đều có ảnh bìa; 18 hộ có ít nhất 2 ảnh thư viện, Hoàng Long và Ngọc Diệp chưa có vì Commons không có ảnh Bát Tràng hợp nghề của hộ; 4 hộ có thêm ảnh chân dung) | `media_link` (`HOUSEHOLD`, `PORTRAIT` / `BANNER` / `GALLERY` kèm `caption`) | 66 liên kết (4 chân dung, 20 ảnh bìa, 42 ảnh thư viện) |
| Tin (ủ đất sét, lớp vuốt gốm) | `media_link` (`NEWS`, `COVER`) | 2 ảnh bìa |
| Mốc nhật ký của các món demo (mọi sản phẩm của Lò Đức Phát gồm `DF6P3WZE` và hai bản nháp xuất bản trực tiếp, cùng `BT7K2QXM`, `HX2M9KQD`) | `journal_entry.images` = 1 ảnh công đoạn (2 ảnh ở `DF6P3WZE`) chọn trong `journal-photos.ts`; SHA-256 của ảnh nằm trong `mediaChecksums` của chuỗi băm, `demo:media` niêm phong lại chuỗi. Ảnh là ảnh công đoạn tại Bát Tràng, không phải ảnh của món đồ (xem quy tắc bên dưới) | 7 mốc × 13 sản phẩm |
| Mốc nhật ký của sản phẩm khác | không gắn ảnh: `images` là `[]`, `mediaChecksums` rỗng | 0 |
| Hộ chờ duyệt Gốm Bảo Châu | `media_asset` mục đích `CERTIFICATE`, riêng tư, chủ là người đại diện; `media_link` (`HOUSEHOLD`, `DOCUMENT`) | 3 giấy tờ mẫu |

**Photo rules (vCRAFT-83g.35).** An image may be attached to an object only if it shows that kind of object with the attributes in its name and description; the demo descriptions say "made by household X in Bát Tràng", so a photo of an object made elsewhere fails. Hence: no generic stage photos on products, no night-market photo on the night-market news, and no photo that Commons places outside Bát Tràng or attributes to another ware (a kiln in Châu Thành, Đồng Tháp; the Chu Đậu pieces of Hải Dương) in a Bát Tràng household's gallery. For households, news and the home page, where the context says Bát Tràng, Commons must confirm it: Gốm Minh Hải's banner (kilns whose place Commons does not state) was retired too, so that household shows a workshop illustration on cards and the map, and the home hero is the Commons-confirmed Bát Tràng vase `binh-men-lam-xam`; the firing photo of "A day in Bát Tràng" is a Bát Tràng-confirmed sagger photo. Those products and stories show a preset illustration of their kind (bowl, cup, vase, jar, plate, tea set, incense burner, generic; labelled as an illustration, not a photo), chosen in the web app from the product category and name. The mapping lives in `packages/database/src/seeders/demo/photo-manifest.ts`, which is now maintained by hand (the old `export-manifest.mjs` is retired); every link carries a Vietnamese `alt` and an English `altEn` (stored as `media_link.alt_en`). `RETIRED_DEMO_PHOTO_IDS` lists photos that must no longer exist: `demo:media` deletes their rows, links and storage objects. The second product with its own photo (vCRAFT-83g.48) is `84PZKVJU`, an "Ống đựng bút vẽ lam" of Gốm Đại Phong: Commons photo `ong-gom-lam-may` (CC0, Daderot), a Bát Tràng ceramic cylinder with a cobalt-blue cloud pattern in the Vietnam National Museum of Fine Arts; its alt text describes only what is visible, because the museum record calls the object a "tube for papers", not a pen holder. **Product photos (vCRAFT-83g.48, relaxed provenance).** A product may take a real photo of the same kind of piece with the glaze, colour and motif of its name (a rice bowl with a painted lotus, a crackle-glazed jar, a small brown planter) even when the piece is not from Bát Tràng; its alt text describes only what is visible and never claims Bát Tràng, and the manifest `credit` records the source. 206 products got their own photo `pp-<trace code>` (74 in vCRAFT-83g.48 and 132 in vCRAFT-83g.52; the choice was reviewed by hand: right object type, e.g. a tray is not a dish, a liquor jar is not a bottle vase, a tea set is not a single pot, a tureen is lidded; glaze and motif from the name; one photo per product, never reused), from Wikimedia Commons, the Cleveland Museum of Art open access (CC0) and Pixabay, under CC0, public domain, CC BY, CC BY-SA or the Pixabay content licence. Their files are product covers only: `build.mjs` writes just the 1280 px WebP (`bucketOnly`, natural ratio, a `region` crop removes rulers, labels and numbers at the edge) that `demo:media` uploads; the bucket's variants are served to the site. The photos from vCRAFT-83g.52 carry no recorded author or licence (`credit.license` is `unknown`). GH#204 retired them, but on 2026-11-08 the owner decided that, since this is a demo site, demo product photos with an unknown licence are kept as long as each photo matches its product; the 132 that match are back in the manifest and in `apps/web/public/images/demo`. 14 photos stay retired (listed in `RETIRED_DEMO_PHOTO_IDS` and, as products without a cover, in `NO_COVER_DEMO_PRODUCTS`) because the photo does not match the product (`KKVB8B28`: a plain wooden tea tray for a lotus-painted tray; `PQNMSM5U`: green lotus painting for a brown flower glaze; `M2BKH982` and `YT8G4F7E`: a round plate on a stand for a tea tray) or shows a shop watermark or logo (the other ten). GH#331 then found two of them a better photo: museum open-access (CC0) photos of the Metropolitan Museum of Art, stored as `pp2-<trace code>` because the retired `pp-<trace code>` ids must stay deleted (the blue-and-white lidded jar with ducks in a lotus pond for `HSUJQP77`, the ivory-white bottle vase for `UQXED4KM`). 210 products now have a real photo (`BT7K2QXM`, `84PZKVJU`, the 206 `pp-` and the two `pp2-`) and 12 show the preset illustration: no open-access photo was found of a lidded crackle-glazed liquor jar (`BQ2Z83ZY`, `FDT9HNPV`, `G5BEKP4Q`, `JVANRMAB`; small open green crackle jars were rejected), a flared brown-flower vase (`BRMH663W`, `NA4WKT3A`, `RNTYR2NV`), a crackle-glazed tea set (`HWKG9TFU`), a lotus-painted or crackle-glazed tea tray (`KKVB8B28`, `M2BKH982`, `YT8G4F7E`) or a brown-flower tea jar (`PQNMSM5U`).

**Journal photos (GH#472, replaces the old "journal entries carry no photo" rule).** The brief asks for photos that prove each milestone, and the team has no photos of one cup being made yet, so every milestone of the demo pieces (all products of Lò Đức Phát, which includes `DF6P3WZE` and the two drafts published live, plus `BT7K2QXM` and `HX2M9KQD`) carries a real, openly licensed photo of **that stage in a Bát Tràng workshop** (Wikimedia Commons, CC BY / CC BY-SA, 15 photos: 5 existing and 10 new `stage-*`; author, licence and source page in the manifest and on `/ghi-nhan-anh`). What keeps this honest: (1) the photo is never presented as this piece: its `alt` describes only what is visible (`media_asset.alt_text`, returned as `alt` by the journal API), and the trace page prints under every credited journal photo "Photo of this step at the craft village, not of this piece" with the author and licence linked to the source; a household's own upload has no credit and no note; (2) the stage-to-photo map is `journal-photos.ts` (`JOURNAL_STAGE_PHOTOS`, 2–3 photos per stage, picked per trace code so the pieces do not all show the same picture; `DF6P3WZE` shows two per stage); (3) `demo:media` (step `journal`, `--only=journal [--journal-products=CODE,…]`) writes the photo checksums into `journal_entry.images` and re-seals the chain with `sealChain`, so "Nhật ký toàn vẹn" verifies; an entry that carries a photo that is not a demo photo (a household's own upload) is left alone; (4) `demo:verify` fails when a milestone of a demo piece has no photo or the photo is not a published (`READY`, public) file (`verify-journal-photos.ts`). Every other product keeps a bare journal. When the team has its own photos of one cup being made, add them to `DEMO_PHOTOS` with the team as author and change `JOURNAL_STAGE_PHOTOS` (or upload them in Studio); drop the credit so the note disappears.

**Ảnh bìa đang dùng ngay:** `demo:media` ghi đè `product.cover_url`/`cover_alt`/`cover_alt_en` (210 sản phẩm) và `household.cover_url` (ảnh bìa 4 hộ) bằng URL biến thể WebP 1280 trong bucket; API công khai của GH#47 trả đúng hai cột này nên không cần sửa API. **The API reads everything else (galleries, portraits, news covers, credits) from `media_link` (GH#54):** household/product/news images = `media_link` by (`target_type`, `target_id`, `role`, `position`) → `media_asset.variants` (URL = `MEDIA_PUBLIC_BASE_URL` + `key`), `credit`, `alt_text` (`media_link.alt_text` takes priority). `GET /households/{slug}` returns `portrait`, `banner`, `gallery`; `GET /news` and `GET /news/{slug}` return `cover`; `GET /products/{slug}` and `GET /trace/{code}` return `coverCredit`. Journal entry images: `journal_entry.images[].url` is already a public URL; `credit` is looked up by `images[].sha256` = `media_asset.sha256`. `DOCUMENT` files, private files and files that are not `READY` never reach the public API.

**Giấy tờ mẫu:** ba ảnh vẽ cục bộ bằng `scripts/demo/photos/make-specimen-docs.mjs` (căn cước, xác nhận cư trú, ảnh xưởng), toàn dữ liệu giả và đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ"; không bao giờ dùng giấy tờ thật. Chỉ nằm ở `vcraft-private`: Admin đọc qua `GET /media/{id}/read-url` (URL ký 5 phút), người khác bị từ chối, không có biến thể công khai.

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

GH#212 adds a unique lowercase username to each demo account. Sign in with `admin`, `buyer`, `household` or `pending` and the corresponding password. Email sign-in remains available for existing accounts. Public registration cannot claim these demo usernames or the system names `root` and `support`.

| Khóa | Vai trò | Email | Username | UUID | Biến mật khẩu |
| --- | --- | --- | --- | --- | --- |
| `admin` | ADMIN | `demo.admin@example.com` | `admin` | `d3a10000-0000-4000-8000-000000000001` | `DEMO_ADMIN_PASSWORD` |
| `buyer` | BUYER | `demo.buyer@example.com` | `buyer` | `d3a10000-0000-4000-8000-000000000002` | `DEMO_BUYER_PASSWORD` |
| `household` | HOUSEHOLD (Lò Đức Phát, đã duyệt) | `demo.household@example.com` | `household` | `d3a10000-0000-4000-8000-000000000003` | `DEMO_HOUSEHOLD_PASSWORD` |
| `pending` | HOUSEHOLD (Gốm Bảo Châu, chờ duyệt) | `demo.pending@example.com` | `pending` | `d3a10000-0000-4000-8000-000000000004` | `DEMO_PENDING_PASSWORD` |

Mật khẩu **không** nằm trong mã; đặt trong `.env` của máy demo (không commit) hoặc kho bí mật của nhóm.

Set `DEMO_ADMIN_USERNAME=admin` and keep the password in `DEMO_ADMIN_PASSWORD`. Demo clients read the username override; `demo:auth` provisions Supabase identities by email. The migration backfills the four fixed usernames and the seed keeps them consistent on subsequent runs.

```bash
# Trong .env của môi trường demo: APP_ENV=demo, SUPABASE_URL, SUPABASE_SECRET_KEY, bốn DEMO_*_PASSWORD
# DEMO_ADMIN_USERNAME is used by demo sign-in clients; this provisioning script does not read it.
pnpm demo:auth                 # tạo hoặc cập nhật 4 người dùng (id cố định, email đã xác nhận); chạy lại được
pnpm demo:auth -- --check      # chỉ kiểm tra, không ghi
```

`auth.admin.createUser` nhận thuộc tính `id` (đã xác nhận trong kiểu `AdminUserAttributes` của `@supabase/auth-js`), nên không cần cách vòng. Nếu một email demo đã gắn với người dùng id khác (vd. đã đăng ký tay), script dừng và hướng dẫn xóa người dùng đó ở Dashboard → Authentication rồi chạy lại. Nếu tài khoản bị khóa hay đổi vai trò khi tập dượt thì `demo:reset` đưa `app_user` về đúng vai trò.

Sau khi tạo: đăng nhập từng tài khoản **một lần** trên đúng thiết bị thi (Buyer: Chrome, Hộ: điện thoại, Admin: Edge) và giữ phiên. Hạn token của Supabase là 15 phút nhưng trình duyệt tự làm mới bằng refresh token; kiểm tra phiên còn sống sáng hôm thi. 

GH#212: sign in again at `/vi/dang-nhap` using the account's username. Admin MFA still applies.

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

`demo:reset` xóa **mọi** bảng nghiệp vụ (kể cả bản ghi do tập dượt, hộp thư, outbox, `media_asset`) theo thứ tự con trước cha rồi nạp lại, trong một giao dịch (lỗi giữa chừng thì không mất gì). Danh sách bảng nằm ở `CLEARED_ENTITIES` (`packages/database/src/seeders/demo/reset.ts`, có test chống lệch với khóa ngoại). Cố ý giữ lại `knowledge_chunks`, `assistant_message_log`, `login_event`, `idempotency_keys`, `mail_claim`, `slug_redirect`, `notification_preference`, `unapplied_payment`. Không đụng bảng migration, schema `auth`/`storage` của Supabase hay tệp trong bucket: vì vậy sau reset phải chạy `pnpm demo:media` để dựng lại `media_asset`, `media_link` và ảnh của nhật ký (chạy lại được, §1B).

**Cổng chặn** (hàm thuần `evaluateDemoResetGuard`, có unit test; chạy **trước** khi mở kết nối). Phải thỏa đồng thời:

1. `APP_ENV=demo` (dev, production, để trống đều bị từ chối);
2. `NODE_ENV` không phải `development` (vì vậy `.env` dev mặc định không reset được; môi trường demo đặt `NODE_ENV=production` hoặc truyền trên dòng lệnh);
3. `DB_HOST`/`DB_NAME` không chứa `prod`;
4. `DEMO_RESET_CONFIRM` đúng bằng `<DB_HOST>:<DB_PORT>/<DB_NAME>`.

Bị từ chối thì in **mọi** lý do, ghi "Không có dữ liệu nào bị xóa", thoát mã khác 0 (script gốc trả 2; qua `pnpm` hiện là 1), không chạm CSDL. `pnpm db:seed` cũng chỉ nạp khi `APP_ENV` là `development` hoặc `demo` và chỉ vào CSDL trống (nạp lần hai báo lỗi, bảo dùng `demo:reset`).

Lỗi thường gặp: `self-signed certificate in certificate chain` (thiếu `DB_SSL_CA_FILE`, §1A); `Dữ liệu demo đã tồn tại` (dùng `demo:reset`, đừng dùng `db:seed`); `Thiếu cột/bảng` (chưa `pnpm db:migrate`; migration `*_quotation_notice_inbox` và `*_media_asset` cần được áp).

### Refreshing the text of an existing demo database (GH#298)

`pnpm demo:refresh-text [-- --dry-run]` brings the text of a live demo database in line with the current seed without a reset. It rewrites only text columns: `household.history` and `artisan.bio` (the seed's stories and bios, matched by household name; artisans by creation order, using each row's own name and craft role), the body of the news items that come from the seed's news pool, and it strips the old "[Dữ liệu mẫu]" tag and any sentence that calls the data fictional or for demonstration from news titles, summaries and bodies and from product descriptions and artisan notes. It also drops the old " (mẫu)" suffix from `app_user.full_name` (the four fixed demo accounts get their current seed names). Rows that are not in the seed are only stripped, never given invented text. Media, users, ids, slugs and prices are not touched, so there is no destructive guard; the command prints the target database first. It runs in one transaction and is idempotent: a second run reports `changed: 0`.

```bash
pnpm demo:refresh-text -- --dry-run   # prints counts per table and the household slugs it would change; writes nothing
pnpm demo:refresh-text                # applies the change
pnpm assistant:reindex                # then rebuild the Fox assistant's knowledge chunks so it reads the new text
pnpm demo:verify -- --offline         # the check "No demo disclaimer text" must pass
```

### Moving the demo workshop pins inside the commune boundary (GH#396)

The drawn Bát Tràng commune polygon (OpenStreetMap, post-2025 merger, about 7 km by 9 km, `packages/domain/src/village/bat-trang-boundary.json`) is the source of truth for "in the commune"; it is not too tight. The old seed drew workshop pins from a small box around the old village core and 14 of the 22 landed outside the polygon, so the admin review flagged approved demo households with "Pinned outside Bát Tràng commune". The seed now pulls every pin that falls outside to the nearest point inside the polygon with a ~30 m inward margin (`boundary-fit.ts`); pins already inside are unchanged and the random stream (so every frozen id and trace code) is unchanged.

`pnpm demo:refresh-coordinates [-- --dry-run]` applies the same fit to a live database without a reset. It writes only `workshop.lat` and `workshop.lng` of the workshops with deterministic demo ids, in one transaction, and is idempotent (a second run reports `changed: 0`). A dry run is read-only; a real run needs the `demo:reset` guard (`APP_ENV=demo` and `DEMO_RESET_CONFIRM=<host>:<port>/<db>`).

```bash
pnpm demo:refresh-coordinates -- --dry-run   # prints counts and the ids of the workshops it would move; writes nothing
pnpm demo:refresh-coordinates                # applies the change
```

### Swapping the seed news for the real stories on a live database (GH#314)

`pnpm demo:reset` wipes every business table, so a live database gets the real stories with `pnpm news:swap` instead. The command is keyed on the stable news ids (UUID v5 of the seed key in `pools.ts`), idempotent and non-destructive: it creates or updates the `news` rows of the seed pool (text, publish date, publisher, link and original date), links their covers from `photo-manifest.ts` with Vietnamese and English alt text, and sets the old invented stories (`LEGACY_NEWS_KEYS` in `news-seed.ts`) that are no longer in the pool back to draft. It never deletes a row and writes nothing outside `news`, the news cover rows of `media_link` and the outbox event that makes the assistant reindex. Stories of a household that does not exist in the target database are skipped and counted.

```bash
pnpm demo:media -- --only=media        # uploads the cover photos and registers their credits (additive; needs APP_ENV=demo)
NEWS_SWAP_CONFIRM=<host>:<port>/<name> pnpm news:swap -- --dry-run   # prints created/updated/unchanged/retired counts, writes nothing
NEWS_SWAP_CONFIRM=<host>:<port>/<name> pnpm news:swap                # applies the change; a second run reports only `unchanged`
pnpm assistant:reindex                 # the Fox assistant reads the new news
```

`NEWS_SWAP_CONFIRM` must equal the `host:port/name` the command prints for the target, so a copied `.env` cannot hit the wrong database. Photos imported by the worker (see "Automatic news import" in [deploy.md](../operations/deploy.md)) are credited on `/ghi-nhan-anh` from `media_asset.credit` through `GET /api/v1/media/credits`.

## 4. Ma trận nghiệm thu

Một dòng một bước. Cột "Giám khảo thấy gì" là điều để kiểm bằng mắt; cột cuối nói thật điều gì đã có.

| # | Bước | Giám khảo thấy gì trên màn hình | Vai trò thao tác | Dữ liệu / trạng thái hiện tại |
| --- | --- | --- | --- | --- |
| 1 | Quét QR trên cốc | Điện thoại mở `/q/DF6P3WZE` → trang truy xuất: dòng thời gian 7 mốc lửa, "Nhật ký toàn vẹn" xanh | Giám khảo (khách vãng lai) | API `/trace/DF6P3WZE` chạy trên dữ liệu seed (test tích hợp). Trang web đọc API thật |
| 2 | Duyệt hộ | Hàng đợi có "Gốm Bảo Châu"; sau duyệt hộ thành `APPROVED`, ghi nhật ký thao tác | Admin | Có màn `/vi/admin/duyet-ho` (hàng đợi và trang duyệt từng hộ); E2E thao tác qua UI |
| 3 | Hộ xuất bản sản phẩm | Điện thoại hộ: sản phẩm nháp chuyển `PUBLISHED`, trang QR của nó mở được thay vì "không tìm thấy" | Hộ (điện thoại) | Có màn xuất bản trong Studio (`/vi/studio/san-pham`) và 2 bản nháp 7 mốc sẵn sàng; E2E thao tác qua UI |
| 4 | Khám phá xưởng | Trang hộ Lò Đức Phát, bản đồ làng có ghim xưởng, giờ mở cửa | Giám khảo / Buyer | Trang web đọc API thật (`/households/lo-duc-phat`, `/map/workshops`) trên dữ liệu seed |
| 5 | Tin tức | Trang tin có 15+ bài, gồm tin chung của làng và tin theo từng hộ | Buyer | Có màn `/vi/tin-tuc` đọc API thật, 21 real village stories with sources (GH#314, GH#333; no household stories, no price table); lọc theo hộ qua `?household=<slug>` |
| 6 | Buyer báo giá | `/vi/yeu-cau-bao-gia/<biddingToAccept>`: chào giá chia 4 hộ, tổng tiền, phụ phí, điều khoản vận chuyển; sau khi chốt, đơn "Đã chốt" và 4 phân bổ chờ xác nhận | Buyer (Chrome) | Có màn xem và nút "Chốt chào giá này" (mở hộp thoại xác nhận); E2E thao tác qua UI |
| 7 | Admin điều phối | `/vi/admin/dieu-phoi/<sentOptIn>`: nút "Nhận điều phối" biến mất sau khi nhận; yêu cầu `sentCoordinated` hiện các đề xuất hộ | Admin (Edge) | Có màn (`LiveCoordination`) |
| 8 | Hộ xác nhận phân bổ | `/vi/studio/de-xuat-tham-gia/<acceptedConfirm>`: "Chờ xác nhận" → bấm "Xác nhận" → "Đã xác nhận"; Admin bấm "Bắt đầu sản xuất", đơn thành "Đang sản xuất" | Hộ (điện thoại), rồi Admin | Có màn |
| 9 | Tiến độ | `/vi/studio/de-xuat-tham-gia/<inProduction>`: 350 / 500 → nhập 500 → "Báo cáo" → 500 / 500, "Đã xong" | Hộ (điện thoại) | Có màn |
| 10 | Biên nhận | `/vi/yeu-cau-bao-gia/<inProduction>`: bấm "Xác nhận đã nhận hàng" → trạng thái "Đã giao" | Buyer | Có màn |
| 11 | Nhiều hộ chào giá trực tiếp (GH#479) | Buyer mở `/vi/yeu-cau-bao-gia/<biddingDirect>`: ba thẻ "Hộ báo giá riêng" cạnh nhau (tên hộ, đánh giá, đơn giá, thành tiền, ngày hoàn thành, ghi chú), nhãn "Tổng thấp nhất" trên giá rẻ nhất, mỗi thẻ có nút "Chốt chào giá này"; chốt một thẻ thì hai thẻ kia thành "Không được chọn", yêu cầu "Đã chốt". Rồi hộ household mở `/vi/studio/de-xuat-tham-gia/<sentDirect>`: nhập đơn giá, ngày hoàn thành, ghi chú → "Gửi báo giá"; thử "Cập nhật báo giá" và "Rút báo giá" | Buyer, rồi Hộ (điện thoại) | Có màn; test tích hợp `demo-seed` chạy cả luồng chốt trên dữ liệu seed (hộ thua nhận thông báo "không được chọn") |

Kịch bản tự động bao trùm bước 1–11 (bước 11 là hai test 12 và 13): `tests/e2e/specs/demo/qr-to-receipt.spec.ts`.

```bash
pnpm demo:reset                                   # bắt buộc trước mỗi lần chạy (kịch bản làm bẩn dữ liệu)
E2E_BASE_URL=https://<DOMAIN> pnpm demo:e2e       # đọc DEMO_*_PASSWORD, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY từ .env
pnpm demo:reset                                   # trả dữ liệu về nguyên trạng sau khi chạy
```

Thiếu `E2E_BASE_URL` hoặc thông tin đăng nhập thì cả kịch bản tự bỏ qua kèm lý do (CI không bị đỏ). Ba hồ sơ đăng nhập được dựng bằng đăng nhập REST của Supabase rồi chèn cookie `sb-<ref>-auth-token` đúng định dạng `@supabase/ssr` (web chưa có trang đăng nhập). Bước 5 mở `/vi/tin-tuc` và đếm ≥ 15 bài, nên cần web trỏ đúng `API_INTERNAL_URL` tới API đã nạp seed.

## 5. Chiếc cốc và URL ổn định

- QR dán lên cốc: `https://<DOMAIN>/q/DF6P3WZE`. Domain phải là domain thật dùng cả khi thi (cũng là domain của Cloudflare Tunnel dự phòng, xem §8), vì mã QR in ra không đổi được.
- `NEXT_PUBLIC_SITE_URL` được nhúng vào mã QR hiển thị trên web lúc **build**: build bản triển khai với đúng domain. Trên Vercel đặt biến này ở Environment Variables rồi Redeploy ([deploy.md §4](../operations/deploy.md#4-vercel-tạo-project)).
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
| 1 | Dữ liệu còn nguyên | `pnpm demo:verify` | Mọi dòng `PASS` (hộ, sản phẩm, chuỗi băm, 14 yêu cầu, đơn 4 hộ, ≥ 15 tin tức, 4 tài khoản, hạn còn ≥ 3 ngày, 2 yêu cầu báo giá trực tiếp, ảnh gắn đủ và có ghi công, 3 giấy tờ mẫu ở bucket riêng tư, URL ảnh mở được) | 1 phút |
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

Nguyên tắc: **nếu dịch vụ ngoài lỗi thì mở bản local + tunnel trước**, không sửa sự cố ngay trước mặt giám khảo. Hạ tầng chính: Vercel (web) + Render (API, worker, Redis) + Supabase (Auth, Postgres, Storage) + SMTP ([ADR-16](../adr/0016-deploy-vercel-render.md), [deploy.md](../operations/deploy.md)); dự phòng: Cloudflare Tunnel. ~~1 VPS + Caddy~~ là kế hoạch cũ, đã bị ADR-16 thay thế.

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
| `pnpm demo:refresh-text [-- --dry-run]` | Rewrite household stories, artisan bios and news text in place and strip the old sample-data disclaimers (text only, §3); then `pnpm assistant:reindex` |
| `pnpm demo:refresh-coordinates [-- --dry-run]` | Move demo workshop pins that lie outside the Bát Tràng boundary to the nearest point inside it (lat/lng only, §3) |
| `pnpm demo:auth [-- --check]` | Tạo/kiểm 4 người dùng Supabase Auth với id cố định |
| `pnpm demo:e2e` | Kịch bản QR → biên nhận trên `E2E_BASE_URL` (làm bẩn dữ liệu, reset sau) |
| `pnpm demo:e2e:preexam` | WCAG, đáp ứng, không nạp lại trang, bàn phím (đặt `DEMO_PREEXAM=1` tự động) |
| `pnpm demo:check:media` | Ảnh 12 MB → biến thể ≤ 1,5 MB bằng `convertImage` của worker |
| `pnpm demo:check:concurrency` | Hai tab tranh nhau, một bên nhận `STALE_VERSION` (làm bẩn dữ liệu, reset sau) |
| `cd apps/api && npx vitest run --config vitest.integration.config.mts test/integration/demo-seed.integration.test.ts` | Test tích hợp seed + kịch bản demo qua API (thêm `DB_DRIVER=mysql` cho MySQL) |
