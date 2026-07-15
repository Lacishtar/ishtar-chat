# Lacishtar Chat

> "Dán link YouTube Live, chọn giao diện, dán vào OBS. Xong."

**Lacishtar Chat** (tiền thân là YouTube Overlay Studio) là một ứng dụng máy tính (Desktop App) mạnh mẽ giúp chuyển đổi live chat trên YouTube thành các giao diện Overlay đẹp mắt, mượt mà và trực quan để nhúng trực tiếp vào OBS Studio cho các streamer. 

Ứng dụng hoạt động dựa trên cơ chế: Electron (Main process) điều phối 1 **hidden BrowserView** để capture DOM chat YouTube thật, chạy 1 **HTTP + WebSocket server local** để phục vụ overlay cho OBS, và 1 **Dashboard (React)** để điều khiển kết nối, chọn theme, và tùy chỉnh cấu hình hiển thị với preview realtime.

---

## Tính năng nổi bật

- ⚡ **Realtime Preview**: Trình xem trước trong Dashboard là trang overlay thật được nhúng qua iframe, đảm bảo những gì bạn thấy trên Dashboard và hiển thị trên OBS luôn trùng khớp 100%.
- 🎨 **9 Theme mặc định & Hỗ trợ Custom**: Tích hợp sẵn 9 phong cách thiết kế từ tối giản, dễ thương cho tới phong cách game thủ, cyberpunk.
- ⚙️ **Tùy chỉnh sâu & Mạnh mẽ**:
  - **Custom Size Bubble**: Tự do điều chỉnh kích thước bóng chat theo ý muốn.
  - **Text Alignment & Khung chat**: Căn chỉnh vị trí chữ (trái/phải/giữa) và căn lề khung chat linh hoạt.
  - **Font chữ đa dạng**: Hỗ trợ tích hợp thêm font chữ tùy chọn để đồng bộ với nhận diện thương hiệu của kênh stream.
  - **Phân loại vai trò (Role styling)**: Tùy biến kiểu hiển thị riêng cho Moderator, Member (Hội viên), và Superchat (bao gồm hiển thị loại tiền tệ).
  - **Trang trí nâng cao (Decorations)**: Hỗ trợ layer stack cho phép hiển thị các họa tiết trang trí đè lên hoặc nằm phía dưới văn bản chat một cách linh hoạt.
- 🔄 **Hệ thống tự động cập nhật (Auto-updater)**: Tích hợp sẵn `electron-updater` giúp ứng dụng tự động kiểm tra, tải về bản cập nhật mới trong nền từ GitHub Releases và thông báo khởi động lại để áp dụng khi hoàn tất.

---

## Cấu trúc thư mục

```text
main/                  Main process (Node) — Nguồn sự thật duy nhất
  index.js             Entry point của Electron app, điều hướng và kết nối IPC
  auto-updater.js      Quản lý logic tự động kiểm tra và tải cập nhật từ GitHub Releases
  window-manager.js    Khởi tạo BrowserWindow hiển thị Dashboard
  capture-manager.js   Quản lý hidden BrowserView + IPC nhận dữ liệu chat đã capture
  capture-preload.js   Script được tiêm vào BrowserView để theo dõi DOM (MutationObserver)
  selectors.config.json Cấu hình các selector CSS để thu dữ liệu chat (dễ dàng chỉnh sửa khi YouTube đổi giao diện)
  theme-registry.js    Trình quản lý theme ở main process
  server/http-server.js Khởi chạy HTTP Server cục bộ phục vụ các file tĩnh, overlay và themes
  server/ws-server.js   WebSocket Server để truyền tin nhắn và đồng bộ cấu hình thời gian thực
  store/               Nơi lưu trữ file config.json của ứng dụng trong thư mục userData
preload/               Preload script tạo cầu nối an toàn (contextBridge) giữa Electron và React UI
renderer-dashboard/    Mã nguồn giao diện Dashboard (React + Tailwind CSS, build bằng Vite)
overlay/               Trang hiển thị overlay thuần HTML/CSS/JS (OBS Browser Source sẽ load trang này)
themes/                Thư mục chứa các theme (mỗi theme gồm template.html, style.css và default-config.json)
shared/                Chứa các schema dùng chung và logic xử lý cấu hình (Layout, Animation, Role, Theme presets)
scripts/               Các script kiểm thử nhanh hệ thống độc lập
```

---

## Cài đặt & Khởi chạy

Yêu cầu máy tính đã cài đặt **Node.js**.

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy chế độ phát triển (Phát chạy song song cả React Dev Server và Electron)
npm run dev

