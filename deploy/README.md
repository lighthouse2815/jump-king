# Server multiplayer đang triển khai

Frontend: https://jump-king-web.pages.dev/. API/WebSocket trực tiếp: https://jumpking-lighthouse2815.duckdns.org/health và `wss://jumpking-lighthouse2815.duckdns.org`.

EC2 chạy Colyseus bằng systemd. Nginx nhận HTTPS/WSS trực tiếp trên cổng 443 bằng chứng chỉ Let's Encrypt rồi chuyển tiếp nội bộ tới cổng 2567. Frontend vẫn nằm trên Pages. Endpoint Worker cũ được giữ để dự phòng; chỉ endpoint dự phòng này dùng origin token.

## Bản cập nhật 12/10/2026

### Chat trong phòng

Đã triển khai frontend và backend của commit `2b9707ff` lên link production hiện có.
Bản Pages: https://8672ca7d.jump-king-web.pages.dev/; bundle `index-DIdMpkfR.js`.
Backend ghi SHA `2b9707ff8ba972c03b303baabce5af58d002cba7` trong
`/opt/jump-king/build/revision.txt`. Gói trước cập nhật được sao lưu ở
`~/jump-king-deploy/backend-before-2b9707ff8ba972c03b303baabce5af58d002cba7.tar.gz`.
Service và Nginx active, `NRestarts=0`, health HTTPS trả `{"status":"ok"}`;
timer SSL và hạn Free plan vẫn active.

Chat giữ 50 tin trong bộ nhớ từng phòng, mờ sau 6 giây, hiện lại khi rê chuột,
nhấn Enter hoặc chạm nút Chat. Ba tình huống Playwright chat đã qua trên production:
Community, Race và validation/lịch sử/xóa phòng qua WSS thật. Bao gồm nhập tiếng Việt,
hiển thị HTML dưới dạng văn bản, ngăn phím chat điều khiển nhân vật, cảm ứng,
người mới xem lại lịch sử, giới hạn 200 ký tự, cooldown và tách biệt hai phòng.
Test Community dùng một phòng server thật riêng để không phụ thuộc người đang chơi.
Lượt đầu test Community gặp phòng có người chơi và không qua điều kiện đếm đúng hai người;
sau khi tách phòng, test này đã qua. Kiểm tra lịch sử dùng 6 client; tải 20 client chưa được xác nhận ổn định.

### Hoạt họa và âm thanh online

Đã triển khai frontend và backend từ checkout sạch của commit `858b2050` đã push.
Production vẫn là https://jump-king-web.pages.dev/; bản Pages tương ứng:
https://5502f129.jump-king-web.pages.dev/. Cloudflare xác nhận deployment
`5502f129-2e76-4515-935f-7c648f194abb` thuộc environment production, nhánh `main`, trạng thái success.
HTML trên link production khớp bản build, dùng bundle `index-BOPJlJ65.js`.

Backend vẫn chạy trên EC2 cũ `47.129.183.31`, qua HTTPS/WSS DuckDNS cũ.
File `/opt/jump-king/build/revision.txt` ghi đầy đủ SHA của bản mới. Gói runtime trước cập nhật
được sao lưu tại `~/jump-king-deploy/backend-before-20261012-858b2050.tar.gz` trên EC2.
Service chạy ổn định, `NRestarts=0`; health trả `{"status":"ok"}`. Nginx kiểm tra cấu hình thành công;
timer gia hạn SSL và timer dừng trước hạn Free plan vẫn active. Không đổi cấu hình hạ tầng hiện có.

Bản này gồm các sửa quyền tay cầm/lưu dữ liệu, cache âm thanh HTTP 206, hoạt họa nhân vật online
khác và âm thanh nhảy/tiếp đất/ngã/va chạm theo sự kiện server. Build Cloudflare thành công;
153 test của workspace đã qua trước triển khai.

Trên link production cũ, 6 test Playwright chơi đơn/lưu/tiếp tục và Race hai người đã qua
trên Chromium, Edge 155 và Firefox 157 trên Linux. Thêm 6 kiểm tra Community/Race hai người
trên ba trình duyệt quan sát khung hình đi bộ/tích lực/nhảy/rơi, sự kiện phát âm thanh thật của
Phaser, tiếng nhảy/tiếp đất của người khác, tắt tiếng và không phát trùng tiếng nhảy của mình;
không có lỗi JavaScript. Probe hai client Colyseus qua WSS production cũng nhận đúng một lần
nhảy và tiếp đất từ server. Các kiểm tra này không đo âm thanh phát ra loa vật lý hoặc xác minh
từng khung hình của bản Windows.

