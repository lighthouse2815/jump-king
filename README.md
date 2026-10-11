# Jump King Web

Bản chơi web sử dụng dữ liệu từ bộ Jump King 1.04 được cung cấp trong workspace: 169 màn, 778 texture, 125 âm thanh, lời thoại của 27 NPC và tường ẩn của 37 màn. Bản chính có đường chơi qua đủ 43 màn, được kiểm tra bằng mô phỏng thực tế từ điểm xuất phát đến điều kiện thắng.

Chơi đơn có lưu/tiếp tục trong trình duyệt, tạm dừng, điều khiển bàn phím/tay cầm/cảm ứng, thời tiết, nhạc nền và màn kết thúc. Community Tower và Race Arena dùng cùng mô phỏng trên server Colyseus, có dự đoán và đối chiếu trạng thái phía client.

## Chạy bản đã build

```sh
pnpm install
pnpm build
pnpm start
```

Mở **http://localhost:2567**. Backend phục vụ cả bản web và kết nối multiplayer. Chơi đơn không cần PostgreSQL hay kết nối tới phòng chơi.

## Phát triển

```sh
pnpm dev
```

Frontend: http://localhost:3000. Server: http://localhost:2567. Khi dùng frontend với server ở địa chỉ khác, đặt `VITE_SERVER_URL` trong `apps/web/.env.local`, ví dụ `wss://your-game-host.example`.

## Điều khiển

- Trái/phải hoặc A/D: đi bộ và chọn hướng nhảy.
- Giữ Space, W hoặc mũi tên lên: tích lực; thả để nhảy; tự nhảy khi đầy lực sau 0,6 giây.
- Không đổi hướng trên không; va tường làm bật lại.
- Escape: tạm dừng. Trên multiplayer, phòng chơi tiếp tục chạy.
- Tay cầm: D-pad/analog trái và nút A; Start để tạm dừng/tiếp tục.
- Điện thoại: dùng các nút trái, phải và nhảy dưới màn hình.

## Kiểm tra

```sh
pnpm test
pnpm test:e2e
```

Playwright tự khởi động server nếu chưa chạy. Test bao gồm chơi đơn, lưu/tiếp tục, tự nhảy, chuyển màn, điều kiện thắng, cảm ứng, hai người cùng phòng và đếm ngược đua. Test vật lý phát lại một đường đi qua đủ 43 màn bằng input hợp lệ, có đi bộ, nhảy, băng, tuyết, dốc và gió.

## Nhập lại dữ liệu gốc

Các asset đã chuyển đổi được commit trong repository; không cần bộ cài Windows để chạy web. Bộ cài gốc được bỏ qua bởi Git.

```sh
pnpm import:original
```

Lệnh này dùng `xnb`, `pngjs`, `fast-xml-parser` và FFmpeg. Có thể truyền đường dẫn Content khác: `pnpm import:original /path/to/Content`.

Để nhập lại lời thoại tiếng Anh, dùng ILSpy xuất `en-US/LanguageJK.resources.dll` thành `.resx`, rồi chạy:

```sh
node scripts/import-original-details.cjs /path/to/LanguageJK.language.en-US.resx
```

## Mức độ tương đương bản gốc

Map, sprite và âm thanh được chuyển trực tiếp từ dữ liệu gốc. Vật lý được chuyển từ logic của bản 1.04 và nằm trong `packages/physics`, dùng chung giữa trình duyệt và server.

Đây là bản chuyển sang web có giao diện và multiplayer riêng. Chưa tái tạo đầy đủ các đoạn cắt cảnh, nhiệm vụ/vật phẩm, thành tích và một số sự kiện đặc biệt của DLC. Việc bắt đầu DLC trực tiếp trên web khác luồng mở DLC của bản Windows. Không coi việc import đủ dữ liệu là bằng chứng tương đương 100% toàn bộ game.
