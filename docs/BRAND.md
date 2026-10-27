# vCraft — Nhận diện thương hiệu & Ngôn ngữ thiết kế

> Phiên bản 1.0 · 27/10/2026 · Phục vụ tiêu chí chấm (3) *Giao diện: responsive, đẹp, hiện đại, có bản sắc, đặc trưng nhận dạng thương hiệu nổi bật* (hệ số 0.2 — lớn thứ hai).
> Mọi token ở đây được cài trong `packages/ui/src/tokens` và `packages/ui/src/motion`.

---

## 1. Nền tảng thương hiệu

| | |
|---|---|
| **Tên** | vCraft — *v* là **Việt**, cũng là hình **chiếc bình** nhìn nghiêng và **vệt men** chảy |
| **Khẩu hiệu** | *Tinh hoa làng nghề, muôn phương lan tỏa* |
| **Ý tưởng cốt lõi** | **"Ấn của người thợ"** — dưới đáy mỗi món gốm Bát Tràng thường có dấu triện của lò. vCraft số hóa con dấu đó: mỗi sản phẩm mang một **ấn truy xuất** (QR trong khung triện) chứng thực *ai làm, làm thế nào, làm khi nào*. |
| **Tính cách** | Mộc mạc · Ấm áp · Tự hào · Minh bạch · Tinh tế |
| **Không phải** | Sàn TMĐT ồn ào, giảm giá, banner nhấp nháy, "phong cách template" |
| **Cảm giác cần đạt** | Bước vào **một bảo tàng nhỏ ấm cúng** chứ không phải một cửa hàng |

**Ba chất liệu dẫn dắt mọi quyết định thị giác:** **Đất** (nung, thô, ấm) · **Lửa** (lò nung, chuyển hóa) · **Men** (lam, ngọc, bóng, rạn).

---

## 2. Logo & ấn triện

- **Logomark — "Ấn v"**: hình vuông bo góc không đều như con dấu khắc tay, màu son, chữ *v* âm bản cách điệu thành dáng bình gốm (hai nét thuôn gặp nhau ở đáy). Viền có vết mực loang nhẹ (SVG `feTurbulence` + `feDisplacementMap`, tĩnh khi xuất file).
- **Wordmark**: `vCraft` dựng bằng Fraunces (trục `SOFT` cao, `WONK` bật) — chữ *v* thường, *C* hoa như vành miệng bình.
- **Ấn truy xuất (Trace seal)**: mã QR đặt trong khung triện vuông, logo ấn v ở giữa (mức sửa lỗi H), mã 8 ký tự dưới khung bằng JetBrains Mono. Đây là **thứ người dùng thấy ngoài đời thật** (tem dán đáy sản phẩm) ⇒ cầu nối thương hiệu offline → online.
- Biến thể: đầy đủ (ấn + chữ), ấn đơn (favicon, app icon, ghim bản đồ), đơn sắc mực (in tem), đảo màu (nền tối).
- Vùng an toàn = ½ chiều cao ấn; kích thước tối thiểu 20px (màn hình), 8mm (in).

---

## 3. Màu sắc

### 3.1 Bảng màu chính (chế độ sáng — "Giấy dó")

| Token | Tên | Hex | Tỉ lệ tương phản trên nền giấy | Dùng cho |
|---|---|---|---|---|
| `--paper` | Giấy dó | `#F5EFE4` | — | Nền chính (không dùng trắng tinh) |
| `--ink` | Mực tàu | `#1C1814` | 15.4 : 1 | Chữ chính |
| `--ash` | Tro lò | `#6B635A` | 5.2 : 1 | Chữ phụ, chú thích |
| `--clay` | Đất nung | `#A8482A` | 5.1 : 1 | Màu chủ đạo: nút chính, liên kết, nhấn |
| `--glaze` | Men lam | `#1E3A6E` | 9.7 : 1 | Tiêu đề lớn, nền khối tương phản, hoa văn lam |
| `--seal` | Son triện | `#C2261C` | 5.1 : 1 | **Chỉ** cho ấn, xác thực, khoảnh khắc quan trọng (hiếm ⇒ có sức nặng) |
| `--celadon` | Men ngọc | `#5E8A7D` | 3.4 : 1 | Trạng thái "đang mở cửa", thành công — **chỉ** chữ lớn/biểu tượng |
| `--lacquer` | Vàng sơn mài | `#8C6A24` | 4.4 : 1 | Chứng nhận, huy hiệu nghệ nhân — chữ ≥ 18px |

