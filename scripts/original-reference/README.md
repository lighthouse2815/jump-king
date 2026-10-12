# Shader gốc Jump King 1.04

`Mask.xnb` giữ bytecode của effect MonoGame để đối chiếu mà không cần bộ cài Windows. Đây không phải shader có thể tải vào Phaser/WebGL.

`WeatherInstance.GetMask` chọn texture `screens/masks/{weatherName}mask{screen + 1}`; khi không có mask, game dùng một pixel alpha đầy đủ. `MaskShader.Draw` lặp texture thời tiết trong khung 480×360, lọc điểm ảnh và áp mask; `Update` dịch texture ngang theo gió. Bản web dùng TileSprite và BitmapMask của Phaser cho cùng mục đích.

Đối chiếu shader DXBC trong `Mask.xnb` cho thấy phép tính là `sample(SpriteTexture, uv * tiling + (wind, 0)) * sample(MaskTexture, uv).aaaa`: nhân cả RGBA theo alpha mask, không đảo alpha. `tiling` lấy thương nguyên của kích thước 480×360 với kích thước texture; `wind` tích lũy `CurrentVelocityRaw * (-2/3)` mỗi tick. BitmapMask của Phaser cũng nhân RGBA với alpha mask; TileSprite nhận độ dịch theo đơn vị UV nhân chiều rộng texture.

`shaders/test_mask.xnb` thực ra là Texture2D; importer xuất thành `public/original/shaders/test_mask.png`. Giữ tài nguyên để đối chiếu, không tự thêm hiệu ứng test vào game.

Các SpriteFont XNB đã xuất thành atlas PNG và BMFont XML trong `public/original/font`, bao gồm vị trí glyph, crop, khoảng cách và chiều cao dòng. Không cần giữ định dạng XNB để vẽ font trên web.
