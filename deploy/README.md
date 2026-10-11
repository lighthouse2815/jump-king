# Server multiplayer đang triển khai

Frontend: https://jump-king-web.pages.dev/. API/WebSocket: https://jump-king-server.alexnguyena47.workers.dev/health và `wss://jump-king-server.alexnguyena47.workers.dev`.

EC2 chạy Colyseus bằng systemd; Nginx kiểm tra token của Worker rồi chuyển tiếp tới cổng 2567. Worker dùng hostname AWS cấp vì Cloudflare không hỗ trợ `fetch()` trực tiếp tới IP. Kết nối từ trình duyệt tới Cloudflare dùng HTTPS/WSS; kết nối từ Worker tới EC2 dùng HTTP và token riêng.

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