Tỉ lệ sử dụng: **60% giấy · 25% mực/lam · 10% đất nung · ≤ 5% son/vàng/ngọc**.

### 3.2 Chế độ tối — "Lò đêm"
| Token | Hex | Ghi chú |
|---|---|---|
| `--paper` | `#14110F` | Than lò |
| `--surface` | `#1F1A16` | Thẻ, panel |
| `--ink` | `#F1E9DC` | 15.6 : 1 |
| `--clay` | `#E2703A` | Than hồng — 5.9 : 1 |
| `--glaze` | `#8FB0E6` | Men lam sáng — 8.5 : 1 |
| `--seal` | `#F06A55` | 6.2 : 1 |
| `--celadon` | `#9CC7B8` | 10.1 : 1 |

Tông ảnh tự động: mỗi ảnh có `dominantColor` (sinh ở backend) ⇒ khung thẻ, nền hero sản phẩm nhuốm nhẹ màu ảnh (`color-mix(in oklch, var(--paper) 92%, <dominant>)`) ⇒ giao diện "ăn" theo sản phẩm.

---

## 4. Chữ

| Vai trò | Font | Lý do | Cách dùng |
|---|---|---|---|
| Hiển thị | **Fraunces** (variable: `opsz`, `wght`, `SOFT`, `WONK`) | Serif mềm, có "chất tay"; hỗ trợ tiếng Việt đầy đủ | H1–H3, số liệu lớn, trích dẫn nghệ nhân |
| Giao diện & nội dung | **Be Vietnam Pro** | Thiết kế riêng cho dấu tiếng Việt, rõ ở cỡ nhỏ | Thân bài, form, bảng, nút |
| Mã & số kỹ thuật | **JetBrains Mono** | Phân biệt 0/O, 1/l | Mã truy xuất, mã RFQ, hash |

Đã kiểm: cả ba có subset `vietnamese` trên Google Fonts ⇒ tự host qua `next/font` (không gọi CDN lúc chạy).

Thang chữ (fluid, `clamp`): `display 3.5–7rem` · `h1 2.5–4rem` · `h2 2–2.75rem` · `h3 1.5–1.875rem` · `body 1rem–1.0625rem / line-height 1.65` · `small 0.875rem`. Tiêu đề lớn: `letter-spacing: -0.02em`, Fraunces `SOFT 100`.

---

## 5. Bố cục, chất liệu & hoa văn

- **Lưới biên tập (editorial)**: 12 cột, lề rộng, bố cục **bất đối xứng** kiểu tạp chí; ảnh lớn tràn mép xen khối chữ hẹp. Ảnh là nhân vật chính (image-centric).
- **Tỉ lệ ảnh chuẩn**: sản phẩm 4:5 · xưởng 3:2 · chân dung 3:4 · thumbnail 1:1.
- **Bento** cho trang hồ sơ hộ (ô câu chuyện, ô chứng nhận, ô bản đồ, ô "đời thứ 5").
- **Chất liệu nền**: hạt giấy (SVG noise, opacity 4%) phủ toàn trang; ở chế độ tối là bụi than.
- **Men rạn (crackle)**: hoa văn rạn sinh thủ tục (Voronoi SVG) dùng làm nền khối xác thực, nền QR, trạng thái rỗng.
- **Hoa văn lam**: dải viền hoa cúc dây / sóng nước kiểu gốm hoa lam (SVG, `--glaze`) làm vạch ngăn section.
- **Nét bút lông**: gạch chân tiêu đề, khung highlight — SVG path vẽ dần (DrawSVG).
- **Bo góc**: 4px (input), 12px (thẻ), 999px (chip). Bóng đổ ấm, mềm: `0 1px 0 rgb(28 24 20 / .04), 0 12px 32px -12px rgb(120 60 30 / .18)`.
- **Biểu tượng**: Lucide (nét 1.5) + bộ icon nghề tự vẽ cùng nét: bàn xoay, lò nung, khuôn, cọ vẽ, khung dệt, kén tằm.

---

## 6. Ngôn ngữ chuyển động

### 6.1 Nguyên tắc — "Nặn, Nung, Tỏa"
1. **Nặn** — chuyển động hữu cơ, có quán tính như tay nặn đất; không bao giờ tuyến tính.
2. **Nung** — chuyển trạng thái có "nhiệt": màu ấm dần, ánh sáng lan, như vào lò.
3. **Tỏa** — nội dung lan ra từ tâm điểm (ấn, ghim, ảnh) như mực thấm giấy, như *muôn phương lan tỏa*.
4. **Có chủ đích** — mỗi hoạt ảnh phải giúp hiểu (thứ tự, quan hệ, trạng thái) hoặc tạo cảm xúc ở khoảnh khắc quan trọng; không trang trí vô cớ.

