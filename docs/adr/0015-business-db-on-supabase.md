# ADR-15 — CSDL nghiệp vụ chạy trên Postgres của Supabase, MySQL vẫn là đích kiểm chứng

- Trạng thái: **Chấp nhận** (27/10/2026)
- Liên quan: NFR-PORT-01, ADR-04, ADR-05, ADR-11, ADR-13, ADR-14

## Bối cảnh

CSDL nghiệp vụ trước đây chạy trong container Postgres trên máy từng người. Dữ liệu mỗi máy một khác, và thành viên khác không xem hay theo dõi được. Nhóm đã dùng một project Supabase cho Auth (ADR-11), vector store (ADR-13) và file (ADR-14). Project hiện tại là `aaltayglwiusqybuiycd`, vùng `eu-west-1`.

## Quyết định

1. CSDL nghiệp vụ dùng **Postgres 17 của Supabase**, schema `public`. MikroORM kết nối qua **Session pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`, user `postgres.<ref>`). Pooler này có IPv4 và giữ được prepared statement. Kết nối thẳng `db.<ref>.supabase.co` chỉ có IPv6 trên gói Free. Bật TLS bằng `DB_SSL=true`; kết nối luôn xác thực chứng chỉ máy chủ (không có tùy chọn tắt). Pooler dùng CA riêng của Supabase nên khai báo CA tải từ Dashboard qua `DB_SSL_CA_FILE` (hoặc `DB_SSL_CA`).
2. Cả nhóm dùng chung một CSDL dev và theo dõi qua Table Editor, Logs, Advisors trên Dashboard. Compose không còn container Postgres.
3. Không để Data API (PostgREST) chạm vào bảng nghiệp vụ. Migration `supabase/migrations/*_business_db_guard.sql` làm hai việc:
   - thu quyền mặc định của `anon`/`authenticated` trên bảng, sequence, hàm mới trong `public`;
   - dùng event trigger `ensure_rls` tự bật RLS cho mọi bảng mới trong `public`, kể cả bảng do migration MikroORM tạo.

   Backend dùng vai trò `postgres` (chủ bảng), nên không bị RLS chặn.
4. **NFR-PORT-01 giữ nguyên.** Entity và migration vẫn viết cho hai driver. Không khóa ngoại sang `auth.users`, không dùng tính năng riêng của Postgres trong `packages/database`. MySQL được kiểm chứng bằng integration test (Testcontainers) trong CI và profile compose `mysql` khi demo đổi `DB_DRIVER=mysql`.
5. Redis vẫn chạy cục bộ: chỉ là cache, hàng đợi và pub/sub tạm, không giữ dữ liệu thật. Supabase không có Redis. **Cập nhật 31/10/2026 ([ADR-16](0016-deploy-vercel-render.md)):** trên production Redis chạy ở Render Key Value; ở máy dev vẫn chạy cục bộ.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| Postgres trong container ở mỗi máy | Dữ liệu rời rạc, không theo dõi chung được |
| Bảng nghiệp vụ ở schema riêng không mở qua Data API | An toàn tương đương nhưng phải đổi config và sinh lại migration; Table Editor phải chọn schema mỗi lần |
| Tắt hẳn Data API | Trợ lý Cáo vẫn gọi RPC `match_knowledge` qua Data API (ADR-13) |

## Hệ quả

- Tốt: một nơi để quản lý và theo dõi; không ai phải dựng CSDL ở máy mình; vector store và dữ liệu nghiệp vụ nằm cùng một instance nhưng tách bảng.
- Cần lưu ý:
  - Gói Free giới hạn **500 MB** dung lượng CSDL. Băng thông 10 GB/tháng dùng chung với Auth và Storage.
  - CSDL dùng chung: chỉ chạy `pnpm db:migrate` từ nhánh đã merge vào `develop`. Hạn chế `db:seed` vì có thể ghi đè dữ liệu người khác đang dùng.
  - Integration test luôn chạy trên Testcontainers, **không bao giờ** trỏ vào CSDL Supabase.
  - Mỗi bảng nghiệp vụ mới đều tự bật RLS. Nếu sau này cần cho trình duyệt đọc trực tiếp một bảng, phải viết policy và ghi lại bằng ADR.
  - Project Free tạm dừng sau 7 ngày không dùng (PLAN §9).
