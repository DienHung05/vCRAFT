# vCraft — Đặc tả Yêu cầu Phần mềm (SRS)

> **Tinh hoa làng nghề, muôn phương lan tỏa**
> Phiên bản 1.0 · 27/10/2026 · INT3306 – Phát triển ứng dụng web (Fall 2026)
> Nguồn yêu cầu gốc: [requirements/vCraft.pdf](requirements/vCraft.pdf)
> Tài liệu liên quan: [ARCHITECTURE.md](ARCHITECTURE.md) · [PLAN.md](PLAN.md) · [BRAND.md](BRAND.md)

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Mô tả tổng quan](#2-mô-tả-tổng-quan)
3. [Yêu cầu chức năng](#3-yêu-cầu-chức-năng)
4. [Đặc tả máy trạng thái & quy tắc khóa](#4-đặc-tả-máy-trạng-thái--quy-tắc-khóa)
5. [Yêu cầu giao diện ngoài](#5-yêu-cầu-giao-diện-ngoài)
6. [Yêu cầu phi chức năng](#6-yêu-cầu-phi-chức-năng)
7. [Yêu cầu dữ liệu](#7-yêu-cầu-dữ-liệu)
8. [Ma trận truy vết: Tiêu chí chấm ↔ Yêu cầu](#8-ma-trận-truy-vết-tiêu-chí-chấm--yêu-cầu)
9. [Phụ lục: Kịch bản chấp nhận chính](#9-phụ-lục-kịch-bản-chấp-nhận-chính)

---

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu đặc tả đầy đủ yêu cầu chức năng, phi chức năng và ràng buộc của **vCraft** — nền tảng web dành cho Ban quản lý (BQL) một làng nghề truyền thống. Đây là "hợp đồng" chung của nhóm 3 thành viên: mọi tính năng làm ra phải truy vết được về một mã yêu cầu (FR/NFR) ở đây, và mọi tiêu chí chấm điểm phải truy vết được về ít nhất một yêu cầu (§8).

### 1.2 Phạm vi sản phẩm

vCraft **không phải một sàn bán lẻ**. Sản phẩm gồm bốn trụ cột:

| Trụ cột                 | Giá trị mang lại                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Triển lãm số**        | Mỗi hộ/nghệ nhân có không gian riêng kể chuyện nghề, trưng bày sản phẩm độc bản.                                    |
| **Truy xuất nguồn gốc** | Mỗi sản phẩm có Nhật ký sản xuất (chuỗi mốc + ảnh chứng minh) và mã QR dẫn tới trang kể chuyện.                     |
| **Báo giá & Điều phối** | Khách sỉ gửi Yêu cầu báo giá → các hộ phù hợp chào giá → chốt → sản xuất → giao; BQL chia nhỏ đơn lớn cho nhiều hộ. |
| **Bản đồ làng nghề**    | Bản đồ tương tác hiển thị xưởng, trạng thái mở cửa đón khách tham quan/trải nghiệm.                                 |

Dữ liệu mẫu (seed) dùng **Làng gốm Bát Tràng** (Gia Lâm, Hà Nội); hệ thống cấu hình được cho làng nghề khác (vd. Lụa Vạn Phúc) qua bảng mẫu công đoạn sản xuất theo danh mục.

**Ngoài phạm vi (Won't have, phiên bản này):** thanh toán trực tuyến, tích hợp vận chuyển, ứng dụng di động native, hóa đơn điện tử.

### 1.3 Thuật ngữ

| Thuật ngữ                               | Định nghĩa                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **BQL / Admin**                         | Ban quản lý làng nghề (Chủ tịch xã / Hội làng nghề).                                                            |
| **Hộ / Nghệ nhân (Artisan)**            | Hộ gia đình sản xuất trong làng, đã được BQL kiểm duyệt. Một tài khoản đại diện một hộ.                         |
| **Xưởng (Workshop)**                    | Địa điểm sản xuất vật lý của hộ, có tọa độ và giờ mở cửa.                                                       |
| **Khách (Buyer)**                       | Khách mua lẻ, khách du lịch hoặc doanh nghiệp mua sỉ.                                                           |
| **Khách vãng lai (Guest)**              | Người dùng chưa đăng nhập.                                                                                      |
| **Nhật ký sản xuất (Production Log)**   | Chuỗi các **Mốc** (milestone) theo thời gian, mỗi mốc gắn công đoạn, ghi chú và ảnh chứng minh.                 |
| **Công đoạn (Stage)**                   | Bước chuẩn trong quy trình của một danh mục (Gốm: Nhào đất → Vuốt → Phơi → Vẽ → Tráng men → Nung → Thành phẩm). |
| **Mã truy xuất (Trace code)**           | Mã ngắn duy nhất của sản phẩm, được mã hóa trong QR.                                                            |
| **Yêu cầu báo giá (RFQ)**               | Quote Request — nhu cầu mua sỉ của Khách (số lượng, hạn, yêu cầu tùy biến).                                     |
| **Chào giá (Bid)**                      | Phản hồi của Hộ cho một RFQ: đơn giá, số lượng đáp ứng, thời gian hoàn thành.                                   |
| **Chào giá liên kết (Cooperative bid)** | Chào giá do BQL lập thay mặt nhiều hộ, kèm phương án chia.                                                      |
| **Đơn hàng (Order)**                    | Hợp đồng hình thành khi Khách chốt một chào giá.                                                                |
| **Phân bổ (Allocation)**                | Phần việc của một Hộ trong một Đơn hàng (số lượng, đơn giá, hạn).                                               |
| **Chia nhỏ (Split)**                    | Hành động BQL phân Đơn hàng thành nhiều Phân bổ.                                                                |

### 1.4 Quy ước

- Mã yêu cầu: `FR-<NHÓM>-<số>` (chức năng), `NFR-<NHÓM>-<số>` (phi chức năng), `BR-<số>` (quy tắc nghiệp vụ).
- Mức ưu tiên MoSCoW: **M** = Must (bắt buộc cho demo), **S** = Should (cần để đạt điểm tối đa), **C** = Could (điểm cộng "wow").
- Mọi thời gian lưu UTC, hiển thị theo `Asia/Ho_Chi_Minh`. Tiền tệ gốc VND (số nguyên).

---

## 2. Mô tả tổng quan

### 2.1 Bối cảnh

Làng nghề gặp ba vấn đề: (1) sản phẩm thật bị trà trộn hàng nhái, người mua không phân biệt được; (2) câu chuyện và giá trị tay nghề không được truyền tải; (3) đơn hàng sỉ lớn vượt năng lực một hộ, việc gom và chia đơn hiện làm thủ công qua điện thoại. vCraft giải quyết bằng định danh hộ đã kiểm duyệt, nhật ký sản xuất chống sửa đổi + QR, và luồng báo giá/điều phối có kiểm soát trạng thái.

### 2.2 Các lớp người dùng

| Vai trò     | Đặc điểm                                                        | Thiết bị chính                    | Mục tiêu                                                    |
| ----------- | --------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| Guest       | Du khách, người quét QR trên sản phẩm                           | Điện thoại (≥ 70%)                | Xem nhanh, tin tưởng nguồn gốc, tìm xưởng mở cửa            |
| Buyer       | Khách lẻ/sỉ, có thể là doanh nghiệp, có thể là người nước ngoài | Desktop + mobile                  | Tìm hộ phù hợp, gửi RFQ, so sánh chào giá, theo dõi tiến độ |
| Artisan     | Hộ sản xuất, kỹ năng số trung bình–thấp, thao tác tại xưởng     | **Điện thoại** (chụp ảnh tại chỗ) | Đăng sản phẩm/mốc nhanh, nhận RFQ, chào giá                 |
| Admin (BQL) | Cán bộ xã/hội nghề                                              | Desktop                           | Kiểm duyệt hộ, đăng tin, điều phối đơn lớn                  |
| System      | Tiến trình nền                                                  | —                                 | Tối ưu ảnh, hết hạn chào giá, gửi thông báo                 |

### 2.3 Môi trường vận hành

- Trình duyệt: 2 phiên bản mới nhất của Chrome, Edge, Firefox, Safari (macOS/iOS), Samsung Internet. WebGL2 là tùy chọn (có fallback).
- Màn hình từ 360px đến 2560px.
- Máy chủ: container Linux (Docker), CSDL quan hệ PostgreSQL hoặc MySQL.

### 2.4 Ràng buộc

- C1 — Nhóm 3 sinh viên, khoảng 9 tuần.
- C2 — Chấm bằng **demo trực tiếp + vấn đáp**; không có slide/tài liệu nộp ⇒ mọi tiêu chí phải **nhìn thấy được trên sản phẩm** hoặc chỉ ra được trong code trong ≤ 30 giây.
- C3 — Tự chọn công nghệ.
- C4 — Bản đồ dùng Google Maps API hoặc thư viện mã nguồn mở (Leaflet/MapLibre…).
- C5 — Mã QR phải quét được bằng điện thoại của giám khảo ⇒ cần URL công khai HTTPS lúc demo.

### 2.5 Giả định & phụ thuộc

- A1 — Một triển khai phục vụ một làng nghề (single-tenant), cấu hình được tên/màu nhấn/danh mục.
- A2 — Hộ có điện thoại chụp ảnh và kết nối 4G.
- A3 — Dữ liệu địa giới dùng mô hình **2 cấp (Tỉnh/Thành → Xã/Phường)** sau sắp xếp đơn vị hành chính có hiệu lực 01/07/2025.
- A4 — Ảnh seed do nhóm tự chụp tại Bát Tràng hoặc nguồn có giấy phép phù hợp.
- A5 — Danh tính người dùng do **Supabase Auth** (project `owwxkyumisfcqzahfhbn`) cấp; CSDL nghiệp vụ của vCraft độc lập với Supabase và chỉ tham chiếu `user.id` (UUID) của Supabase.

---

## 3. Yêu cầu chức năng

### 3.1 Xác thực, phiên & tài khoản — `FR-AUTH`

Xác thực dùng **Supabase Auth** làm nhà cung cấp danh tính (IdP) bên ngoài. vCraft **không lưu mật khẩu**; backend chỉ kiểm chứng JWT do Supabase ký và tự quản lý **hồ sơ, vai trò, trạng thái** người dùng trong CSDL của mình (xem [ARCHITECTURE §7.5](ARCHITECTURE.md#75-xác-thực-với-supabase-auth)).

| ID         | Yêu cầu                                                                                                                                                                                                                                         | Ưu tiên | Tiêu chí chấp nhận                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| FR-AUTH-01 | Buyer tự đăng ký bằng email + mật khẩu qua Supabase Auth, **xác minh email** bằng liên kết (mẫu email tiếng Việt mang thương hiệu vCraft).                                                                                                      | M       | Chưa xác minh thì không đăng nhập được.                                                  |
| FR-AUTH-02 | Hộ đăng ký qua **wizard nhiều bước**: Tài khoản (Supabase sign-up) → Thông tin hộ → Vị trí xưởng (chọn trên bản đồ) → Giấy tờ xác minh. Hồ sơ hộ sau khi nộp: `PENDING_REVIEW`.                                                                 | M       | Hộ đang chờ duyệt chỉ xem được trạng thái hồ sơ, API từ chối mọi thao tác đăng sản phẩm. |
| FR-AUTH-03 | Admin **mời** hộ qua email (`auth.admin.inviteUserByEmail` gọi từ backend bằng secret key); hộ bấm link để đặt mật khẩu.                                                                                                                        | S       | Link mời dùng một lần.                                                                   |
| FR-AUTH-04 | Đăng nhập email + mật khẩu; tùy chọn **Google OAuth** cho Buyer. Phiên do Supabase quản lý: access token JWT ngắn hạn (cấu hình 15 phút) + refresh token **xoay vòng có phát hiện dùng lại** (tính năng sẵn có của Supabase).                   | M       | Hết hạn access token, client tự làm mới không gián đoạn.                                 |
| FR-AUTH-05 | Trang **Bảo mật tài khoản**: lịch sử đăng nhập (thời điểm, trình duyệt, vị trí thô — vCraft tự ghi), **đăng xuất khỏi các thiết bị khác** / **tất cả thiết bị** (`signOut({ scope: 'others' \| 'global' })`).                                   | S       | Sau khi đăng xuất toàn bộ, refresh token cũ không dùng được.                             |
| FR-AUTH-06 | Quên mật khẩu qua email (Supabase recovery); đổi mật khẩu ⇒ đăng xuất các thiết bị khác.                                                                                                                                                        | M       | —                                                                                        |
| FR-AUTH-07 | Chống dò mật khẩu: giới hạn tần suất của Supabase Auth + **CAPTCHA (Cloudflare Turnstile)** trên form đăng ký/đăng nhập/quên mật khẩu.                                                                                                          | S       | Thông báo lỗi không tiết lộ email có tồn tại hay không.                                  |
| FR-AUTH-08 | **MFA TOTP** (Supabase MFA): bắt buộc với Admin — API từ chối route Admin nếu JWT chưa đạt `aal2`.                                                                                                                                              | S       | Admin đăng nhập phải nhập mã 6 số.                                                       |
| FR-AUTH-09 | Phân quyền theo vai trò **và** quyền sở hữu (RBAC + ABAC). Vai trò và trạng thái lấy từ CSDL vCraft (nguồn sự thật), **không** tin vào dữ liệu client gửi lên. Ma trận ở [ARCHITECTURE §8.3](ARCHITECTURE.md#83-ma-trận-phân-quyền-rbac--abac). | M       | Gọi API sửa sản phẩm của hộ khác ⇒ 403.                                                  |
| FR-AUTH-10 | Admin **tạm khóa** người dùng: cập nhật trạng thái trong CSDL vCraft (chặn ngay ở API) **và** cấm tài khoản trên Supabase (`ban_duration`) để không làm mới được phiên.                                                                         | S       | Người bị khóa nhận 403 ngay ở request kế tiếp.                                           |

### 3.2 Kiểm duyệt hộ — `FR-ADM`

| ID        | Yêu cầu                                                                                                                                                                | Ưu tiên | Tiêu chí chấp nhận                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| FR-ADM-01 | Hàng đợi hồ sơ chờ duyệt, lọc theo trạng thái/ngày, đếm số chờ trên menu (badge).                                                                                      | M       | —                                         |
| FR-ADM-02 | Màn hình duyệt **song song**: thông tin khai báo ↔ giấy tờ (CCCD, xác nhận cư trú, ảnh xưởng) ↔ vị trí trên bản đồ có kiểm tra **nằm trong ranh giới làng** (polygon). | M       | Xưởng ngoài ranh giới hiện cảnh báo đỏ.   |
| FR-ADM-03 | Hành động: **Duyệt** (hiệu ứng đóng ấn triện, gửi email), **Từ chối** (bắt buộc lý do), **Yêu cầu bổ sung** (hộ sửa và nộp lại).                                       | M       | Mọi hành động ghi Audit log.              |
| FR-ADM-04 | Tạm khóa / mở khóa hộ (vd. phát hiện bán hàng nhái); sản phẩm của hộ bị khóa ẩn khỏi danh mục, trang QR hiện cảnh báo.                                                 | S       | —                                         |
| FR-ADM-05 | Nhật ký kiểm toán (Audit log): ai, làm gì, lúc nào, trên đối tượng nào, giá trị trước/sau.                                                                             | S       | Lọc theo người, loại hành động.           |
| FR-ADM-06 | Dashboard BQL: số hộ hoạt động, hồ sơ chờ duyệt, RFQ đang mở, đơn đang sản xuất, lượt quét QR 30 ngày, biểu đồ xu hướng.                                               | S       | Số liệu cập nhật không cần tải lại trang. |

### 3.3 Hồ sơ hộ & xưởng — `FR-ART`

| ID        | Yêu cầu                                                                                                                                                                                                     | Ưu tiên | Tiêu chí chấp nhận                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| FR-ART-01 | Hồ sơ hộ: tên hộ, slug, danh mục nghề, năm thành lập, số đời làm nghề, câu chuyện (rich text), ảnh bìa, ảnh chân dung, **chữ ký/ấn riêng** của nghệ nhân.                                                   | M       | Slug tự sinh từ tên tiếng Việt, kiểm tra trùng realtime. |
| FR-ART-02 | **Dòng thời gian lịch sử gia đình**: các sự kiện (năm, tiêu đề, mô tả, ảnh).                                                                                                                                | M       | Hiển thị dạng timeline cuộn có hiệu ứng.                 |
| FR-ART-03 | **Chứng nhận chất lượng**: tên (vd. "Nghệ nhân Nhân dân", "OCOP 4 sao"), đơn vị cấp, ngày cấp, ảnh; Admin đánh dấu "đã xác minh".                                                                           | M       | Chứng nhận chưa xác minh hiện nhãn khác.                 |
| FR-ART-04 | Thư viện ảnh xưởng (upload nhiều ảnh, kéo-thả sắp xếp, chú thích, alt text bắt buộc).                                                                                                                       | M       | —                                                        |
| FR-ART-05 | Thông tin xưởng: địa chỉ, tọa độ (chọn trên bản đồ / "dùng vị trí hiện tại"), **giờ mở cửa theo tuần**, cờ "đón khách tham quan", "có trải nghiệm" (mô tả, thời lượng, giá), cờ **tạm đóng cửa** kèm lý do. | M       | Trạng thái "Đang mở cửa" tính theo giờ Việt Nam.         |
| FR-ART-06 | **Năng lực sản xuất** theo danh mục (đơn vị/tháng) — dùng cho ghép RFQ và chia đơn.                                                                                                                         | M       | —                                                        |
| FR-ART-07 | Chỉ số **độ hoàn thiện hồ sơ** (%) kèm gợi ý mục còn thiếu.                                                                                                                                                 | C       | —                                                        |
| FR-ART-08 | **Gợi ý viết câu chuyện** bằng AI: hộ nhập ý chính, hệ thống gợi ý đoạn văn và bản dịch tiếng Anh, hộ duyệt trước khi lưu.                                                                                  | C       | Không tự động đăng khi chưa duyệt.                       |

### 3.4 Sản phẩm & Nhật ký sản xuất — `FR-PRD`

| ID        | Yêu cầu                                                                                                                                                                                                        | Ưu tiên | Tiêu chí chấp nhận                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| FR-PRD-01 | Hộ tạo/sửa/lưu trữ sản phẩm: tên, slug, danh mục, mô tả, chất liệu, kích thước, khối lượng, **giá bán (VND)**, cờ **độc bản**, tồn kho, tag. Trạng thái `DRAFT → PUBLISHED → ARCHIVED` (+ `SOLD` cho độc bản). | M       | —                                                                                                  |
| FR-PRD-02 | Upload **nhiều ảnh** (tối đa 12/sản phẩm, ≤ 15 MB/ảnh, JPEG/PNG/WebP/HEIC), thanh tiến độ từng ảnh, kéo-thả đổi thứ tự, chọn ảnh bìa.                                                                          | M       | Ảnh hiển thị placeholder mờ (thumbhash) ngay khi upload xong, thay bằng bản tối ưu khi xử lý xong. |
| FR-PRD-03 | **Nhật ký sản xuất**: chọn danh mục ⇒ tự nạp **mẫu công đoạn** (Gốm: Nhào đất → Vuốt → Phơi → Vẽ → Tráng men → Nung → Thành phẩm). Mỗi **mốc**: công đoạn, thời điểm, ghi chú, 1–6 ảnh chứng minh.             | M       | Một sản phẩm có ≥ 1 mốc mới được xuất bản.                                                         |
| FR-PRD-04 | Thêm mốc nhanh từ điện thoại: nút "Thêm mốc" mở camera (`capture`), **tự điền ngày giờ từ EXIF** của ảnh.                                                                                                      | S       | Ngày EXIF khác hiện tại > 30 ngày ⇒ hỏi xác nhận.                                                  |
| FR-PRD-05 | Nhật ký **chỉ được ghi thêm (append-only)** sau khi xuất bản; sửa sai bằng mốc "đính chính" tham chiếu mốc cũ. Mỗi mốc lưu `hash = SHA-256(nội dung ‖ checksum ảnh ‖ hash mốc trước)` (BR-01).                 | S       | Sửa trực tiếp DB ⇒ trang truy xuất báo "chuỗi nhật ký bị phá vỡ".                                  |
| FR-PRD-06 | Nhân bản sản phẩm (dùng cho dòng sản phẩm tương tự) — không nhân bản nhật ký.                                                                                                                                  | C       | —                                                                                                  |
| FR-PRD-07 | Gợi ý giá bán dựa trên trung vị giá sản phẩm cùng danh mục/kích thước.                                                                                                                                         | C       | —                                                                                                  |

### 3.5 Truy xuất nguồn gốc & QR — `FR-TRC`

| ID        | Yêu cầu                                                                                                                                                                                                                                                             | Ưu tiên | Tiêu chí chấp nhận                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| FR-TRC-01 | Hệ thống **tự sinh mã truy xuất** ngắn (8 ký tự, bảng chữ không gây nhầm, vd. `BT7K2QXM`) khi sản phẩm được tạo.                                                                                                                                                    | M       | Duy nhất toàn hệ thống.                                            |
| FR-TRC-02 | Sinh **mã QR** chứa URL ngắn `https://<domain>/q/<code>`; QR có thương hiệu (khung ấn triện, logo giữa, mức sửa lỗi H). Tải về SVG/PNG.                                                                                                                             | M       | Quét được bằng camera mặc định iOS/Android ở kích thước in 2×2 cm. |
| FR-TRC-03 | `/q/<code>` chuyển hướng (308) tới trang truy xuất theo ngôn ngữ trình duyệt: `/vi/truy-xuat/<code>` hoặc `/en/trace/<code>`.                                                                                                                                       | M       | —                                                                  |
| FR-TRC-04 | **Landing page truy xuất** kể chuyện theo cuộn: ảnh sản phẩm → nghệ nhân & xưởng → dòng thời gian các mốc (ngày, ảnh, ghi chú) từ ngày đầu tiên → bản đồ mini vị trí xưởng → chứng nhận → huy hiệu "Hộ đã được BQL xác minh" → CTA "Ghé xưởng" / "Yêu cầu báo giá". | M       | Tải lần đầu trên 4G: LCP ≤ 2.5s.                                   |
| FR-TRC-05 | Trình duyệt **tự kiểm chứng chuỗi băm** (Web Crypto) và hiển thị trạng thái "Nhật ký toàn vẹn" / "Có dấu hiệu chỉnh sửa".                                                                                                                                           | S       | —                                                                  |
| FR-TRC-06 | Ghi nhận lượt quét (thời gian, quốc gia, loại thiết bị — không lưu IP thô); Hộ xem thống kê lượt quét theo sản phẩm.                                                                                                                                                | S       | —                                                                  |
| FR-TRC-07 | In **tờ tem QR** A4 (nhiều tem/tờ) cho nhiều sản phẩm một lần (PDF).                                                                                                                                                                                                | C       | —                                                                  |
| FR-TRC-08 | Trang truy xuất của sản phẩm thuộc hộ bị khóa / mã không tồn tại hiển thị cảnh báo hàng không xác thực.                                                                                                                                                             | M       | —                                                                  |

### 3.6 Danh mục & khám phá — `FR-CAT`

| ID        | Yêu cầu                                                                                                                                                                            | Ưu tiên | Tiêu chí chấp nhận                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------ |
| FR-CAT-01 | Xem sản phẩm **theo Phân loại** (cây danh mục) và **theo Hộ gia đình**.                                                                                                            | M       | —                                          |
| FR-CAT-02 | Bộ lọc: danh mục, hộ, khoảng giá, độc bản, còn hàng, có xưởng mở cửa; sắp xếp: mới nhất, giá, phổ biến. Bộ lọc **đồng bộ lên URL** và tải kết quả bằng fetch, không tải lại trang. | M       | Copy URL sang tab khác ⇒ cùng kết quả.     |
| FR-CAT-03 | **Cuộn vô hạn** với phân trang con trỏ (cursor), 24 sản phẩm/lần, skeleton khi tải.                                                                                                | M       | 500 sản phẩm vẫn mượt (≥ 55 fps khi cuộn). |
| FR-CAT-04 | Tìm kiếm **không dấu** ("bat trang" khớp "Bát Tràng"), gợi ý tức thời (sản phẩm, hộ, danh mục, tin tức) trong bảng lệnh `⌘K` / `Ctrl K`.                                           | M       | Gợi ý hiện sau ≤ 300 ms (debounce 150 ms). |
| FR-CAT-05 | Trang chi tiết sản phẩm: gallery có zoom, thông tin, tóm tắt nhật ký, QR, sản phẩm cùng hộ.                                                                                        | M       | —                                          |
| FR-CAT-06 | Trang hồ sơ hộ công khai (triển lãm số): hero, câu chuyện, timeline gia đình, chứng nhận, xưởng & giờ mở cửa, gallery, sản phẩm.                                                   | M       | —                                          |
| FR-CAT-07 | Danh sách yêu thích (lưu cục bộ khi chưa đăng nhập, đồng bộ khi đăng nhập).                                                                                                        | C       | —                                          |
| FR-CAT-08 | Song ngữ **vi/en**, hiển thị giá quy đổi tham khảo USD cho khách nước ngoài.                                                                                                       | S       | —                                          |

### 3.7 Bản đồ làng nghề — `FR-MAP`

| ID        | Yêu cầu                                                                                                                                                            | Ưu tiên | Tiêu chí chấp nhận |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------ |
| FR-MAP-01 | Bản đồ tương tác (MapLibre GL) hiển thị **ghim** tại (lat, lng) của mỗi xưởng đã duyệt.                                                                            | M       | —                  |
| FR-MAP-02 | Click ghim ⇒ **popup** tóm tắt: ảnh bìa, tên hộ, nghề, trạng thái "Đang mở cửa / Đóng cửa – mở lại lúc …", có trải nghiệm hay không, nút "Xem xưởng", "Chỉ đường". | M       | —                  |
| FR-MAP-03 | Bộ lọc: **đang mở cửa**, đón khách tham quan, có trải nghiệm, theo nghề. Ghim đang mở có hiệu ứng "nhịp thở".                                                      | M       | —                  |
| FR-MAP-04 | Gom cụm ghim (clustering) khi thu nhỏ; tải ghim theo khung nhìn (bbox) qua API JSON.                                                                               | S       | —                  |
| FR-MAP-05 | Danh sách xưởng bên cạnh bản đồ **đồng bộ hai chiều** (hover thẻ ⇒ nổi ghim; kéo bản đồ ⇒ cập nhật danh sách). Trên mobile: bottom sheet.                          | S       | —                  |
| FR-MAP-06 | Nút "Vị trí của tôi" và sắp xếp xưởng theo khoảng cách.                                                                                                            | S       | —                  |
| FR-MAP-07 | Chế độ thay thế không cần WebGL / cho trình đọc màn hình: danh sách xưởng có đầy đủ thông tin.                                                                     | S       | —                  |
| FR-MAP-08 | Gợi ý **lộ trình tham quan** đi bộ qua các xưởng đang mở.                                                                                                          | C       | —                  |

### 3.8 Yêu cầu báo giá & Chào giá — `FR-RFQ`

| ID        | Yêu cầu                                                                                                                                                                                                                                                  | Ưu tiên | Tiêu chí chấp nhận                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| FR-RFQ-01 | Buyer tạo RFQ: tiêu đề, danh mục, mô tả, **số lượng + đơn vị**, ngân sách dự kiến (khoảng, tùy chọn), **hạn giao hàng**, **hạn chót chào giá**, yêu cầu tùy biến (vd. in logo), tệp đính kèm (logo, bản vẽ), địa chỉ giao; tùy chọn "Nhờ BQL điều phối". | M       | Ví dụ chuẩn: _5.000 cốc in logo Trường ĐH Công nghệ trong 1 tháng_. |
| FR-RFQ-02 | RFQ lưu **nháp** tự động (`DRAFT`), gửi đi ⇒ `SENT`.                                                                                                                                                                                                     | M       | Đóng tab rồi mở lại vẫn còn nháp.                                   |
| FR-RFQ-03 | Khi gửi, hệ thống **ghép hộ phù hợp** (BR-05): cùng nghề, đang hoạt động, năng lực đủ cho ít nhất một phần, điểm uy tín; tạo lời mời và thông báo cho từng hộ.                                                                                           | M       | Buyer thấy "Đã gửi tới N hộ phù hợp".                               |
| FR-RFQ-04 | Hộ xem lời mời (đồng hồ đếm ngược tới hạn chào giá), có thể **từ chối** hoặc **chào giá**: đơn giá, **số lượng có thể đáp ứng** (≤ tổng), thời gian hoàn thành/ngày giao, ghi chú, ảnh mẫu.                                                              | M       | Chào giá đầu tiên chuyển RFQ sang `BIDDING`.                        |
| FR-RFQ-05 | Hộ **sửa chào giá** trước hạn (lưu lịch sử phiên bản), hoặc **rút** chào giá.                                                                                                                                                                            | S       | Sau hạn: nút sửa bị khóa ở cả UI và API.                            |
| FR-RFQ-06 | **Chào giá kín**: hộ không thấy giá của hộ khác (chống thông đồng giá); Buyer thấy tất cả.                                                                                                                                                               | M       | API trả 403 khi hộ cố đọc bid của hộ khác.                          |
| FR-RFQ-07 | Buyer xem **bảng so sánh** chào giá: đơn giá, tổng tiền, ngày giao, uy tín hộ, đáp ứng đủ/một phần; sắp xếp & highlight lựa chọn tốt nhất theo từng tiêu chí. Cập nhật **realtime** khi có chào giá mới.                                                 | M       | Chào giá mới xuất hiện có hiệu ứng, không cần F5.                   |
| FR-RFQ-08 | Buyer**chốt** một chào giá đáp ứng đủ số lượng ⇒ `ACCEPTED`, tạo Đơn hàng; các chào giá khác ⇒ `REJECTED`, gửi thông báo cho tất cả. Có hộp thoại xác nhận.                                                                                              | M       | Hai người chốt đồng thời ⇒ chỉ 1 thành công (§4.4).                 |
| FR-RFQ-09 | Buyer**hủy** RFQ trước khi chốt (bắt buộc lý do).                                                                                                                                                                                                        | M       | —                                                                   |
| FR-RFQ-10 | Hết hạn chào giá mà không có chào giá ⇒ `EXPIRED` (job nền). Có chào giá nhưng Buyer không chốt trong 7 ngày ⇒ `EXPIRED`.                                                                                                                                | S       | —                                                                   |
| FR-RFQ-11 | **Gợi ý giá** khi hộ chào giá: trung vị đơn giá các đơn đã chốt cùng danh mục, quy mô tương tự.                                                                                                                                                          | C       | —                                                                   |
| FR-RFQ-12 | Thanh tiến trình trạng thái (stepper) thống nhất trên mọi màn hình RFQ, chỉ hiện các hành động hợp lệ theo trạng thái + vai trò hiện tại (lấy từ cùng máy trạng thái với backend).                                                                       | M       | —                                                                   |
| FR-RFQ-13 | Nhân bản RFQ cũ thành nháp mới.                                                                                                                                                                                                                          | C       | —                                                                   |

### 3.9 Đơn hàng, Điều phối & Chia nhỏ — `FR-ORD`

| ID        | Yêu cầu                                                                                                                                                                                                                                                       | Ưu tiên | Tiêu chí chấp nhận                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------- |
| FR-ORD-01 | RFQ được đánh dấu **"Cần điều phối"** khi: Buyer chọn "Nhờ BQL điều phối", **hoặc** đến 50% thời gian chào giá vẫn chưa có chào giá nào đáp ứng đủ số lượng.                                                                                                  | M       | Hiển thị trong hàng đợi Điều phối của Admin.       |
| FR-ORD-02 | Admin **nhận điều phối** RFQ (khóa: một RFQ chỉ một Admin điều phối).                                                                                                                                                                                         | M       | —                                                  |
| FR-ORD-03 | Màn hình **Chia đơn**: chọn chiến lược đề xuất (BR-06) — _Theo năng lực_, _Giá thấp trước_, _Cân bằng_ — hệ thống sinh phương án; Admin chỉnh tay bằng thanh trượt/kéo-thả; luôn hiển thị **tổng = số lượng yêu cầu**, tổng chi phí, ngày hoàn thành dự kiến. | M       | Không lưu được khi Σ ≠ tổng hoặc vượt năng lực hộ. |
| FR-ORD-04 | Admin gửi phương án dưới dạng **Chào giá liên kết** (bid của BQL) cho Buyer; Buyer chốt như chào giá thường.                                                                                                                                                  | M       | —                                                  |
| FR-ORD-05 | Khi chốt, Đơn hàng sinh các **Phân bổ** `PROPOSED`; mỗi hộ **xác nhận** hoặc **từ chối**; từ chối ⇒ Admin phân bổ lại phần đó.                                                                                                                                | M       | —                                                  |
| FR-ORD-06 | Khi tất cả phân bổ `CONFIRMED`, Admin/Hộ bấm "Bắt đầu sản xuất" ⇒ RFQ `IN_PRODUCTION`.                                                                                                                                                                        | M       | —                                                  |
| FR-ORD-07 | Hộ cập nhật **tiến độ** phân bổ (số lượng đã xong, ghi chú, ảnh); Đơn hàng hiển thị tiến độ tổng (%), **biểu đồ Gantt** các phân bổ, cảnh báo phân bổ có nguy cơ trễ.                                                                                         | M       | —                                                  |
| FR-ORD-08 | Khi mọi phân bổ `DONE`, Buyer (hoặc Admin thay mặt) **xác nhận đã nhận hàng** ⇒ `DELIVERED`.                                                                                                                                                                  | M       | —                                                  |
| FR-ORD-09 | Admin **chia lại** đơn của một hộ đơn lẻ đang trễ: chuyển phần chưa làm sang hộ khác.                                                                                                                                                                         | S       | Lịch sử phân bổ được giữ.                          |
| FR-ORD-10 | Admin tạo RFQ **thay mặt khách ngoài hệ thống** (đơn nhận qua điện thoại) rồi điều phối như thường.                                                                                                                                                           | C       | —                                                  |
| FR-ORD-11 | Buyer đánh giá hộ (1–5 sao + nhận xét) sau khi giao; điểm dùng cho ghép RFQ.                                                                                                                                                                                  | C       | —                                                  |

### 3.10 Tin tức cộng đồng — `FR-NEWS`

| ID         | Yêu cầu                                                                                                                                                                           | Ưu tiên | Tiêu chí chấp nhận                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| FR-NEWS-01 | Admin CRUD tin: tiêu đề, slug, tóm tắt, ảnh bìa, nội dung rich text (editor khối), chuyên mục: **Giá nguyên vật liệu**, **Lịch cúp điện**, **Chính sách hỗ trợ**, Sự kiện, Chung. | M       | Nội dung HTML được làm sạch (chống XSS). |
| FR-NEWS-02 | Phạm vi hiển thị: **Công khai** hoặc **Chỉ hộ trong làng**; ghim tin; **hẹn giờ đăng**.                                                                                           | M       | Tin "chỉ hộ" trả 404 với khách.          |
| FR-NEWS-03 | Tin "Lịch cúp điện" có trường cấu trúc (khu vực, từ–đến) ⇒ hiện **banner cảnh báo** trong Studio các hộ bị ảnh hưởng trong ngày.                                                  | S       | —                                        |
| FR-NEWS-04 | Tin "Giá nguyên vật liệu" có bảng giá cấu trúc (vật liệu, đơn vị, giá) ⇒ **biểu đồ biến động giá** theo thời gian.                                                                | S       | —                                        |
| FR-NEWS-05 | Đăng tin quan trọng ⇒ thông báo in-app + email tới các hộ.                                                                                                                        | S       | —                                        |

### 3.11 Thông báo — `FR-NOTI`

| ID         | Yêu cầu                                                                                                                              | Ưu tiên | Tiêu chí chấp nhận                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------ |
| FR-NOTI-01 | Chuông thông báo in-app **realtime** (SSE): lời mời RFQ, chào giá mới, được chốt/bị từ chối, phân bổ mới, hồ sơ được duyệt, tin mới. | M       | Thông báo đến không cần tải lại; bấm vào ⇒ đi thẳng tới đối tượng. |
| FR-NOTI-02 | Email cho sự kiện quan trọng (duyệt hồ sơ, lời mời RFQ, chốt giá), có thể tắt theo loại.                                             | S       | —                                                                  |
| FR-NOTI-03 | Đánh dấu đã đọc / đọc tất cả.                                                                                                        | M       | —                                                                  |

### 3.12 Media — `FR-MEDIA`

| ID          | Yêu cầu                                                                                                                                                                                                                            | Ưu tiên | Tiêu chí chấp nhận                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| FR-MEDIA-01 | Upload nhiều ảnh song song (tối đa 4 luồng), hiển thị % từng ảnh, hủy/thử lại từng ảnh.                                                                                                                                            | M       | —                                                                               |
| FR-MEDIA-02 | Client **nén/thu nhỏ trước** khi upload (cạnh dài ≤ 2560px), chuyển HEIC → JPEG; đọc EXIF ngày chụp **trước khi** server xóa EXIF.                                                                                                 | S       | Ảnh 12 MB từ điện thoại upload còn ~1.5 MB.                                     |
| FR-MEDIA-03 | Backend kiểm tra **magic bytes**, giới hạn kích thước & số điểm ảnh, **xóa toàn bộ EXIF/GPS**, sinh biến thể **AVIF + WebP** ở 4 kích thước (320/640/1280/2048), **thumbhash** và màu chủ đạo; xử lý **bất đồng bộ** qua hàng đợi. | M       | API trả về ngay (202) với trạng thái `PROCESSING`; client nhận `READY` qua SSE. |
| FR-MEDIA-04 | Ảnh giấy tờ xác minh lưu **bucket riêng tư**, chỉ Admin xem qua URL ký có hạn 5 phút.                                                                                                                                              | M       | —                                                                               |
| FR-MEDIA-05 | Chống trùng lặp theo checksum SHA-256 (cùng chủ sở hữu).                                                                                                                                                                           | C       | —                                                                               |

---

## 4. Đặc tả máy trạng thái & quy tắc khóa

### 4.1 Máy trạng thái Yêu cầu báo giá (RFQ)

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Buyer tạo
    DRAFT --> SENT : SUBMIT (Buyer)
    SENT --> BIDDING : RECEIVE_BID (Hộ / BQL – bid đầu tiên)
    BIDDING --> ACCEPTED : ACCEPT_BID (Buyer)
    ACCEPTED --> IN_PRODUCTION : START_PRODUCTION (Admin/Hộ)
    IN_PRODUCTION --> DELIVERED : CONFIRM_DELIVERY (Buyer/Admin)
    DRAFT --> CANCELLED : CANCEL
    SENT --> CANCELLED : CANCEL
    BIDDING --> CANCELLED : CANCEL
    ACCEPTED --> CANCELLED : ADMIN_CANCEL (bắt buộc lý do)
    SENT --> EXPIRED : EXPIRE (System)
    BIDDING --> EXPIRED : EXPIRE (System)
    DELIVERED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
```

| #   | Từ                 | Sự kiện          | Đến           | Tác nhân                        | Điều kiện (guard)                                                                                | Tác dụng phụ                                                                  |
| --- | ------------------ | ---------------- | ------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| T1  | DRAFT              | SUBMIT           | SENT          | Buyer (chủ RFQ)                 | Dữ liệu hợp lệ; `biddingClosesAt ≥ now + 24h`; `requiredBy > biddingClosesAt`; email đã xác minh | Ghép hộ (BR-05), tạo lời mời, thông báo                                       |
| T2  | SENT               | RECEIVE_BID      | BIDDING       | Hộ được mời / Admin             | `now < biddingClosesAt`; chưa có bid của hộ này                                                  | Thông báo Buyer (SSE)                                                         |
| T3  | BIDDING            | ACCEPT_BID       | ACCEPTED      | Buyer (chủ RFQ)                 | Bid `SUBMITTED`; `quantityOffered = quantity`; bid còn hiệu lực; **khóa bi quan** (§4.4)         | Bid khác → `REJECTED`; tạo Order + Allocation(s) `PROPOSED`; thông báo tất cả |
| T4  | ACCEPTED           | START_PRODUCTION | IN_PRODUCTION | Admin điều phối / Hộ (đơn 1 hộ) | Mọi Allocation `CONFIRMED`                                                                       | Allocation → `IN_PROGRESS`                                                    |
| T5  | IN_PRODUCTION      | CONFIRM_DELIVERY | DELIVERED     | Buyer / Admin                   | Mọi Allocation `DONE`                                                                            | Mở đánh giá (FR-ORD-11)                                                       |
| T6  | DRAFT/SENT/BIDDING | CANCEL           | CANCELLED     | Buyer                           | Có lý do (trừ DRAFT)                                                                             | Bid → `LAPSED`; thông báo hộ được mời                                         |
| T7  | ACCEPTED           | ADMIN_CANCEL     | CANCELLED     | Admin                           | Có lý do                                                                                         | Allocation → `CANCELLED`                                                      |
| T8  | SENT/BIDDING       | EXPIRE           | EXPIRED       | System (job)                    | SENT: `now ≥ biddingClosesAt`; BIDDING: `now ≥ biddingClosesAt + 7 ngày` và chưa chốt            | Bid → `LAPSED`                                                                |

Mọi sự kiện không có trong bảng ⇒ lỗi `409 INVALID_TRANSITION` (định dạng lỗi RFC 9457). Bảng này được cài **một lần** trong `packages/domain/src/rfq` và dùng chung cho backend (cưỡng chế) và frontend (hiển thị nút hợp lệ).

### 4.2 Trạng thái Chào giá (Bid)

`SUBMITTED` → (`revise`: vẫn `SUBMITTED`, `revision++`) → `ACCEPTED` | `REJECTED` | `WITHDRAWN` | `LAPSED`.
Thuộc tính `type ∈ {INDIVIDUAL, COOPERATIVE}`; bid `COOPERATIVE` kèm `allocationPlan[]`.

### 4.3 Trạng thái Phân bổ (Allocation)

```mermaid
stateDiagram-v2
    [*] --> PROPOSED
    PROPOSED --> CONFIRMED : Hộ xác nhận
    PROPOSED --> DECLINED : Hộ từ chối
    CONFIRMED --> IN_PROGRESS : RFQ START_PRODUCTION
    IN_PROGRESS --> DONE : completedQty = quantity
    PROPOSED --> CANCELLED
    CONFIRMED --> CANCELLED
    IN_PROGRESS --> CANCELLED : Chia lại (FR-ORD-09)
```

### 4.4 Quy tắc khóa bản ghi & tính nhất quán

| ID    | Quy tắc                                                                                                                                        | Cơ chế                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| BR-L1 | Mọi cập nhật RFQ/Bid/Allocation/Order kèm `version`; phiên bản cũ ⇒ `409 STALE_VERSION`, client tự tải lại và báo "Dữ liệu vừa được cập nhật". | **Khóa lạc quan** (cột `version`, ORM tự kiểm).                   |
| BR-L2 | `ACCEPT_BID`, `START_PRODUCTION`, chia đơn chạy trong **một giao dịch** và khóa dòng RFQ (`SELECT … FOR UPDATE`) trước khi kiểm guard.         | **Khóa bi quan** qua API của ORM (không viết SQL tay).            |
| BR-L3 | Mỗi hộ tối đa **một** bid cho mỗi RFQ.                                                                                                         | Ràng buộc UNIQUE (`rfq_id`, `artisan_id`); sửa = tăng `revision`. |
| BR-L4 | Bid không sửa được khi `now ≥ biddingClosesAt` hoặc RFQ ∉ {SENT, BIDDING}.                                                                     | Guard domain + kiểm tra lại trong giao dịch.                      |
| BR-L5 | Các POST thay đổi trạng thái nhận header `Idempotency-Key`; gửi lặp (double click, mạng chập chờn) trả lại kết quả cũ.                         | Bảng `idempotency_keys` (TTL 24h).                                |
| BR-L6 | Σ `allocation.quantity` (trừ `DECLINED`/`CANCELLED`) = `order.quantity`; `allocation.quantity ≤ năng lực còn trống của hộ`.                    | Bất biến kiểm trong domain trước khi flush.                       |
| BR-L7 | Một RFQ chỉ có một Admin điều phối tại một thời điểm.                                                                                          | Cột `coordinator_id` + khóa lạc quan.                             |
| BR-L8 | Thay đổi trạng thái + ghi sự kiện thông báo nằm cùng giao dịch (**Transactional Outbox**); worker phát đi sau.                                 | Không mất / không gửi thông báo cho giao dịch đã rollback.        |

### 4.5 Các quy tắc nghiệp vụ khác

| ID    | Quy tắc                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | Chuỗi băm nhật ký: `hash_i = SHA-256(canonicalJSON{productId, seq, stageCode, occurredAt, note, mediaChecksums[], prevHash})`, `hash_0.prevHash = "GENESIS"`.                                                                                                             |
| BR-02 | Chỉ hộ `APPROVED` mới có sản phẩm hiển thị công khai và nhận lời mời RFQ.                                                                                                                                                                                                 |
| BR-03 | Trạng thái "Đang mở cửa" = cờ đón khách ∧ ¬tạm đóng ∧ thời điểm hiện tại (giờ VN) nằm trong khung giờ của ngày.                                                                                                                                                           |
| BR-04 | Mã truy xuất dùng bảng 31 ký tự `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (bỏ 0/O/1/I/L), 8 ký tự ⇒ ~8.5×10¹¹ tổ hợp.                                                                                                                                                            |
| BR-05 | **Ghép hộ**: lọc (cùng danh mục ∧ APPROVED ∧ không tạm khóa ∧ năng lực > 0) rồi chấm `score = 0.4·capacityFit + 0.25·rating + 0.2·responseRate + 0.15·onTimeRate`; mời top 10 (cấu hình được) hoặc tất cả.                                                                |
| BR-06 | **Chiến lược chia đơn**: _Theo năng lực_ — chia tỉ lệ năng lực, phần dư theo phương pháp số dư lớn nhất (Hamilton); _Giá thấp trước_ — tham lam theo đơn giá tăng dần tới khi đủ; _Cân bằng_ — chia đều có trần năng lực. Mọi chiến lược tôn trọng BR-L6 và lô tối thiểu. |
| BR-07 | Tiền lưu số nguyên VND; hiển thị `1.250.000 ₫`; quy đổi USD chỉ để tham khảo, tỉ giá cập nhật hằng ngày.                                                                                                                                                                  |

---

## 5. Yêu cầu giao diện ngoài

### 5.1 Giao diện người dùng — sơ đồ trang

| Khu vực                              | URL (vi)                                                                                 | URL (en)                  | Vai trò      |
| ------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------- | ------------ |
| Trang chủ (hero 3D, câu chuyện làng) | `/vi`                                                                                    | `/en`                     | Tất cả       |
| Sản phẩm (danh mục)                  | `/vi/san-pham?danh-muc=binh-gom&gia=…`                                                   | `/en/products?category=…` | Tất cả       |
| Chi tiết sản phẩm                    | `/vi/san-pham/binh-hut-loc-men-lam-bt7k2qxm`                                             | `/en/products/…`          | Tất cả       |
| Hộ nghệ nhân (danh sách / triển lãm) | `/vi/nghe-nhan`, `/vi/nghe-nhan/gom-minh-hai`                                            | `/en/artisans/…`          | Tất cả       |
| Bản đồ làng                          | `/vi/ban-do`                                                                             | `/en/map`                 | Tất cả       |
| Truy xuất QR                         | `/q/BT7K2QXM` → `/vi/truy-xuat/BT7K2QXM`                                                 | `/en/trace/…`             | Tất cả       |
| Tin tức                              | `/vi/tin-tuc`, `/vi/tin-tuc/<slug>`                                                      | `/en/news/…`              | Tất cả       |
| Đăng nhập / Đăng ký / Đăng ký hộ     | `/vi/dang-nhap`, `/vi/dang-ky`, `/vi/dang-ky-nghe-nhan`                                  | `/en/login`…              | Guest        |
| Yêu cầu báo giá của tôi              | `/vi/yeu-cau-bao-gia`, `/vi/yeu-cau-bao-gia/RFQ-2026-000123`                             | `/en/quotes/…`            | Buyer        |
| Studio nghệ nhân                     | `/vi/studio`, `/studio/san-pham`, `/studio/bao-gia`, `/studio/don-hang`, `/studio/ho-so` | `/en/studio/…`            | Artisan      |
| Bảng điều khiển BQL                  | `/vi/admin`, `/admin/duyet-ho`, `/admin/dieu-phoi`, `/admin/tin-tuc`, `/admin/nhat-ky`   | `/en/admin/…`             | Admin        |
| Tài khoản & phiên                    | `/vi/tai-khoan/phien-dang-nhap`                                                          | `/en/account/sessions`    | Đã đăng nhập |

Yêu cầu chung UI: trạng thái loading (skeleton), rỗng (minh họa + lời kêu gọi), lỗi (thử lại) cho mọi khối dữ liệu; điều hướng nhất quán; breadcrumb ở trang sâu; thông báo toast; xác nhận cho hành động không thể hoàn tác.

### 5.2 Giao diện phần mềm

- **REST JSON API** `/api/v1/*`, đặc tả OpenAPI 3.1 (trang tài liệu tương tác `/api/docs`), lỗi theo **RFC 9457 Problem Details**.
- **SSE** `/api/v1/events/stream` cho thông báo/realtime.
- **Supabase Auth** (GoTrue): đăng ký, đăng nhập, OAuth Google, MFA TOTP, khôi phục mật khẩu, mời người dùng; backend kiểm chứng JWT qua JWKS bằng `@supabase/server`.
- Bản đồ: MapLibre GL JS + vector tiles (OpenFreeMap; dự phòng tệp PMTiles tự host cho khu vực Bát Tràng).
- Object storage tương thích S3 (MinIO / Cloudflare R2). SMTP cho email.
- Dữ liệu đơn vị hành chính Việt Nam 2 cấp (tệp JSON tĩnh đóng gói cùng app).
- Tùy chọn: Claude API cho gợi ý/dịch câu chuyện (FR-ART-08).

### 5.3 Giao diện phần cứng

Camera điện thoại (chụp ảnh mốc, quét QR bằng camera hệ thống), GPS (vị trí xưởng, "gần tôi").

### 5.4 Giao tiếp

HTTPS (TLS 1.2+), HTTP/2 hoặc HTTP/3 qua reverse proxy Caddy; nén zstd/gzip.

---

## 6. Yêu cầu phi chức năng

### 6.1 Hiệu năng — `NFR-PERF`

| ID          | Yêu cầu                                                                                                                                                    | Chỉ số                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| NFR-PERF-01 | Core Web Vitals (mobile, 4G, p75)                                                                                                                          | LCP ≤ 2.5s · INP ≤ 200ms · CLS ≤ 0.1                                              |
| NFR-PERF-02 | Lighthouse (mobile) trang chủ, danh mục, truy xuất                                                                                                         | Performance ≥ 90 · Accessibility ≥ 95 · Best Practices ≥ 95 · SEO ≥ 95            |
| NFR-PERF-03 | Thời gian phản hồi API (p95, 100 người dùng đồng thời)                                                                                                     | Đọc ≤ 200ms · Ghi ≤ 400ms                                                         |
| NFR-PERF-04 | Sau lần tải đầu, mọi tương tác dữ liệu (lọc, phân trang, chào giá, đổi trạng thái) dùng **fetch + JSON** và cập nhật DOM cục bộ — **không tải lại trang**. | 0 lần full reload trong kịch bản demo                                             |
| NFR-PERF-05 | JS khởi tạo mỗi route (gzip)                                                                                                                               | ≤ 180 KB; cảnh 3D, bản đồ, editor tải lười                                        |
| NFR-PERF-06 | Ảnh danh sách                                                                                                                                              | Dùng biến thể ≤ 640px, `srcset`/`sizes`, lazy-load ngoài màn hình, có placeholder |
| NFR-PERF-07 | Hoạt ảnh                                                                                                                                                   | Chỉ animate `transform`/`opacity`/`filter`; ≥ 55 fps trên điện thoại tầm trung    |

### 6.2 Bảo mật — `NFR-SEC`

| ID         | Yêu cầu                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEC-01 | vCraft không lưu mật khẩu (Supabase Auth băm bằng bcrypt). Chính sách mật khẩu ≥ 10 ký tự, có chữ hoa/thường/số, bật kiểm tra mật khẩu đã lộ (leaked password protection) trên Supabase.                                                                                                           |
| NFR-SEC-02 | Access token JWT ký **bất đối xứng** (signing keys của Supabase), backend kiểm chứng chữ ký qua **JWKS** (không chia sẻ bí mật), kiểm `iss`, `aud`, `exp`. Phiên lưu trong cookie do `@supabase/ssr` quản lý; refresh token xoay vòng + phát hiện dùng lại. Secret key Supabase chỉ nằm ở backend. |
| NFR-SEC-03 | Dữ liệu nhạy cảm (số CCCD, giấy tờ) mã hóa mức trường **AES-256-GCM**, hỗ trợ xoay khóa; giấy tờ ở bucket riêng tư, URL ký 5 phút.                                                                                                                                                                 |
| NFR-SEC-04 | Phòng chống OWASP Top 10: truy vấn tham số hóa qua ORM, làm sạch HTML, **CSP có nonce**, HSTS, chống CSRF (SameSite=Strict + header tùy biến bắt buộc), kiểm tra quyền sở hữu mọi tài nguyên (chống IDOR), giới hạn tần suất (rate limit) toàn cục và cho endpoint xác thực.                       |
| NFR-SEC-05 | Upload: kiểm tra magic bytes, cấm SVG, giới hạn 15 MB / 40 megapixel, **mã hóa lại** ảnh bằng sharp (loại payload ẩn).                                                                                                                                                                             |
| NFR-SEC-06 | Log không chứa mật khẩu/token/CCCD; IP lưu dạng băm có salt.                                                                                                                                                                                                                                       |
| NFR-SEC-07 | Tuân thủ quy định bảo vệ dữ liệu cá nhân của Việt Nam: có trang chính sách quyền riêng tư, xin đồng ý khi thu thập giấy tờ, cho phép người dùng tải/xóa dữ liệu của mình.                                                                                                                          |
| NFR-SEC-08 | Bí mật chỉ nằm trong biến môi trường; `pnpm audit` + Renovate trong CI.                                                                                                                                                                                                                            |

### 6.3 Khả dụng & tiếp cận — `NFR-UX`

| ID        | Yêu cầu                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| NFR-UX-01 | **Responsive** mobile-first; breakpoints 360 / 640 / 768 / 1024 / 1280 / 1536. Studio nghệ nhân dùng tốt hoàn toàn trên điện thoại. |
| NFR-UX-02 | **WCAG 2.2 AA**: tương phản ≥ 4.5:1, điều hướng bàn phím đầy đủ, focus ring rõ, ARIA đúng, alt text bắt buộc.                       |
| NFR-UX-03 | Tôn trọng `prefers-reduced-motion`: tắt cuộn mượt, parallax, 3D tự xoay; giữ chuyển cảnh mờ dần ≤ 150ms.                            |
| NFR-UX-04 | Tác vụ chính ≤ 3 bước: đăng mốc nhật ký, chào giá, chốt giá.                                                                        |
| NFR-UX-05 | Thông điệp lỗi tiếng Việt, cụ thể, chỉ cách sửa; giữ nguyên dữ liệu đã nhập khi lỗi.                                                |
| NFR-UX-06 | Kiểm thử khả dụng với ≥ 5 người dùng (gồm ≥ 1 người lớn tuổi ít dùng công nghệ), mục tiêu SUS ≥ 80.                                 |

### 6.4 Bảo trì & chất lượng mã — `NFR-MAIN`

| ID          | Yêu cầu                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| NFR-MAIN-01 | Monorepo, ranh giới gói được kiểm bằng công cụ (dependency-cruiser) trong CI.                                      |
| NFR-MAIN-02 | TypeScript strict toàn bộ; schema Zod là nguồn sự thật duy nhất cho kiểm tra dữ liệu FE + BE.                      |
| NFR-MAIN-03 | Phủ test: `packages/domain` ≥ 95% dòng; API ≥ 70%; E2E cho 3 hành trình vai trò.                                   |
| NFR-MAIN-04 | Conventional Commits, PR được review, CI xanh mới merge.                                                           |
| NFR-MAIN-05 | Chú thích JSDoc cho API công khai của các package và mọi quy tắc nghiệp vụ không hiển nhiên (tham chiếu mã BR/FR). |

### 6.5 Khả chuyển — `NFR-PORT`

| ID          | Yêu cầu                                                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-PORT-01 | **Độc lập CSDL**: chạy trên PostgreSQL và MySQL chỉ bằng đổi `DB_DRIVER`; không dùng tính năng riêng của một hệ (PostGIS, mảng, toán tử JSONB, full-text riêng). Khóa chính UUID v7 sinh ở ứng dụng; tìm kiếm không dấu dùng cột chuẩn hóa sinh ở ứng dụng. |
| NFR-PORT-02 | Toàn bộ hệ thống khởi động bằng Docker Compose một lệnh.                                                                                                                                                                                                    |
| NFR-PORT-03 | Lưu trữ file qua cổng trừu tượng (S3-compatible / local disk).                                                                                                                                                                                              |

### 6.6 Tin cậy — `NFR-REL`

- NFR-REL-01 — Health check `/api/v1/health` (DB, Redis, storage).
- NFR-REL-02 — Job nền thử lại có backoff (3 lần), job lỗi vào hàng đợi lỗi để xem lại.
- NFR-REL-03 — Sao lưu CSDL hằng ngày (bản triển khai demo).

### 6.7 Quốc tế hóa & SEO — `NFR-I18N`

- NFR-I18N-01 — Tiếng Việt (mặc định) + tiếng Anh; URL bản địa hóa; chuyển ngôn ngữ giữ nguyên trang hiện tại.
- NFR-I18N-02 — Metadata, Open Graph image động cho sản phẩm/hộ/trang truy xuất (chia sẻ Facebook/Zalo hiển thị đẹp); `sitemap.xml`, `robots.txt`, `hreflang`, URL canonical, dữ liệu cấu trúc schema.org `Product` / `LocalBusiness`.

---

## 7. Yêu cầu dữ liệu

Thực thể chính (chi tiết thuộc tính, quan hệ, chỉ mục ở [ARCHITECTURE §6](ARCHITECTURE.md#6-mô-hình-dữ-liệu)):

`User` (hồ sơ + vai trò, khóa chính = id người dùng Supabase), `LoginEvent`, `ArtisanProfile`, `VerificationDocument`, `FamilyHistoryEvent`, `Certification`, `Workshop`, `ProductionCapacity`, `Category`, `StageTemplate`, `Product`, `ProductMedia`, `ProductionLogEntry`, `TraceScan`, `MediaAsset`, `QuoteRequest`, `QuoteInvitation`, `Bid`, `BidRevision`, `Order`, `Allocation`, `AllocationProgress`, `News`, `MaterialPrice`, `PowerOutage`, `Notification`, `AuditLog`, `OutboxEvent`, `IdempotencyKey`.

Yêu cầu lưu trữ:
- DR-01 — Xóa mềm (`deletedAt`) cho Product, News, ArtisanProfile; xóa cứng dữ liệu cá nhân khi người dùng yêu cầu (trừ bản ghi giao dịch cần giữ, được ẩn danh hóa).
- DR-02 — `ProductionLogEntry`, `BidRevision`, `AuditLog` là **append-only**.
- DR-03 — Dữ liệu seed: 1 làng (Bát Tràng), ≥ 20 hộ, ≥ 200 sản phẩm, mỗi sản phẩm 4–7 mốc, ≥ 10 RFQ ở đủ mọi trạng thái, ≥ 15 tin tức.

---

## 8. Ma trận truy vết: Tiêu chí chấm ↔ Yêu cầu

| #   | Tiêu chí (hệ số)                           | Yêu cầu đáp ứng                                                              | Bằng chứng khi demo                                                                                                                                          |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Chức năng & features (0.35)                | Toàn bộ FR-AUTH…FR-MEDIA mức M + S; nhóm C làm điểm cộng                     | Kịch bản demo 3 vai trò ([PLAN §6](PLAN.md#6-kịch-bản-demo-vấn-đáp))                                                                                         |
| 2   | Thiết kế: logic, dễ dùng (0.1)             | FR-RFQ-12, NFR-UX-04/05/06, §5.1                                             | Stepper trạng thái, hành động theo ngữ cảnh, wizard, kết quả SUS                                                                                             |
| 3   | Giao diện: responsive, đẹp, bản sắc (0.2)  | NFR-UX-01/02/03, [BRAND.md](BRAND.md)                                        | Hero 3D bình gốm, hiệu ứng ấn triện, landing truy xuất; thu nhỏ trình duyệt về 360px                                                                         |
| 4   | Hiệu năng: fetch/AJAX, JSON, DOM (0.1)     | NFR-PERF-01…07, FR-CAT-02/03, FR-RFQ-07, FR-NOTI-01, FR-MAP-04               | DevTools Network: chỉ Fetch/XHR JSON khi lọc/cuộn/chào giá; Lighthouse                                                                                       |
| 5   | Phong cách lập trình (0.05)                | NFR-MAIN-01…05, [ARCHITECTURE §4, §5](ARCHITECTURE.md)                       | Cây monorepo, design patterns có tên, domain thuần, JSDoc                                                                                                    |
| 6   | Xử lý nhập liệu (0.05)                     | FR-AUTH-02, FR-ART-01/05, FR-PRD-03/04, FR-RFQ-01/11, FR-MEDIA-02, FR-CAT-04 | Kiểm tra realtime, tự điền EXIF/địa chỉ/mẫu công đoạn, gợi ý giá, đọc số thành chữ, định dạng tiền                                                           |
| 7   | An ninh (0.05)                             | FR-AUTH-01…10, NFR-SEC-01…08                                                 | Đăng nhập Admin có MFA, đăng xuất mọi thiết bị, giải mã JWT trên jwt.io và giải thích kiểm chứng JWKS, thử truy cập trái phép ⇒ 403, CCCD đã mã hóa trong DB |
| 8   | Viết lại / định tuyến URL (0.05)           | §5.1, FR-TRC-03, NFR-I18N-01/02                                              | `/q/<code>` 308 → URL bản địa hóa; slug tiếng Việt; slug cũ 301 sang slug mới                                                                                |
| 9   | CSDL hướng đối tượng & độc lập CSDL (0.05) | NFR-PORT-01, §4.4, DR-01…03                                                  | Entity class + Unit of Work; đổi `DB_DRIVER=mysql` chạy lại demo; CI matrix 2 CSDL                                                                           |

---

## 9. Phụ lục: Kịch bản chấp nhận chính

**AC-1 — Truy xuất nguồn gốc (Guest, điện thoại)**
_Cho trước_ sản phẩm "Bình hút lộc men lam" đã xuất bản với 6 mốc,
_khi_ giám khảo quét QR trên tem bằng camera điện thoại,
_thì_ trong ≤ 3 giây hiện trang truy xuất tiếng Việt, cuộn qua đủ 6 mốc theo thứ tự thời gian kèm ảnh, có huy hiệu "Nhật ký toàn vẹn" và "Hộ đã được BQL xác minh".

**AC-2 — Chào giá & chốt đồng thời**
_Cho trước_ RFQ "5.000 cốc in logo ĐH Công nghệ" ở trạng thái `BIDDING` với 3 bid,
_khi_ hai phiên Buyer cùng bấm "Chốt" hai bid khác nhau trong cùng một giây,
_thì_ đúng một yêu cầu thành công (`ACCEPTED`), yêu cầu còn lại nhận `409` và giao diện hiển thị "Yêu cầu đã được chốt" mà không cần tải lại trang.

**AC-3 — Chia nhỏ đơn**
_Cho trước_ RFQ 5.000 cốc được đánh dấu "Cần điều phối", 4 hộ có năng lực 2.000 / 1.500 / 1.200 / 1.000,
_khi_ Admin chọn chiến lược "Theo năng lực",
_thì_ hệ thống đề xuất 1.754 / 1.316 / 1.053 / 877 (tổng 5.000), Admin chỉnh tay hộ thứ 4 lên 900 thì cảnh báo tổng ≠ 5.000 và chặn lưu đến khi cân bằng.

**AC-4 — Phân quyền**
_Cho trước_ hộ A đăng nhập,
_khi_ gọi `PATCH /api/v1/products/{id}` với sản phẩm của hộ B,
_thì_ nhận `403 FORBIDDEN` và sự kiện được ghi Audit log.

**AC-5 — Độc lập CSDL**
_Cho trước_ bộ integration test,
_khi_ chạy với `DB_DRIVER=postgresql` rồi `DB_DRIVER=mysql`,
_thì_ cả hai đều xanh, kể cả test tranh chấp chốt giá.
