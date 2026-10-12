# Jump King Web

Bản chơi web sử dụng dữ liệu từ bộ Jump King 1.04 được cung cấp trong workspace: 169 màn, 778 texture, 125 âm thanh, 32 NPC (gồm 5 thương nhân), 28 vật phẩm trên bản đồ, 4 nhiệm vụ đuổi chim và tường ẩn của 37 màn. Bản chính có đường chơi qua đủ 43 màn, được kiểm tra bằng mô phỏng thực tế từ điểm xuất phát đến điều kiện thắng.

Chơi đơn có lưu/tiếp tục trong trình duyệt, tạm dừng, điều khiển bàn phím/tay cầm/cảm ứng, thời tiết và nhạc nền. Vật phẩm, tiền, trang bị, hội thoại, giao dịch và nhiệm vụ chim dùng chung mô phỏng với server. Giant Boots ngăn đi bộ; Snake Ring làm sàn trơn. Mở đầu, cắt cảnh và ảnh kết thúc của cả ba chiến dịch dùng asset gốc, có bỏ qua; phần thưởng vẫn được trao khi bỏ qua. Bộ 48 thành tích gốc lưu trên trình duyệt. Sự kiện DLC gồm tường ẩn và âm thanh riêng, sét, gargoyle, nhạc theo vùng và đạo cụ lối vào.

Community Tower và Race Arena chạy Colyseus với dự đoán và đối chiếu trạng thái phía client. Server kiểm tra quyền sở hữu khi trang bị, tự xử lý nhặt vật phẩm và giao dịch. Chơi đơn giữ kho đồ qua các chiến dịch và lần chơi mới; phòng online có kho đồ riêng trong phiên chơi.

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

## Triển khai Cloudflare Pages

Chơi tại **https://jump-king-web.pages.dev/**.

Bản Pages phục vụ chơi đơn và các asset gốc, lưu tiến trình trên trình duyệt của người chơi. Community/Race kết nối WSS trực tiếp tới EC2 ở Singapore qua `jumpking-lighthouse2815.duckdns.org`. Wrangler để triển khai yêu cầu Node.js 22 trở lên.

```sh
pnpm exec wrangler login
pnpm exec wrangler pages project create jump-king-web --force --production-branch main
pnpm deploy:cloudflare
```

Chỉ tạo project một lần. Cấu hình `wrangler.jsonc` trỏ tới `apps/web/dist`; Pages tự phục vụ `index.html` cho các đường dẫn React như `/play`. Cờ `--force` chỉ cần khi tạo project để tránh Wrangler tự chuyển monorepo sang dự án Workers mới; khi project đã tồn tại, lệnh deploy dùng upload trực tiếp. Toàn bộ asset được tải trực tiếp lên Cloudflare, không phụ thuộc máy đang chạy lệnh triển khai.

Triển khai lại bản có multiplayer đang hoạt động:

```sh
pnpm deploy:cloudflare
```

Lệnh deploy mặc định dùng endpoint DuckDNS; có thể đặt `VITE_SERVER_URL` để đổi backend. Pages không chạy tiến trình Node.js của Colyseus; backend dùng EC2 `t3.micro`, Nginx phục vụ HTTPS/WSS với chứng chỉ Let's Encrypt. Hướng dẫn SSH, cập nhật server và giới hạn Free plan nằm trong [deploy/README.md](deploy/README.md). Không đặt token Cloudflare vào source code; Wrangler sử dụng thông tin đăng nhập cục bộ hoặc biến môi trường của CI.

## Điều khiển

Menu mở đầu dùng nền đen, khung 4:3, logo, font Litter Lover, viền, con trỏ và nhạc từ bản gốc. Nhấn **Space/Enter** hoặc chạm **Press SPACE to start** để mở menu; dùng ↑/↓ và Space/Enter để chọn, Escape để quay lại. **Other Babes** mở New Babe+ và Ghost of the Babe; **Play Online** mở Community Tower hoặc Race Arena. **Continue** giữ save; chơi mới có xác nhận nếu chiến dịch đã có save. **Options** có âm thanh, toàn màn hình và hướng dẫn; **Extras** có credits và thống kê đã lưu. **Quit** trở lại màn tiêu đề; đóng tab để thoát trình duyệt.

Trang chơi giữ bố cục 480×360, phóng theo tỉ lệ 4:3 trên nền đen. Nhấn **Escape** hoặc nút **Menu** trên điện thoại để mở menu tạm dừng: **Resume**, **Inventory**, **Options**, **Save & Exit** và **Give Up**. Kho đồ cho phép mặc/tháo vật phẩm đã sở hữu; thống kê chỉ hiện khi tạm dừng. **Options → Graphics → Display Timer** bật đồng hồ, mặc định tắt; **Audio** lưu lựa chọn âm thanh. Chơi mới và thoát có xác nhận; multiplayer dùng **Leave Room**, phòng vẫn tiếp tục chạy khi mở menu.

