# Server multiplayer đang triển khai

Frontend: https://jump-king-web.pages.dev/. API/WebSocket: https://jump-king-server.alexnguyena47.workers.dev/health và `wss://jump-king-server.alexnguyena47.workers.dev`.

EC2 chạy Colyseus bằng systemd; Nginx kiểm tra token của Worker rồi chuyển tiếp tới cổng 2567. Worker dùng hostname AWS cấp vì Cloudflare không hỗ trợ `fetch()` trực tiếp tới IP. Kết nối từ trình duyệt tới Cloudflare dùng HTTPS/WSS; kết nối từ Worker tới EC2 dùng HTTP và token riêng.

## Bản cập nhật 11/10/2026

Menu mở đầu: frontend `7d43795f`, bản Pages https://bf8aeae4.jump-king-web.pages.dev/; production https://jump-king-web.pages.dev/. Menu dùng nền đen 4:3, logo, font Litter Lover, viền, con trỏ và nhạc gốc. Nhấn Space/Enter hoặc chạm lời nhắc để mở; **Other Babes** chọn DLC, **Play Online** vào Community Tower/Race Arena. Continue và xác nhận chơi mới dùng save thật; Options/Extras có chức năng cho trình duyệt.

Build workspace và build Cloudflare từ checkout sạch thành công. 18 test trình duyệt cục bộ và 6 test trực tiếp trên production đã qua, gồm điều hướng bàn phím, cảm ứng, giữ save chiến dịch khác, tiếp tục DLC, âm thanh, thống kê, toàn màn hình và vào phòng online. Nhạc mở đầu kết thúc bằng sự kiện media thật rồi chuyển sang đoạn lặp; mọi âm thanh menu dừng khi vào game. Test phát nhạc nhanh thay cho tua gần cuối để không phụ thuộc cách CDN xử lý việc tìm vị trí trong Ogg. Font/viền/con trỏ production tải thành công, API trả về `{"status":"ok"}`. Backend và tài nguyên AWS giữ cấu hình hiện có.

Chế độ `AUTOKING`: frontend `f57ba4ac`, bản Pages https://e04bb3c5.jump-king-web.pages.dev/; production https://jump-king-web.pages.dev/. Trong Chơi đơn, mở **Chạy thử tự động**, nhập mã và chọn tốc độ 1×–64×. Phiên cheat tham quan 169 màn, thử 32 NPC, 5 thương nhân, 4 nhiệm vụ chim và 6 biến thể kết thúc, giữ nguyên save và profile thật. Tính năng chạy trong trình duyệt và được triển khai từ checkout sạch của commit đã push.

Build Cloudflare thành công; 151 test đơn vị, 26 test trình duyệt cục bộ và 15 test trên production đã qua. Kiểm tra gồm hành trình tham quan cả ba chiến dịch, mã sai, tạm dừng, báo cáo tương tác, khôi phục save có Cap, giao diện điện thoại và Community/Race hai người. Lượt tham quan production ở 64× hoàn tất trong khoảng 2 phút 36 giây trên máy kiểm tra. API production trả về `{"status":"ok"}`.

White Raven bắt đầu ở màn 0 và đi xuyên sang New Babe+. Vì vậy báo cáo bản chính có 6 NPC (gồm Fairy 2 của DLC) và 2 nhiệm vụ chim; New Babe+ có 14 NPC và 0 nhiệm vụ chim; Ghost có 13 NPC và 2 nhiệm vụ chim. NPC có thể được gặp lại giữa các lượt; toàn bộ 32 NPC trong dữ liệu đều được kiểm tra bằng mô phỏng.

### Bản gameplay trước chế độ tham quan

Code game: `f1153318`; bản Pages: https://534637d3.jump-king-web.pages.dev/ (production https://jump-king-web.pages.dev/). Đã cập nhật backend trên EC2 hiện có, giữ Nginx và timer dừng trước hạn Free plan.

Đã xác minh build, 148 test đơn vị, 23 test trình duyệt cục bộ và 12 test trực tiếp trên production. Kiểm tra gồm save cũ, Cap, giữ trang bị qua chiến dịch, thành tích, cắt cảnh/phần thưởng, cảm ứng, Community và Race hai người. Kết nối WSS production có trạng thái vật phẩm/hội thoại mới và từ chối yêu cầu mặc Snake Ring chưa sở hữu. Service và timer đều active; số lần service tự khởi động lại là 0 sau cập nhật.