# 3. Build giao diện React và chạy ứng dụng Electron giả lập production
npm run start

# 4. Đóng gói ứng dụng thành file cài đặt (.exe cho Windows hoặc .dmg cho macOS)
npm run build
```

Khi ứng dụng mở ra, dán link livestream dạng `youtube.com/watch?v=...`, `/live/...` hoặc `youtu.be/...` vào ô kết nối. Link Overlay để dán vào OBS Browser Source sẽ hiển thị ngay bên dưới khung preview.

---

## 9 Theme tích hợp sẵn

| Theme | Phong cách thiết kế |
|---|---|
| `default` | Classic Dark — Khung bubble tối, bo góc, nền mờ mềm mại |
| `minimal-white` | Tối giản sáng — Chữ tối trên nền bubble trắng, lược bỏ avatar |
| `minimal-dark` | Tối giản tối — Chữ sáng trên nền bong bóng tối mờ |
| `discord` | Discord Dark — Thiết kế lấy cảm hứng từ Discord với màu xanh Blurple |
| `cyber-neon` | Cyberpunk Neon — Khung phát sáng neon cyan/magenta, font chữ monospace |
| `pastel-pink` | Pastel Pink — Tông màu hồng phấn nhẹ nhàng, bo góc tròn rộng |
| `glassmorphism` | Kính mờ — Hiệu ứng Blur kính xuyên thấu thời thượng, viền sáng mảnh |
| `cute-bubble` | Bong bóng tròn — Kiểu bong bóng chat tinh nghịch kèm hiệu ứng xuất hiện nảy (bounce) |
| `anime` | Sakura Anime — Tông hồng đào ngọt ngào thích hợp cho các VTuber |

---

## Cơ chế tự động cập nhật (Auto-updater)

Tính năng tự động cập nhật liên kết trực tiếp với các bản phát hành (Releases) trên kho lưu trữ GitHub của bạn.

- **Khi hoạt động**: 
  - Chỉ kích hoạt khi ứng dụng chạy ở phiên bản đóng gói hoàn chỉnh (Production / Packaged). Khi chạy ở chế độ dev (`npm run dev`), hệ thống sẽ bỏ qua để tránh lỗi.
  - Khi có phiên bản mới tải lên GitHub Releases công khai, ứng dụng sẽ tự động tải phiên bản đó về trong nền.
  - Sau khi tải xong, một hộp thoại sẽ hiển thị hỏi người dùng có muốn khởi động lại ngay lập tức để cập nhật hay không. Nếu người dùng chọn "Để sau", bản cập nhật sẽ được áp dụng vào lần tiếp theo khi tắt mở ứng dụng.

- **Cách phát hành bản cập nhật**:
  1. Tăng số `version` trong `package.json` (Ví dụ từ `1.0.0` lên `1.0.1`).
  2. Đặt mã thông báo GitHub cá nhân (Personal Access Token) vào biến môi trường `GH_TOKEN` trên thiết bị build của bạn.
  3. Chạy lệnh đóng gói và tự động đẩy lên nháp:
     ```bash
     # electron-builder sẽ tự động build và upload lên GitHub Releases nháp dựa trên cấu hình publish trong package.json
     npm run build
     ```
  4. Truy cập GitHub Releases của dự án, kiểm tra bản nháp và nhấn **Publish Release**.

---

## Hướng dẫn phát triển & Khắc phục lỗi

### Tùy biến hoặc Thêm Theme mới
Bạn có thể dễ dàng thêm theme tùy chỉnh bằng cách tạo một thư mục mới trong `/themes` có cấu trúc:
- `template.html`: Chứa khung HTML của một dòng chat. Bắt buộc có đủ 4 thuộc tính `data-slot="avatar|author|badges|message"` để script tự động điền dữ liệu.
- `style.css`: CSS áp dụng cho dòng chat của theme đó. Bạn có thể sử dụng các biến CSS `--ovs-*` được tính toán sẵn từ cấu hình chung.
- `default-config.json`: Chứa cấu hình mặc định cho theme này (bao gồm trường `_label` đặt tên hiển thị).

### Cấu hình bộ thu dữ liệu chat khi YouTube đổi giao diện
Nếu YouTube thay đổi cấu trúc trang web khiến tính năng kết xuất chat bị hỏng:
- Bạn chỉ cần mở tệp [selectors.config.json](file:///c:/Users/LENOVO/Projects/youtube-overlay-studio/youtube-overlay-studio/main/selectors.config.json).
- Cập nhật lại các Selector CSS cho phù hợp mà không cần phải can thiệp hay sửa đổi bất cứ mã nguồn JavaScript nào của ứng dụng.
