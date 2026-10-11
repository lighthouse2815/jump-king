# Bổ sung game gốc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung các hệ thống còn thiếu của Jump King 1.04 vào bản chơi web và online hiện có.

**Architecture:** Dữ liệu gốc được nhập vào maps và asset manifest. Luật vật phẩm, trang bị và sự kiện chạy trong physics; Phaser vẽ các trạng thái và cắt cảnh, Colyseus gửi snapshot có trạng thái mới.

**Tech Stack:** TypeScript, React, Phaser, Colyseus, Vitest, Playwright, XMLParser đã cài.

**Spec:** `docs/superpowers/specs/2026-10-11-original-completion.md`

## Global Constraints

- Không thêm dependency sản phẩm; không thay đổi stack hoặc database.
- Save v1 cũ vẫn đọc được; không nhận inventory tùy ý từ client.
- Luật phải dựa trên executable/Content 1.04 và kiểm tra hành vi thực tế.
- Mỗi phần hoàn thành: kiểm tra, commit tiếng Việt có dấu, push GitHub.
- Giữ AWS Free plan và timer tự dừng; không sửa ba file legacy đang có thay đổi.

## Review Focus

- Save cũ hoặc hỏng không làm game crash.
- Trang bị chưa sở hữu bị từ chối; không mặc hai vật cùng layer.
- Nhặt lại khi reload/chuyển màn không tăng tiền hai lần.
- Rời trang hoặc bỏ qua cắt cảnh phải hủy timer/tween/âm thanh.
- Multiplayer cùng input và snapshot phải tạo cùng kết quả sau reconcile.

## Task 1: Dữ liệu và luật vật phẩm/nhiệm vụ

**Files:** `scripts/import-original-details.cjs`, `packages/maps/src/original-adventure-data.json`, `packages/maps/src/index.ts`, `packages/physics/src/OriginalAdventure.ts`, `packages/physics/src/OriginalSimulation.ts`, `packages/physics/tests/adventure.test.ts`.

**Interfaces:** `OriginalAdventure(data, state?)` sở hữu inventory, equipped, collected, merchant và bird state. `tick(state)` cập nhật thế giới; `getState()/restore()` cho snapshot; `setEquipped(item, enabled)` kiểm tra sở hữu/layer.

- [ ] Test trước: Cap nhặt một lần, GiantBoots trưng bày không nhặt, bán Shoes đúng giá/đủ tiền, restore không nhân tiền, mặc đúng layer.
- [ ] Chạy Vitest xác nhận thiếu hành vi.
- [ ] Nhập XML/lời thoại và thực hiện luật dùng chung; nối trang bị vào OriginalSimulation.
- [ ] Chạy test, build physics/maps; commit và push phần hoàn thành.

## Task 2: Giao diện và online

**Files:** `apps/web/src/game/scenes/OriginalScene.ts`, `apps/web/src/game/originalAssets.ts`, `apps/web/src/game/soloSave.ts`, `apps/web/src/pages/OriginalGamePage.tsx`, `apps/game-server/src/rooms/OriginalRoom.ts`, `e2e/original.spec.ts`.

**Interfaces:** Snapshot có adventure tùy chọn; message `equip` chỉ chứa tên vật và trạng thái bật/tắt. UI hiển thị inventory và nhiệm vụ từ snapshot.

- [ ] Test trước: nhặt Cap trên map thật, lưu/tiếp tục, toggle trang bị, từ chối vật chưa sở hữu.
- [ ] Vẽ item/chim/skin bằng asset gốc; xử lý trigger NPC dạng screen_rect; hiển thị cuộc giao dịch.
- [ ] Khởi tạo adventure ở client/server, xác thực equip, lưu profile chơi đơn.
- [ ] Chạy test trình duyệt và multiplayer; commit/push.

## Task 3: Thành tích

**Files:** `packages/physics/src/OriginalAchievements.ts`, `packages/physics/tests/achievements.test.ts`, tích hợp vào scene/profile/UI.

**Interfaces:** Bộ đánh giá nhận OriginalState và context campaign, completion, inventory, equipped, NPC/flags; trả các mã mới đạt và lưu tiến trình.

- [ ] Test điều kiện gốc và các biên; thực hiện catalogue/bộ đánh giá.
- [ ] Nối sự kiện game và profile; hiển thị thông báo/danh sách thành tích.
- [ ] Chạy test/build, commit/push.

## Task 4: Cắt cảnh và sự kiện DLC

**Files:** `apps/web/src/game/OriginalCutscenes.ts`, `packages/physics/src/OriginalWorldEvents.ts`, `packages/physics/tests/world-events.test.ts`, scene/simulation và test trình duyệt.

**Interfaces:** Cắt cảnh nhận scene/campaign/trang bị/callback, có skip/destroy; WorldEvents có state serializable và vùng collision/event output.

- [ ] Kiểm tra kích hoạt một lần, save/restore, collision thật và bỏ qua cắt cảnh.
- [ ] Chạy mở đầu/kết thúc đủ ba campaign bằng sprite/âm thanh gốc.
- [ ] Nối collision/hiệu ứng DLC vào mô phỏng và renderer.
- [ ] Chạy test/build, commit/push.

## Task 5: Triển khai và đối chiếu

- [ ] Kiểm tra toàn bộ build/test và các luồng mới.
- [ ] Cập nhật runbook/README đúng phạm vi đã thực hiện, ghi khác biệt còn lại.
- [ ] Deploy backend EC2, frontend Cloudflare với URL multiplayer hiện có.
- [ ] Kiểm tra bản công khai, commit/push và báo cáo bằng kết quả thực tế.
