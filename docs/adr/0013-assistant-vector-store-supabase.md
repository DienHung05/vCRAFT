# ADR-13 — Vector store của trợ lý Cáo đặt trên Supabase pgvector, tách khỏi CSDL nghiệp vụ

- Trạng thái: **Chấp nhận** (27/10/2026)
- Liên quan: FR-AST ([SRS §3.13](../SRS.md#313-trợ-lý-cáo-chatbot--fr-ast)), NFR-PORT-01, [ARCHITECTURE §7.6](../ARCHITECTURE.md#76-trợ-lý-cáo-rag--guardrail), epic E15 trong [PLAN](../PLAN.md)

## Bối cảnh

Trợ lý Cáo trả lời bằng RAG nên cần một kho vector để tìm đoạn tri thức gần nghĩa với câu hỏi. Có hai ràng buộc:

- NFR-PORT-01 và tiêu chí chấm 9 yêu cầu CSDL nghiệp vụ chạy được trên cả PostgreSQL lẫn MySQL. Demo có bước đổi `DB_DRIVER=mysql`.
- pgvector là extension chỉ có trên PostgreSQL.

Nhóm đã có sẵn một project Supabase dùng cho Auth (ADR-11). Postgres của Supabase bật được pgvector mà không tốn thêm hạ tầng.

## Quyết định

1. Chỉ mục tri thức (`knowledge_chunks`) đặt trên **Postgres của Supabase** với pgvector và index HNSW, **không** đặt trong CSDL nghiệp vụ.
2. Đây là dữ liệu **dẫn xuất**: worker `assistant.ingest` dựng từ nội dung công khai của CSDL nghiệp vụ qua outbox; có thể xóa và dựng lại bằng `pnpm assistant:reindex`.
3. Schema, index, hàm RPC `match_knowledge` và RLS viết bằng SQL trong `supabase/migrations/`. Đây là chỗ được dùng tính năng riêng của PostgreSQL (xem AGENTS.md §3).
4. Backend chỉ truy cập qua port `VectorStore` (`apps/api/src/infrastructure/vector`), gồm 2 adapter: `SupabaseVectorStore` (secret key, chỉ ở backend) và `InMemoryVectorStore` (test, CI, chạy offline khi demo).
5. RLS chặn hoàn toàn vai trò `anon` và `authenticated`; trình duyệt không bao giờ truy vấn bảng này trực tiếp.

## Phương án đã cân nhắc

| Phương án | Lý do không chọn |
|---|---|
| pgvector trong CSDL nghiệp vụ | Phá NFR-PORT-01: chạy MySQL thì trợ lý hỏng; migration hai driver lệch nhau |
| Dịch vụ vector riêng (Pinecone, Qdrant) | Thêm tài khoản/hạ tầng; Supabase đã có sẵn |
| Lưu embedding dạng JSON trong CSDL nghiệp vụ, tính cosine ở app | Chậm khi số chunk tăng; tốn bộ nhớ API |
| Chỉ tìm kiếm từ khóa (`search_text` LIKE) | Hiểu câu hỏi tự nhiên kém, nhất là câu tiếng Anh hỏi về nội dung tiếng Việt |

## Hệ quả

- Tốt: CSDL nghiệp vụ vẫn độc lập, đổi sang MySQL thì trợ lý vẫn chạy. Có thêm một ví dụ Adapter/Port để trình bày khi vấn đáp.
- Cần lưu ý: phụ thuộc thêm vào Supabase (project Free tự tạm dừng sau 7 ngày không dùng, xem rủi ro trong PLAN §9). Khi Supabase không truy cập được, trợ lý chuyển sang `InMemoryVectorStore` nạp từ snapshot hoặc báo "Cáo đi ngủ"; luồng nghiệp vụ không bị ảnh hưởng.
- Từ ADR-15, CSDL nghiệp vụ cũng nằm trên Postgres của Supabase. Quyết định này vẫn giữ: vector store là bảng riêng, chỉ truy cập qua port `VectorStore`, migration riêng trong `supabase/migrations`. Đổi `DB_DRIVER=mysql` thì trợ lý vẫn chạy.
- Có hai nơi chạy migration (MikroORM cho CSDL nghiệp vụ, Supabase CLI cho vector store); CI phải chạy cả hai.