## WSS trực tiếp qua DuckDNS

Domain `jumpking-lighthouse2815.duckdns.org` trỏ về `47.129.183.31`. Security group cho phép TCP 443; TCP 2567 vẫn chỉ phục vụ nội bộ. `certbot.timer` tự gia hạn chứng chỉ bằng HTTP challenge; hook `renew-nginx.sh` kiểm tra rồi reload Nginx sau khi gia hạn.

```sh
scp -i ~/.ssh/id_ed25519 deploy/ec2/setup-direct.sh deploy/ec2/nginx-direct*.conf.template deploy/ec2/renew-nginx.sh ubuntu@47.129.183.31:jump-king-deploy/
ssh -i ~/.ssh/id_ed25519 ubuntu@47.129.183.31 'cd ~/jump-king-deploy && bash setup-direct.sh jumpking-lighthouse2815.duckdns.org'
curl --fail https://jumpking-lighthouse2815.duckdns.org/health
pnpm deploy:cloudflare
```

Các lần cập nhật backend bằng `setup.sh` giữ vhost HTTPS riêng. Nếu EC2 đổi public IP sau stop/start, cập nhật IP của domain trong DuckDNS. Không lưu token DuckDNS hoặc khóa chứng chỉ trong repository. Ngày kiểm tra 11/10/2026, AWS vẫn là FREE/ACTIVE, còn 48,78 USD credit; tài nguyên và timer hạn Free plan giữ nguyên.

Bản triển khai trực tiếp: code `52131dfb`, Pages https://61e56ec0.jump-king-web.pages.dev/; production https://jump-king-web.pages.dev/. Build từ checkout riêng thành công; bundle production chứa endpoint DuckDNS. Hai test Chrome production về Community hai người và Race hai người đã qua trong 24,9 giây. HTTPS health trả `{"status":"ok"}`, Nginx syntax hợp lệ, các timer gia hạn SSL và hạn Free plan đều active. `certbot renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew` thành công, gồm reload Nginx.

Probe Colyseus từ máy triển khai, mỗi endpoint 8 giây với input 60Hz: trực tiếp vào phòng 819 ms, ACK trung vị 91 ms, P95 109 ms (159 mẫu); Worker vào phòng 5906 ms, ACK trung vị 177 ms, P95 246 ms (140 mẫu). Đây là một lượt đo so sánh từ máy triển khai, không đảm bảo ping của mọi người chơi hoặc loại trừ lỗi prediction/rendering phía client. Frontend mới gửi matchmaking và WebSocket thẳng tới EC2; Worker cũ không nằm trên đường kết nối mặc định.

## Bản cập nhật 11/10/2026

Giao diện chơi: frontend `20f07ff9`, bản Pages https://727eb48d.jump-king-web.pages.dev/; production https://jump-king-web.pages.dev/. Khung chơi 480×360 phóng theo tỉ lệ 4:3 trên nền đen. Menu tạm dừng dùng font, viền, con trỏ, checkbox và âm thanh gốc; có Resume, Inventory, Options, Save & Exit/Leave Room và Give Up. Thống kê nằm trong menu; đồng hồ mặc định tắt, bật ở Options → Graphics → Display Timer.

Nhập `AUTOKING` ở **Escape → Options → Developer** (điện thoại: **Menu → Options → Developer**). Bàn phím chuyển hoàn toàn sang menu khi tạm dừng; tiếp tục bằng tay cầm đóng ô nhập cheat. Thoát trang đóng phiên Colyseus và âm thanh ngay, không chờ khung hình tiếp theo của Phaser. Lỗi không có nội dung vẫn hiện thông báo; lỗi tải asset giữ nguyên khi phòng tiếp tục đồng bộ. **Thử lại** trở về đúng phòng Community đang có bạn chơi; nếu phòng đã đóng, game tìm/tạo phòng mới bằng Colyseus. Các lỗi kết nối khác được báo, không tự bỏ qua. Build và triển khai từ checkout sạch của commit đã push; backend và tài nguyên AWS giữ cấu hình hiện có.