- Trái/phải hoặc A/D: đi bộ và chọn hướng nhảy.
- Giữ Space, W hoặc mũi tên lên: tích lực; thả để nhảy; tự nhảy khi đầy lực sau 0,6 giây.
- Không đổi hướng trên không; va tường làm bật lại.
- Escape: tạm dừng. Trên multiplayer, phòng chơi tiếp tục chạy.
- Tay cầm: D-pad/analog trái và nút A; Start để tạm dừng/tiếp tục.
- Điện thoại: dùng các nút trái, phải và nhảy dưới màn hình.

## Kiểm tra

### Tự tham quan bằng mã cheat

Trong **Chơi đơn**, nhấn **Escape → Options → Developer** (điện thoại: **Menu → Options → Developer**), nhập **`AUTOKING`** và bấm **Kích hoạt tự chơi**. Game tự tham quan đủ 169 màn của ba chiến dịch, tiếp cận vật phẩm/NPC, cấp tiền để thử cả 5 thương nhân, chạy 4 nhiệm vụ chim, mở đầu và cả 6 biến thể kết thúc. Chọn tốc độ 1×–64×; có tạm dừng/tiếp tục và **Dừng tự chơi, trở lại save**.

Đây là phiên cheat riêng dùng dịch chuyển tới vùng kích hoạt và logic tương tác thực tế. Save, kho đồ và thành tích của người chơi được giữ nguyên. Báo cáo mỗi chiến dịch ghi số màn, lần nhặt vật phẩm, NPC, giao dịch, nhiệm vụ chim và cắt cảnh đã chạy; bước không tương tác thành công sẽ báo lỗi. Các nhánh hội thoại theo điều kiện, biến thể giá mua và thử thách thành tích vẫn cần kiểm tra riêng. Chế độ này chỉ có trong chơi đơn.

```sh
pnpm test
pnpm test:e2e
```

Mặc định Playwright chạy Chromium. Để kiểm tra thêm Microsoft Edge thật và Firefox,
cài các trình duyệt rồi bật bộ test nhiều trình duyệt:

```sh
pnpm exec playwright install chromium firefox msedge
E2E_CROSS_BROWSER=1 pnpm exec playwright test e2e/browser-compat.spec.ts e2e/audio-loading.spec.ts e2e/original.spec.ts --grep 'gamepad access|storage|menu has streamed|plays without|a race starts'
```

Ngày 12/10/2026, Edge 155 và Firefox 157 trên Linux với cấu hình mặc định
đã mở được chơi đơn và Community trên bản công khai.
Khi trình duyệt chặn API tay cầm, game vẫn nhận bàn phím và cảm ứng.
Khi quyền lưu dữ liệu bị chặn hoặc bộ nhớ đầy, game vẫn mở và báo lỗi lưu;
tiến trình không được lưu qua lần đóng/tải lại trang khi không ghi được save.
Âm thanh giải mã cho Phaser dùng URL riêng để tránh dùng lại phản hồi HTTP 206
được lưu trong bộ nhớ đệm khi menu phát cùng file bằng HTML Audio.

Kiểm tra multiplayer trực tiếp trên bản công khai, không khởi động server cục bộ:

```sh
E2E_BASE_URL=https://jump-king-web.pages.dev pnpm exec playwright test e2e/original.spec.ts --grep 'community players|a race starts'
```

Playwright tự khởi động server nếu chưa chạy. Test bao gồm chơi đơn, save cũ, nhặt/mặc/tháo/lưu vật phẩm, giữ trang bị qua chiến dịch, thành tích, mở đầu, kết thúc, cảm ứng, hai người cùng phòng và đếm ngược đua. Test cắt cảnh chạy Phaser thật qua cả sáu biến thể ảnh kết thúc; harness này chỉ chạy trên dev server. Test vật lý phát lại một đường đi qua đủ 43 màn bằng input hợp lệ, có đi bộ, nhảy, băng, tuyết, dốc và gió. Script lint hiện chưa có cấu hình ESLint trong repository.

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

Đây là bản chuyển sang web. Menu mở đầu, khung chơi 4:3 và menu tạm dừng theo bố cục bản gốc, dùng logo, font, viền, con trỏ, checkbox và âm thanh gốc; thêm Play Online, điều khiển cảm ứng và công cụ Developer, điều chỉnh Options/Quit cho trình duyệt. Thành tích có mã/điều kiện của bản 1.04, dùng tên mô tả tiếng Anh và lưu cục bộ; chưa đồng bộ Steam/GOG. Việc chọn DLC trực tiếp từ menu khác luồng mở DLC của bản Windows; các hiệu ứng ngẫu nhiên không dùng cùng chuỗi random của executable. Chưa có kiểm tra đối chiếu từng khung hình hoặc phát lại toàn bộ hai DLC, vì vậy không khẳng định tương đương 100% toàn bộ game.