### 6.2 Token

| Token | Giá trị | Dùng cho |
|---|---|---|
| `ease.clay` | `cubic-bezier(0.22, 1, 0.36, 1)` | Mặc định: vào khung, mở rộng |
| `ease.kiln` | `cubic-bezier(0.65, 0, 0.35, 1)` | Chuyển cảnh, đổi trạng thái |
| `ease.press` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Ấn triện, nút bấm (nảy nhẹ) |
| `spring.clay` | `{ stiffness: 260, damping: 26, mass: 0.9 }` | Kéo-thả, layout |
| `dur.instant / quick / base / slow / story` | 90 / 160 / 280 / 520 / 900 ms | — |
| `stagger.list` | 40 ms (tối đa 12 phần tử) | Danh sách, lưới |

### 6.3 Mười khoảnh khắc đặc trưng (signature moments)

| # | Khoảnh khắc | Mô tả | Công nghệ | Màn hình |
|---|---|---|---|---|
| 1 | **Bình gốm thành hình** | Hero 3D: khối đất xoay trên bàn xoay; cuộn trang ⇒ đất được "vuốt" thành bình (profile `LatheGeometry` nội suy qua 4 dáng) ⇒ phơi (bề mặt khô, nhạt) ⇒ vẽ hoa lam (texture vẽ dần) ⇒ nung (ánh lửa, bloom) ⇒ ra lò bóng men. Năm chặng khớp chính xác các công đoạn của nhật ký sản xuất. | R3F + shader + GSAP ScrollTrigger | Trang chủ |
| 2 | **Đóng ấn** | Ấn son giáng xuống (scale 1.4→1, `ease.press`), mực loang ra (SVG turbulence animate), rung nhẹ khung. | Motion + SVG filter | Duyệt hộ, chốt giá, xác thực truy xuất, xuất bản sản phẩm |
| 3 | **Dòng thời gian lửa** | Đường nối các mốc nhật ký "cháy" dần từ màu đất sang màu lửa theo vị trí cuộn; mỗi mốc hiện như mảnh gốm ghép. | GSAP ScrollTrigger + DrawSVG | Landing truy xuất, trang sản phẩm |
| 4 | **Mực thấm ảnh** | Ảnh lộ ra qua mặt nạ vệt bút lông (clip-path/mask SVG) khi vào khung. | GSAP + CSS mask | Hồ sơ hộ, câu chuyện |
| 5 | **Chữ nặn** | Tiêu đề tách từng chữ, trồi lên với trục `SOFT/wght` của Fraunces biến thiên (chữ "mềm" rồi "cứng" lại như đất khô). | SplitText + variable font | Hero các trang |
| 6 | **Ảnh bay về chỗ** | Ảnh thẻ sản phẩm bay mượt thành ảnh lớn trang chi tiết. | View Transitions API | Danh mục → chi tiết |
| 7 | **Ghim thở** | Ghim xưởng đang mở có vòng sóng men ngọc lan ra chậm; bay camera nghiêng 3D tới xưởng khi chọn. | MapLibre `flyTo` + CSS | Bản đồ |
| 8 | **Chào giá rơi vào bàn** | Bid mới trượt vào bảng so sánh, ô tốt nhất phát sáng vàng sơn mài; số tiền đếm lên. | Motion `layout` + AnimatePresence | RFQ (Buyer) |
| 9 | **Chia đơn như chia đất** | Thanh tổng số lượng là một "khối đất"; kéo tay cầm chia thành phần cho từng hộ với lực lò xo; tổng sai ⇒ khối rạn nứt (crackle) đỏ. | Motion drag + spring | Admin điều phối |
| 10 | **Lò đêm** | Chuyển sáng ⇄ tối: hiệu ứng lan tròn từ nút như mở cửa lò. | View Transitions + clip-path | Toàn site |

Vi tương tác bổ sung: nút từ tính (desktop), con trỏ chấm mực đổi hình theo ngữ cảnh (desktop), skeleton dạng "đất chưa nung" lấp lánh nhẹ, số đếm lên ở thống kê, chuyển tab gạch chân bút lông chạy theo.