Kho đồ chơi đơn và thành tích nằm trong localStorage; kho đồ online nằm trong phiên phòng. Các giới hạn so với bản Windows được ghi tại [README](../README.md#mức-độ-tương-đương-bản-gốc).

## Tài nguyên AWS

| Cấu hình       | Giá trị                                        |
| -------------- | ---------------------------------------------- |
| Region         | `ap-southeast-1` (Singapore)                   |
| Instance       | `i-03b3d45adc111b170`, tên `jump-king-online`  |
| Máy            | Ubuntu 24.04, `t3.micro`, CPU credits Standard |
| Đĩa            | 8 GiB gp3, mã hóa, xóa khi terminate           |
| IPv4           | `47.129.183.31`                                |
| Security group | `sg-0b6bc648ab633e33b`                         |
| SSH            | Chỉ IP triển khai `171.250.215.52/32`          |
| HTTP           | Cổng 80, Nginx yêu cầu origin token            |

Cổng 2567 không mở ra Internet. Không có Elastic IP, load balancer, NAT Gateway hay database riêng. Public IP và hostname có thể đổi khi stop/start; khi đó cập nhật `GAME_ORIGIN` trong `cloudflare-server/wrangler.jsonc` rồi chạy `pnpm deploy:server`.

## Giới hạn miễn phí đã xác minh

Ngày 11/10/2026, API AWS xác nhận tài khoản đang ở **FREE / ACTIVE**, còn khoảng **49,03 USD credit**, hết hạn **28/10/2026 lúc 03:12:23 UTC**. EC2, đĩa và IPv4 sử dụng credit. [AWS Free plan](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html) không thu tiền trước khi chuyển sang Paid plan và đóng tài khoản khi hết thời hạn hoặc credit.

Không nâng cấp tài khoản sang Paid plan. Server này không miễn phí vô thời hạn. Timer `jump-king-free-expiry.timer` tự dừng EC2 lúc **28/10/2026 02:00 UTC (09:00 giờ Việt Nam)**, trước hạn đã xác minh. Nếu credit hết sớm hơn, AWS Free plan đóng tài khoản sớm hơn. Timer không gia hạn Free plan và không xóa tài nguyên.

Kiểm tra trạng thái hiện tại bằng phiên AWS CLI đã đăng nhập:

```sh
aws freetier get-account-plan-state --profile jump-king --region us-east-1
```

## SSH và vận hành

```sh
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes ubuntu@47.129.183.31
sudo systemctl status jump-king nginx jump-king-free-expiry.timer
sudo journalctl -u jump-king -n 50 --no-pager
sudo systemctl list-timers jump-king-free-expiry.timer
curl --fail http://127.0.0.1:2567/health
```

Nếu IP của máy triển khai đổi, sửa rule SSH của security group tới IP mới; giữ giới hạn `/32`.

## Cập nhật backend

Build và đóng gói trên máy phát triển để EC2 chỉ chạy runtime. Gói deploy chứa các package workspace đã build và dependency production; EC2 không cần toàn bộ asset web.

```sh
pnpm build
release_dir=$(mktemp -d)
pnpm --filter game-server deploy --prod "$release_dir/server"
tar -czf "$release_dir/backend.tar.gz" -C "$release_dir/server" build node_modules package.json
scp -i ~/.ssh/id_ed25519 "$release_dir/backend.tar.gz" deploy/ec2/setup.sh deploy/ec2/nginx.conf.template deploy/ec2/*.service deploy/ec2/*.timer ubuntu@47.129.183.31:jump-king-deploy/
ssh -i ~/.ssh/id_ed25519 ubuntu@47.129.183.31 'cd ~/jump-king-deploy && bash setup.sh'
```

`setup.sh` tải Node.js 24 từ nodejs.org, kiểm tra SHA-256, cài Nginx, cập nhật service rồi khởi động lại backend. Token `.origin-token` đã đặt ở `~/jump-king-deploy/` trên EC2 với quyền `0600`, nằm ngoài Git. Không in token hoặc chép vào source code.

## Cập nhật Cloudflare

```sh
pnpm deploy:server
VITE_SERVER_URL=wss://jump-king-server.alexnguyena47.workers.dev pnpm deploy:cloudflare
curl --fail https://jump-king-server.alexnguyena47.workers.dev/health
```

Worker secret `ORIGIN_TOKEN` phải khớp `.origin-token` trên EC2. Khi xoay token, dùng `wrangler secret put` với stdin từ file riêng rồi chạy lại cấu hình Nginx; không đưa token vào dòng lệnh hoặc Git. Cấu hình Worker chỉ chứa `GAME_ORIGIN`, không chứa secret.
