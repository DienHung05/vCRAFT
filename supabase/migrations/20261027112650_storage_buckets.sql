-- ADR-14: object storage của vCraft đặt trên Supabase Storage, backend truy cập qua giao thức S3.
-- Không tạo policy trên storage.objects: RLS mặc định chặn anon/authenticated ghi, liệt kê, xóa.
-- Chỉ backend (S3 access key, bỏ qua RLS) được ghi; bucket public chỉ cho đọc qua URL công khai.

-- Ảnh đã tối ưu (AVIF/WebP), key chứa hash nội dung nên cache vĩnh viễn được
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vcraft-media', 'vcraft-media', true, 10485760,
        array['image/avif', 'image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- FR-MEDIA-04, NFR-SEC-03: giấy tờ xác minh, ảnh gốc, PDF tem QR; chỉ đọc qua URL ký 5 phút
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vcraft-private', 'vcraft-private', false, 10485760,
        array['image/avif', 'image/webp', 'image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
