/**
 * Header nội bộ do `proxy.ts` đặt lại ở mọi request: đường dẫn công khai kèm query (vd.
 * `/vi/yeu-cau-bao-gia/x?tab=1`). Layout không biết đường dẫn của trang con, mà guard cần nó để
 * tạo đích quay lại sau đăng nhập. Luôn bị ghi đè nên client không giả mạo được.
 */
export const PATH_HEADER = 'x-vcraft-path';
