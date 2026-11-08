# ADR-14 — Object storage đặt trên Supabase Storage, truy cập qua giao thức S3

- Trạng thái: **Chấp nhận** (27/10/2026)
- Liên quan: FR-MEDIA ([SRS §3](../requirements/SRS.md)), FR-MEDIA-04, NFR-SEC-03, NFR-PORT-03, ADR-09, ADR-11, ADR-13, epic E4 trong [PLAN](../PLAN.md)

## Bối cảnh

Kế hoạch ban đầu dùng MinIO khi dev và Cloudflare R2 khi demo. Như vậy nhóm phải quản lý thêm một container, một tài khoản Cloudflare và một bộ khóa. Project Supabase đã có sẵn cho Auth (ADR-11) và vector store (ADR-13). Supabase Storage có endpoint tương thích S3 (`/storage/v1/s3`), hỗ trợ presigned URL theo AWS SigV4.

## Quyết định

1. Ảnh, giấy tờ và PDF tem QR lưu trên **Supabase Storage** của cùng project. Nhóm quản lý dịch vụ ngoài ở một chỗ: Supabase cho Auth, vector store và file.
2. Hai bucket, tạo bằng migration `supabase/migrations/20261027112650_storage_buckets.sql`:
   - `vcraft-media` (public): ảnh đã tối ưu AVIF/WebP, key chứa hash nội dung, upload kèm `Cache-Control: public, max-age=31536000, immutable`.
   - `vcraft-private` (private): giấy tờ xác minh, ảnh gốc, PDF. Chỉ đọc qua presigned URL hạn 5 phút (FR-MEDIA-04).
   - Giới hạn 10 MB/file và danh sách MIME cho phép (không có SVG).
3. Backend vẫn đi qua `StoragePort → S3Adapter` với `@aws-sdk/client-s3` (`forcePathStyle: true`, endpoint `https://<ref>.storage.supabase.co/storage/v1/s3`). Đổi nhà cung cấp chỉ cần đổi biến môi trường.
4. Không tạo policy trên `storage.objects`: RLS mặc định chặn `anon`/`authenticated`. Chỉ backend ghi bằng S3 access key (bỏ qua RLS, không bao giờ ra trình duyệt).
5. `LocalDiskAdapter` (NFR-PORT-03) dùng cho test, CI và demo offline: `STORAGE_DRIVER=local` ghi vào `infra/compose/.data/media`, Caddy phục vụ ở `/media/*`.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| MinIO (dev) + Cloudflare R2 (prod) | Thêm container và tài khoản; dev và prod khác nhà cung cấp |
| Supabase Storage qua `@supabase/supabase-js` | Khóa chặt vào SDK Supabase; S3 giữ được port trung lập, dễ thay sang R2/S3 |
| Lưu file trong CSDL nghiệp vụ (BLOB) | Phình CSDL, chậm, không có CDN |

## Hệ quả

- Tốt: bớt MinIO khỏi compose; một dashboard cho Auth, vector, file; có CDN sẵn của Supabase.
- Cần lưu ý: gói Free có 1 GB lưu trữ và giới hạn băng thông; ảnh seed phải tối ưu trước. Project Free tạm dừng sau 7 ngày không dùng (PLAN §9). Mất mạng khi demo thì chuyển `STORAGE_DRIVER=local`.
- CSDL nghiệp vụ sau đó cũng chuyển lên Supabase, xem [ADR-15](0015-business-db-on-supabase.md).