Build workspace/Cloudflare thành công. 27 kiểm tra trình duyệt cục bộ cho giao diện đã qua, gồm toàn bộ lượt AUTOKING qua 169 màn; các sửa vòng đời và khôi phục phiên được kiểm tra tiếp bằng 15, 11 và các test bổ sung liên quan. Trên frontend cuối, 12 tình huống đã qua trên Chrome production qua hai lượt: lượt tổng qua 11/12; test khôi phục phòng hai người được chạy riêng lại và qua trong 23,7 giây. Kiểm tra gồm Play Online, Community/Race hai người, bàn phím, tay cầm, cảm ứng, toàn màn hình, lưu tùy chọn, Give Up, mất mạng, lỗi asset, giữ ID phòng và Thử lại khi chỉ có một người. Test ngắt mạng giữ response matchmaking thật; test asset chặn một PNG và quan sát cập nhật từ người chơi thứ hai, sau đó tải lại và kết nối server thật.

Trong các lượt production có lúc handshake/ACK WebSocket chậm; probe riêng cũng quan sát ACK bị trễ khi bản tin trạng thái vẫn tới. Bộ headless shell có lượt mắc lúc đóng context; kiểm tra cuối dùng Chrome cài trên máy với cùng các điều kiện kiểm tra game. Không bỏ giới hạn 180 input chưa được xác nhận và không bỏ validation để vượt kiểm tra. API trả `{"status":"ok"}`; service EC2 active, số lần tự khởi động lại là 0. Đây là kết quả xác minh từng tình huống, không phải khẳng định mọi lượt chạy production đều thành công hoặc hình ảnh khớp từng khung hình với bản Windows.

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
| HTTPS/WSS      | Cổng 443, chứng chỉ Let's Encrypt             |
| HTTP           | Cổng 80, ACME challenge và Worker dự phòng     |

Cổng 2567 không mở ra Internet. Không có Elastic IP, load balancer, NAT Gateway hay database riêng. Public IP và hostname có thể đổi khi stop/start; khi đó cập nhật IP DuckDNS. Nếu cần giữ Worker dự phòng, cập nhật thêm `GAME_ORIGIN` trong `cloudflare-server/wrangler.jsonc` rồi chạy `pnpm deploy:server`.

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
pnpm deploy:cloudflare
curl --fail https://jumpking-lighthouse2815.duckdns.org/health
```

Worker secret `ORIGIN_TOKEN` phải khớp `.origin-token` trên EC2. Khi xoay token, dùng `wrangler secret put` với stdin từ file riêng rồi chạy lại cấu hình Nginx; không đưa token vào dòng lệnh hoặc Git. Cấu hình Worker chỉ chứa `GAME_ORIGIN`, không chứa secret.

## Deploy tự động bằng GitHub Actions

Workflow [Deploy production](../.github/workflows/deploy.yml) chạy khi push lên `main`
hoặc chạy thủ công trên nhánh `main`. GitHub build, chạy test workspace và test chat bằng
Chromium/server thật, rồi tạo hai artifact. Job backend chạy trên runner EC2 có label
`jump-king-production`, sao lưu runtime, cập nhật và kiểm tra health; nếu lỗi, script
[apply-backend.sh](ec2/apply-backend.sh) khôi phục gói cũ. Sau khi backend thành công,
job frontend upload artifact lên Cloudflare Pages production. Các lượt deploy chạy lần lượt.

Repository cần secret `CLOUDFLARE_API_TOKEN` có quyền **Account → Cloudflare Pages → Edit**
cho account chứa project, và variable `CLOUDFLARE_ACCOUNT_ID`. Runner EC2 cần đăng ký
với repository này và chạy bằng systemd dưới user `ubuntu`; chỉ nhận job triển khai,
phần build/test chạy trên runner GitHub. Không cần khóa SSH trong GitHub Secrets.
Theo dõi kết quả tại https://github.com/lighthouse2815/jump-king/actions.
Timer dừng EC2 trước hạn Free plan vẫn áp dụng; khi EC2 dừng, job backend không chạy được.
