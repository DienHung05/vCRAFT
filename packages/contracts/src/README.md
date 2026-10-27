# @vcraft/contracts — quy ước

Zod schema là nguồn sự thật duy nhất cho dữ liệu vào/ra của API (NFR-MAIN-02). FE và BE dùng chung.

## Đặt tên

| Thứ | Quy ước | Ví dụ |
|---|---|---|
| Schema | `XxxSchema` (PascalCase + hậu tố `Schema`) | `CreateRfqRequestSchema` |
| Kiểu | `XxxDto = z.infer<typeof XxxSchema>` cho dữ liệu nghiệp vụ; primitive thì `Xxx` | `RfqDto`, `Slug` |
| Request / Response | Tách riêng, hậu tố `Request` / `Response` (hoặc `Query` cho query string) | `CreateRfqRequestSchema`, `RfqResponseSchema`, `ListRfqsQuerySchema` |
| Factory | camelCase, hậu tố `Schema` | `cursorPageSchema(item)`, `sortQuerySchema(fields)` |
| Hằng | `UPPER_SNAKE_CASE` | `ERROR_CATALOG`, `DEFAULT_PAGE_LIMIT` |
| File | `kebab-case.ts`, gom theo miền (`rfq/`, `products/`...), mỗi miền có `index.ts` | `rfq/create-rfq.ts` |

## Quy tắc

- Schema request không chứa trường server sinh (`id`, `version`, `createdAt`); response luôn có `id` và `version` (BR-L1).
- Query string luôn là chuỗi: dùng `z.coerce`, `csvOf()`, `sortQuerySchema()` thay vì kiểu thô.
- Tiền = `VndSchema` (số nguyên), thời điểm = `IsoDateTimeSchema`, id = `IdSchema`, slug = `SlugSchema`.
- Thông điệp lỗi tự đặt trong schema viết tiếng Việt, cụ thể, chỉ cách sửa (NFR-UX-05). Thông điệp mặc định của Zod được thay bằng `applyVietnameseZodErrors()` (gọi một lần ở API).
- Lỗi trả về luôn là Problem Details (RFC 9457) với `code` thuộc `ERROR_CATALOG`. Thêm mã mới vào đúng nhóm, không đổi tên mã đã phát hành.
- Không import `packages/i18n`, `packages/database` hay `apps/*`.
