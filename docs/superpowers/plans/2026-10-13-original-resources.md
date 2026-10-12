# Bổ sung tài nguyên còn thiếu của Jump King 1.04

Mục tiêu: giữ các font gốc, nhập nội dung bảng/sách/nhật ký và tái hiện mask thời tiết trên web, để tiếp tục phát triển mà không cần bộ cài Windows. Giữ React/Phaser/Colyseus, không thêm dependency sản phẩm, không sửa các file legacy đang có thay đổi riêng.

## 1. Nhập tài nguyên

- Mở rộng script hiện có để xuất cả 9 TTF và 8 SpriteFont thành PNG + BMFont XML; giữ số đo glyph gốc.
- Xuất lời tiếng Anh thành JSON đầy đủ và nhập cấu hình RattmanSettings cùng text, vùng kích hoạt, font, vị trí bubble.
- Cho script chi tiết nhận đường dẫn Content và dùng JSON ngôn ngữ đã lưu; báo lỗi nếu thiếu text.
- Kiểm tra file được tạo bằng importer thật; build/test trước commit và push.

## 2. Hiển thị nội dung đọc và font gốc

- Đối chiếu RattmanEntity trong executable: thời gian đứng yên, điều kiện vùng kích hoạt, chuyển dòng và dừng khi di chuyển.
- Thêm kiểm thử hành vi thất bại trước; mở rộng mô phỏng chung và snapshot tương thích save cũ.
- Dùng BitmapText của Phaser để hiển thị font gốc, bubble, NPC và chữ cắt cảnh; dọn khi đổi màn/rời scene.
- Kiểm tra unit, trình duyệt chơi đơn/online, build; commit và push riêng.

## 3. Mask thời tiết và kiểm tra độc lập

- Đối chiếu WeatherManager/MaskShader, dùng đúng tên texture mask theo weather và màn.
- Kiểm thử lỗi mask hiện tại trước, sửa bằng API mask sẵn có của Phaser; xác minh alpha/inversion từ shader gốc.
- Cập nhật README về tài nguyên, nội dung được bổ sung và giới hạn kiểm tra.
- Chạy toàn bộ unit, build và E2E liên quan khi thư mục bộ cài không tồn tại; kiểm tra diff, commit, push.

Không tuyên bố tương đương 100% toàn bộ game hoặc nhập file test nếu executable không sử dụng nó. Hai shader XNB là định dạng engine gốc; ghi lại cách tái hiện và giữ bản nguồn để tham khảo, không tải chúng như shader web.
