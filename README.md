# YouTube Overlay Studio — MVP

> "Dán link YouTube Live, chọn giao diện, dán vào OBS. Xong."

Khung MVP đầy đủ theo đúng kiến trúc trong tài liệu thiết kế: Electron (Main
process) điều phối 1 **hidden BrowserView** để scrape DOM chat YouTube, chạy
1 **HTTP + WebSocket server local** để phục vụ overlay cho OBS, và 1
**Dashboard (React)** để Connect / chọn Theme / Customize với preview
realtime (chính là overlay page nhúng qua iframe — không phải bản giả lập
riêng, nên preview và OBS luôn khớp nhau).

## Cấu trúc

```
main/                  Main process (Node) — nguồn sự thật duy nhất
  index.js             entry point, wiring toàn bộ app
  window-manager.js     tạo Dashboard BrowserWindow
  scraper-manager.js    quản lý hidden BrowserView + IPC nhận dữ liệu scrape
  scraper-preload.js    script tiêm vào BrowserView (MutationObserver)
  selectors.config.json CSS selector của YouTube — sửa file này khi YouTube đổi DOM
  theme-registry.js     đọc danh sách theme + default-config.json
  server/http-server.js Express — serve /overlay và /themes
  server/ws-server.js   WebSocket — broadcast chat:new / theme:changed / config:updated
  store/config-store.js đọc/ghi config.json trong userData (không DB)
preload/dashboard-preload.js   contextBridge — window.api cho Dashboard
renderer-dashboard/    Dashboard UI (React + Tailwind, build bằng Vite)
overlay/               Trang overlay thuần HTML/CSS/JS (OBS Browser Source load trang này)
themes/                9 theme: classic, bubble, glass, minimal, anime, cyber, danmaku, ticker, scrapbook
                       (mỗi theme = template.html + style.css + default-config.json)
shared/                Schema dùng chung (ChatMessage, CustomizeConfig)
scripts/smoke-test-server.js   Test HTTP+WS server độc lập, không cần Electron
```

## Cài đặt & chạy

```bash
npm install

# Chạy dev (Vite dashboard + Electron cùng lúc, có hot reload cho UI)
npm run dev

# Hoặc build dashboard rồi chạy bản gần-production
npm run start
```

Khi app mở, dán link `youtube.com/watch?v=...`, `/live/...` hoặc `youtu.be/...`
đang có live chat vào Connect Panel. Overlay URL để dán vào OBS Browser Source
nằm ngay dưới khung preview (nút "Copy URL cho OBS").

## 9 theme có sẵn

| Theme | Phong cách |
|---|---|
| `classic` | Bubble tối giản, nền mờ, phù hợp đa số stream |
| `bubble` | Bong bóng chat kiểu Messenger, có đuôi bong bóng |
| `glass` | Glassmorphism — kính mờ, viền sáng, đổ bóng mềm |
| `minimal` | Không khung nền, chỉ chữ — `Tên: nội dung`, tối giản tối đa |
| `anime` | Pastel hồng/tím, viền avatar đứt nét, có icon ✦ trang trí, phù hợp VTuber |
| `cyber` | Cyberpunk neon — viền phát sáng, chữ hoa, font mono |
| `danmaku` | Bullet-comment kiểu Niconico/Bilibili — tin bay ngang màn hình thay vì xếp chồng dọc |
| `ticker` | News ticker — chữ chạy ngang kiểu bản tin, phù hợp overlay dưới cùng màn hình |
| `scrapbook` | Scrapbook/collage — layout riêng qua `layout-config.json` + `slot-style-config.json` |

Tất cả theme dùng chung 1 bộ CSS variable do Customize Panel điều khiển
(`shared/customize-config.js#toCssVariables`), nên panel hoạt động giống nhau
dù đang dùng theme nào — trừ các ngoại lệ có ghi chú ngay trong CSS theme
(`themes/minimal/style.css`, `themes/danmaku/style.css`, `themes/ticker/style.css`:
minimal bỏ qua màu nền bubble/bo góc vì không có khung; danmaku và ticker bỏ
qua một số tuỳ chỉnh animation vì tốc độ/chuyển động được set riêng theo layout
— xem comment đầu file CSS tương ứng để biết chi tiết).

Thêm theme mới bằng cách tạo 1 thư mục trong `/themes` với `template.html`
(giữ nguyên 4 hook `data-slot="avatar|author|badges|message"` để tương thích
với `overlay/overlay-client.js`) + `style.css` (đọc từ các CSS variable
`--ovs-*`, xem `themes/classic/style.css` làm mẫu) + `default-config.json`
(bắt buộc có `_label`).

