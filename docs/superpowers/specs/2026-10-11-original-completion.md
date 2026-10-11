# Bổ sung hành vi Jump King 1.04

Mục tiêu: bổ sung vật phẩm, nhiệm vụ, thành tích, cắt cảnh và sự kiện DLC vào bản web đang chạy, dựa trên executable và Content được người dùng cung cấp. Giữ React, Phaser, Colyseus và mô phỏng chung trong `packages/physics`. Không thêm dependency sản phẩm.

## Dữ liệu và luật

- Nhập worlditems.xml, skin_settings.xml, MerchantSettings, RavenSettings và lời thoại tiếng Anh vào dữ liệu JSON có thể tạo lại bằng script hiện có.
- Vật phẩm có hitbox/vị trí gốc; giày trưng bày chỉ nhận được sau giao dịch. Lưu vật đã nhặt, tiền, trang bị, tiến trình đuổi chim và giao dịch.
- Người bán tự giao dịch sau lời thoại nếu đứng trong vùng kích hoạt và đủ tiền. Giá ban đầu bằng số tiền đang sở hữu cộng price_increase và base_price như MerchantComp.
- GiantBoots không cho đi bộ; SnakeRing làm sàn thường trơn và bỏ hiệu ứng tuyết. Mỗi layer trang phục chỉ có một vật đang mặc.
- Multiplayer chạy thu thập/giao dịch/trang bị trên server, client dự đoán và đối chiếu snapshot. Không nhận inventory do client tự gửi.
- Thành tích dùng mã và điều kiện gốc, lưu trong trình duyệt cho chơi đơn. Không giả vờ đồng bộ với Steam/GOG.
- Cắt cảnh mở đầu của game mới và kết thúc ba campaign dùng sprite/âm thanh gốc, có bỏ qua và dọn tài nguyên khi rời trang.
- Sự kiện DLC chạy từ điều kiện/vị trí gốc, bao gồm thay đổi collision nếu có. Không coi hiệu ứng hình ảnh là thay thế cho collision.

## Tương thích và kiểm tra

- Save v1 cũ vẫn đọc được; các trường mới có giá trị mặc định an toàn.
- Giữ các đường dẫn chơi đơn, Community, Race và lựa chọn campaign hiện tại.
- Kiểm tra đơn vị: nhặt một lần, đồ trưng bày, đủ/thiếu tiền, giới hạn layer, trạng thái sau restore, hai hiệu ứng trang bị, thành tích và sự kiện.
- Kiểm tra trình duyệt: nhặt/mặc/lưu/tiếp tục, NPC, bỏ qua cắt cảnh, kết thúc và multiplayer hai người.
- Build và chạy kiểm tra trước từng commit riêng; push GitHub. Không đụng ba file legacy đang có thay đổi của người dùng.
- Sau khi hoàn tất tích hợp, cập nhật Cloudflare và backend EC2 hiện có; giữ AWS Free plan và timer tự dừng.

Không tuyên bố tương đương 100% nếu còn khác biệt quan sát được hoặc chưa kiểm tra.
