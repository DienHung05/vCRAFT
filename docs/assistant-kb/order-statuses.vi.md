# Trạng thái yêu cầu báo giá và đơn hàng

Một yêu cầu báo giá đi qua các trạng thái: Nháp (bạn đang soạn), Đã gửi (chờ hộ chào giá), Đang chào giá (đã có đề xuất; hạn chấp nhận báo giá là bảy ngày sau ngày đóng chào giá), Đã chấp nhận (đơn hàng đã hình thành), Đang sản xuất, Đã giao hàng, Đã hủy (bạn hoặc Ban quản lý hủy, kèm lý do) và Hết hạn (quá hạn chào giá mà không có đề xuất, hoặc quá 7 ngày không chốt).

Chào giá của hộ có các trạng thái: Đã gửi (hộ đang đề xuất), Được chấp nhận (bạn chốt chào giá đó), Bị từ chối (chào giá khác được chọn), Đã rút (hộ tự rút) và Hết hiệu lực.

Phân bổ cho từng hộ trong đơn: Đề xuất (chờ hộ xác nhận), Đã xác nhận, Đã từ chối (hộ không nhận, đơn chưa sản xuất bị hủy), Đang sản xuất, Hoàn thành và Đã hủy. Hộ báo số lượng đã xong theo từng phân bổ; đủ số lượng thì phân bổ hoàn thành.

Thanh toán trực tuyến (chuyển khoản, VietQR, VNPay, MoMo) đang ở giai đoạn thử nghiệm theo ADR-0021 và chưa phải tính năng đã triển khai; đơn hàng hiện được theo dõi qua trạng thái sản xuất và giao hàng. Bạn xem trạng thái mới nhất của yêu cầu tại /vi/yeu-cau-bao-gia.