### 6.4 Ranh giới
- `prefers-reduced-motion: reduce` ⇒ tắt Lenis, parallax, 3D tự xoay, SplitText; thay bằng mờ dần 150ms. Hero 3D thay bằng ảnh tĩnh bình đã ra lò.
- Studio & Admin (công cụ làm việc) dùng chuyển động **tiết chế**: chỉ phản hồi trạng thái (≤ 280ms), giữ khoảnh khắc #2, #8, #9.
- Ngân sách: tổng JS hoạt ảnh trang chủ ≤ 120 KB gzip (3D tải lười); 55+ fps trên điện thoại tầm trung.

---

## 7. Hình ảnh

- Ánh sáng tự nhiên, ấm; cận cảnh **bàn tay đang làm**, vân đất, giọt men; toàn cảnh lò, sân phơi.
- Mỗi hộ tối thiểu: 1 chân dung nghệ nhân, 3 ảnh xưởng, 1 ảnh bàn tay làm việc.
- Chỉnh màu thống nhất (preset nhẹ: ấm +5, bão hòa −8, giữ tông da).
- Nhóm dành **một buổi thực địa tại Bát Tràng** (Sprint 0–1) để chụp ảnh/quay video gốc ⇒ nội dung thật, có bản quyền, là lợi thế lớn khi chấm "bản sắc".

---

## 8. Giọng văn

| Ngữ cảnh | Nên | Tránh |
|---|---|---|
| Chung | Ấm, trân trọng, ngắn gọn, xưng "bạn" | Ngôn ngữ bán hàng giật gân |
| Trạng thái rỗng | "Xưởng chưa có sản phẩm nào ra lò. Hãy đăng món đầu tiên." | "Không có dữ liệu" |
| Đang tải | "Đang nhóm lò…" (chỉ khi > 1s) | Spinner trơ trọi |
| Thành công | "Đã đóng ấn. Hồ sơ hộ Minh Hải chính thức có mặt trong làng." | "Success!" |
| Lỗi nhập | "Hạn giao phải sau hạn chào giá ít nhất 1 ngày." | "Invalid date" |
| Lỗi hệ thống | "Lò hơi trục trặc, bạn thử lại sau ít phút nhé." + mã lỗi | Stack trace |

Ẩn dụ nghề dùng **có chừng mực** ở khoảnh khắc cảm xúc; thông tin nghiệp vụ (giá, hạn, số lượng) luôn nói thẳng.

---

## 9. Định hướng các màn hình chủ chốt

| Màn hình | Ý tưởng chủ đạo |
|---|---|
| **Trang chủ** | Hero bình gốm 3D (#1) → "Một ngày ở Bát Tràng" kể theo cuộn (ngang) → lưới nghệ nhân nổi bật (chân dung lớn, chữ ký tay) → bản đồ thu nhỏ "đang mở cửa" → số liệu làng đếm lên → tin mới. |
| **Hồ sơ hộ (triển lãm số)** | Hero toàn màn hình chân dung + tên hộ Fraunces cực lớn + "Đời thứ 5" → bento → timeline gia đình nằm ngang kéo được → gallery xưởng kiểu masonry → sản phẩm. |
| **Chi tiết sản phẩm** | Ảnh 4:5 lớn bên trái (sticky), thông tin bên phải; nhãn "Độc bản" dạng ấn; nhật ký rút gọn 1 dòng có nút "Xem hành trình" ⇒ mở landing. |
| **Landing truy xuất** | Mobile-first, như một **cuốn sổ nghề**: ảnh → ấn xác thực (#2) → lời nghệ nhân → dòng thời gian lửa (#3) → bản đồ mini → "Ghé xưởng". |
| **Bản đồ** | Bản đồ style riêng (nền giấy, nước men lam nhạt, đường mực mảnh), ghim là ấn nhỏ màu theo nghề, panel danh sách bên trái / bottom sheet trên mobile. |
| **RFQ (Buyer)** | Stepper trạng thái dạng "các công đoạn lò" phía trên; bảng so sánh bid có highlight tốt nhất theo cột; nút chốt to rõ. |
| **Studio (Hộ)** | Mobile-first, nút nổi "+ Thêm mốc" luôn sẵn; thẻ lời mời RFQ có đồng hồ đếm ngược; thống kê lượt quét QR. |
| **Admin** | Sạch, mật độ cao, nền giấy; hàng đợi duyệt dạng 3 cột song song; bảng điều phối kéo-thả (#9); biểu đồ giá vật liệu. |