## Test server độc lập (không cần Electron/OBS)

```bash
node scripts/smoke-test-server.js
```

Script này khởi động HTTP+WS server thật, gọi `/overlay`, `/overlay/overlay-client.js`,
`/themes/classic/...`, và bắn thử 1 message qua WebSocket — dùng để xác nhận
tầng server không lỗi trước khi đụng tới Electron/BrowserView.

## ⚠️ Điểm cần bạn tự kiểm tra trước khi dùng thật

Môi trường tôi build/hoàn thiện code này **không có quyền truy cập youtube.com
và không chạy được Electron GUI** (network sandbox chỉ cho phép npm/GitHub,
không cho domain youtube.com/ytimg.com), nên tôi đã:

- ✅ Syntax-check toàn bộ file trong `main/`, `preload/`, `shared/`, `overlay/`
- ✅ Chạy thật HTTP+WS server (Express/`ws`) qua `scripts/smoke-test-server.js` — pass
- ✅ Build thật Dashboard React/Tailwind bằng Vite — pass
- ✅ Viết thêm script kiểm tra riêng cho vòng lặp "9 theme": xác nhận
  `theme-registry.listThemes()` trả đúng 9 theme, mỗi theme có `_label`,
  `template.html` (đủ 4 `data-slot`), `style.css` (đọc đủ các CSS variable
  liên quan), và cả `template.html` + `style.css` đều serve được qua HTTP
  server thật (`/themes/:id/template.html`, `/themes/:id/style.css`) — pass
  cho cả 9 theme
- ❌ **Chưa** kiểm tra được `main/selectors.config.json` khớp với DOM thật của
  `youtube.com/live_chat` — các selector (`yt-live-chat-text-message-renderer`,
  `#author-name`, `#message`...) là dựa theo cấu trúc YouTube hay dùng, nhưng
  đây đúng là phần dễ vỡ nhất theo tài liệu thiết kế (§2.4, §2.12). Tôi đã
  thêm sẵn vài selector dự phòng dạng danh sách phân tách bằng dấu phẩy cho
  `chatContainer` và `avatar` (CSS tự hiểu "khớp 1 trong các selector này"
  mà không cần sửa code) để tăng khả năng chịu lỗi, nhưng **vẫn chưa test
  được với trang thật**. Việc đầu tiên nên làm khi chạy thật: mở DevTools
  trên hidden BrowserView (tạm thời bật `view.webContents.openDevTools()`
  trong `scraper-manager.js`), so khớp selector, và sửa trực tiếp trong
  `selectors.config.json` nếu cần — không phải sửa code.
- ❌ Chưa build/test trên máy Windows/macOS thật (đóng gói NSIS/dmg) — cấu
  hình `electron-builder` trong `package.json` mới là khung, chưa chạy `npm
  run build` thật (môi trường sandbox chặn tải Electron binary từ GitHub
  Releases — bạn cần chạy bước này trên máy thật).
- ❌ Chưa test theme `danmaku` bằng mắt trên OBS thật — layout "bay ngang,
  chia làn theo `:nth-child`" đã được kiểm tra là CSS hợp lệ và server ra
  đúng, nhưng độ mượt/độ chồng chữ khi chat tốc độ cao thì cần xem trực
  quan mới đánh giá được (ghi rõ giới hạn này trong comment đầu file
  `themes/danmaku/style.css`).

## Chưa làm (ngoài phạm vi lần hoàn thiện này)

- Chưa có licensing/activation (mục §2.14 của tài liệu thiết kế) — đây là 1
  hệ thống con riêng (chọn nền tảng bán hàng, ký license offline...) cần bạn
  quyết định trước (Gumroad/Paddle/LemonSqueezy? có cần ngay cho bản đầu hay
  để sau?) nên tôi chưa tự ý dựng khung cho phần này. Nói tôi biết nếu muốn
  làm tiếp phần này.
- Dashboard chưa hiển thị danh sách chat dạng text riêng (dùng iframe overlay
  làm preview trực tiếp — vừa đúng nguyên tắc "1 nguồn render duy nhất", vừa
  đỡ trùng lặp code) — đây là lựa chọn thiết kế có chủ đích, không phải thiếu
  sót, nhưng nói tôi biết nếu bạn muốn có thêm 1 danh sách chat dạng text.

