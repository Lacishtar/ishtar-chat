# Refactor: Super Chat chỉ còn tồn tại trong Fan Service

> Trạng thái: **THIẾT KẾ — chưa implement.** Tài liệu này là input đầy đủ để một agent khác
> tiếp tục thực thi mà không cần đọc lại source code từ đầu. Không có source code nào bị
> sửa khi tạo tài liệu này.

## 0. Mục tiêu & phạm vi

**Mục tiêu:** Loại bỏ Super Chat khỏi Role System (`shared/role-style-config.js` +
`overlay/role-styles.css` + tab "Super Chat" trong `RoleStylesPanel.jsx`). Toàn bộ khả năng
style Super Chat (màu theo tier, badge, hiển thị số tiền, layout, typography...) sau refactor
chỉ tồn tại trong **Fan Service** (`shared/fan-service-config.js` + `FanServicePanel.jsx`).

**Không đổi:**
- Data model `ChatMessage` (`shared/chat-message.js`) — `isSuperchat`, `eventType`,
  `superchatAmountUsd`, `superchatCurrencyRaw`, `superchatTier`, `superchatColor`,
  `superchatBg`, `superchatBorder` vẫn được tính đúng như cũ. Đây là dữ liệu, không phải
  style config — không thuộc về Role lẫn Fan Service, cả hai đều chỉ **đọc** nó.
- Cơ chế capture DOM YouTube (`main/capture-preload.js`,
  `main/selectors.config.json`) — hoàn toàn ngoài phạm vi, không đụng tới.
- Role System vẫn tồn tại, nhưng thu hẹp lại đúng nghĩa **Identity only**: `moderator`,
  `member`. Super Chat không còn là một "role" nữa.

---

## 1. SCAN — bản đồ hệ thống hiện tại

```
main/
  capture-preload.js, selectors.config.json
    → capture DOM YouTube, gắn isSuperchat/superchatAmountRaw/superchatColor vào raw message
  store/
    config-store.js      → load/save config.json, merge fanServiceConfig, strip stale role fields
    theme-baseline.js     → so sánh state hiện tại với baseline theme để tính "dirty fields"
    theme-state.js         → resolve theme preset -> state đầy đủ (customize/layout/slot/anim/decoration/role)

shared/                     (nguồn CommonJS — được build lại thành .mjs cho overlay qua shared-esm-bridge)
  chat-message.js          → ChatMessage schema, SUPERCHAT_TIER_TABLE, deriveSuperchatTierInfo, parseSuperchatAmount
  role-style-config.js     → RoleStyleConfig: moderator / member / superchat (ROLE_KEYS)
  fan-service-config.js    → FanServiceConfig: superchat / membership (2 group độc lập, off-by-default)
  layout-config.js         → "simple layout" shape dùng chung bởi Bố cục tab VÀ Fan Service
  slot-style-config.js, customize-config.js, animation-config.js, decoration-config.js, theme-manager.js
  theme-presets/
    helpers.js             → defaultRoles()/defaultLayout()/... dùng chung cho mọi theme
    themes/*.js (18 file)  → mỗi theme tự bake roles.superchat riêng

overlay/                    (renderer chạy trong OBS Browser Source, ESM qua shared-esm-bridge)
  role-styles.css           → CSS cho .ovs-moderator / .ovs-member / .ovs-superchat (data-ovs-role-*)
  base-layout.css, bubble-wrap.css, layout-text.css, ...
  modules/
    css-variables.js        → applyCssVariables() (Role -> :root vars) + applyFanServiceStyle() (Fan Service -> scoped <style>)
    message-renderer.js     → createMessageNode(): gắn class/dataset/inline-var cho superchat, tạo .ovs-superchat-amount
    bubble-updater.js       → diff-update path, mirror toàn bộ logic superchat của message-renderer.js
    bubble.js                → bunny-ear color resolution, ROLE_PRIORITY (đọc state.currentRoleStyle.roles.superchat)
    dom-diff.js, pool/bubble-reset.js → generic diff/reset helper, có nhắc tới "ovs-superchat*" trong comment
    socket.js, state.js      → state.currentFanService (đã đúng shape { superchat, membership })
    message-body.js          → compose text — KHÔNG liên quan superchat (chỉ liên quan membership months / package name)
    theme-loader.js, virtual-bubble.js → mock preview / virtualization, chỉ đọc field public của ChatMessage

renderer-dashboard/src/
  components/
    RoleStylesPanel.jsx     → 3 tab: Mod / Hội viên / Super Chat (tab Super Chat = trọng tâm cần xoá)
    FanServicePanel.jsx     → 2 group: superchat / membership (layout + typography only, CHƯA có màu tier/badge/amount)
  state/EditorStateContext.jsx → roleLocal + fanServiceLocal, pushRoleUpdate() + pushFanServiceUpdate()
  lib/ipc.js                → mock backend (chỉ dùng khi chạy ngoài Electron) — mock fanServiceConfig SAI schema thật
  App.jsx                   → tab 'roles' -> RoleStylesPanel, tab 'fanService' -> FanServicePanel

scripts/
  "Verify fan service cascade.js"     → jsdom test: Fan Service CSS phải thắng role-styles.css !important cho superchat
  smoke-test-role-style-config.js     → assert defaults/merge trên roles.superchat
  smoke-test-chat-message.js          → assert isSuperchat/eventType/tier trên ChatMessage (KHÔNG liên quan config, giữ nguyên)
```

### Phát hiện quan trọng khi scan (ảnh hưởng trực tiếp tới thiết kế ở mục 3)

1. **Không có CSS "combined role" thật sự.** Comment trong
   `overlay/modules/message-renderer.js` (dòng ~170) khẳng định `role-styles.css` "đã có sẵn
   các khối CSS riêng cho tổ hợp `.ovs-moderator.ovs-superchat` / `.ovs-member.ovs-superchat`"
   — nhưng grep toàn bộ `overlay/role-styles.css` (420 dòng) **không tìm thấy selector nào như
   vậy**. Thực tế hiện tại: `.ovs-message.ovs-moderator:not(.ovs-superchat) .ovs-author` — nghĩa
   là khi một moderator gửi Super Chat, style riêng của Moderator (màu tên, badge MOD) bị
   **loại trừ hoàn toàn**, Super Chat's role style thắng tuyệt đối chứ không hề "hoà trộn" như
   comment mô tả. Đây là gap có sẵn từ trước refactor, không phải do refactor này gây ra —
   nhưng thiết kế mới phải xử lý rõ ràng hành vi này (xem mục 3.3).

2. **18 theme preset đều tự bake `roles.superchat`** (`shared/theme-presets/themes/*.js`),
   trùng lặp với `role-style-config.js#createSuperchatDefaults()`. Sau khi xoá `superchat` khỏi
   `ROLE_KEYS`, toàn bộ field này trong 18 file theme trở thành dữ liệu chết nếu không xử lý.

3. **`renderer-dashboard/src/lib/ipc.js`'s mock `fanServiceConfig`** (dòng 86-105) dùng field
   hoàn toàn khác với schema thật trong `shared/fan-service-config.js`
   (`nameBadges`, `packageNameSameLine`, `badgesFontSize`, `packageNameFontSize`... đều không
   tồn tại trong `createGroupConfig()` thật). Đây là mock đã trôi (drift) từ trước, chỉ ảnh
   hưởng khi chạy dashboard ngoài Electron (`npm run dev:dashboard`) — nhưng nếu không sửa
   cùng đợt refactor này, mock sẽ hiển thị sai hoàn toàn cho field Super Chat mới.

4. **`Fan Service` hiện tại KHÔNG có bất kỳ control nào cho:** màu theo tier tiền
   (`useTierColor`), badge trước/sau tên, hiển thị/ẩn số tiền, vị trí số tiền (inline/block),
   cỡ chữ & độ đậm số tiền. Toàn bộ các field này **chỉ tồn tại trong Role → Super Chat tab**
   hiện tại. Đây là phần lớn nhất cần MOVE, không phải REMOVE.

---

## 2. PHÂN TÍCH — bảng kiểm kê đầy đủ

Ký hiệu: **KEEP** = không đổi · **MOVE** = chuyển vị trí sở hữu logic (Role → Fan Service) ·
**REMOVE** = xoá hẳn · **REFACTOR** = sửa tại chỗ (đổi cách đọc dữ liệu / cập nhật comment/API)

| # | File | Phần liên quan Super Chat | Đánh dấu | Ghi chú |
|---|------|---------------------------|----------|---------|
| 1 | `main/capture-preload.js` | `isSuperchat`, `superchatAmountRaw`, `superchatColor` capture | **KEEP** | Data capture, ngoài phạm vi styling |
| 2 | `main/selectors.config.json` | `superchatRenderer`, `superchatAmount` selector | **KEEP** | idem |
| 4 | `shared/chat-message.js` | `SUPERCHAT_TIER_TABLE`, `deriveSuperchatTierInfo`, `parseSuperchatAmount`, các field `superchat*` trên `ChatMessage` | **KEEP** | Đây là schema dữ liệu dùng chung — cả Role (trước đây) lẫn Fan Service (sau này) chỉ **đọc**, không sở hữu. Không di chuyển. |
| 5 | `shared/role-style-config.js` — `ROLE_KEYS`, `ROLE_CSS_PREFIX.superchat` | khai báo `superchat` là 1 role | **REMOVE** | `ROLE_KEYS = ['moderator', 'member']` |
| 6 | `shared/role-style-config.js` — `createSuperchatDefaults()`, `normalizeSuperchatRole()` | toàn bộ default + normalize riêng cho superchat (`useTierColor`, `amountFontSize`, `amountFontWeight`, `amountPosition`) | **MOVE → `shared/fan-service-config.js`** | Field đích: `createGroupConfig()` (chỉ nhánh `superchat`, không áp cho `membership`) |
| 7 | `shared/role-style-config.js` — nhánh `roleKey === 'superchat'` trong `compileRoleStyleToCssVariables()` | emit `data-ovs-role-superchat-show-amount`, `-amount-position`, `-use-tier-color`, `--ovs-role-superchat-amount-*` | **MOVE → `compileFanServiceCss()`** | Chuyển từ cơ chế `:root` attribute + biến toàn cục sang CSS **scoped** theo class `.ovs-message.ovs-superchat` (đúng pattern Fan Service đang dùng cho `groupOverrideCssBlock`) |
| 8 | `shared/role-style-config.js` — badge `roleKey !== 'member'` cho superchat | `badgeBefore`/`badgeAfter` role-level của Super Chat | **MOVE → Fan Service superchat group** | Badge trở thành field mới trong `createGroupConfig()` áp riêng cho nhánh `superchat` (xem mục 3.2) |
| 9 | `shared/role-style-config.js` — `DEFAULT_ROLE_STYLE_CONFIG.roles.superchat` | default object | **REMOVE** | `DEFAULT_ROLE_STYLE_CONFIG.roles = { moderator, member }` |
| 10 | `shared/role-style-config.js` — `normalizeRoleStyleConfig()`, `mergeRoleStyleConfig()` | field `roles.superchat` trong return shape | **REFACTOR** | Bỏ nhánh `superchat: normalizeSuperchatRole(...)` / `mergeOne('superchat')` |
| 11 | `shared/fan-service-config.js` — `createGroupConfig()` | thiếu field tier-color/badge/amount | **REFACTOR (extend)** | Thêm field mới **chỉ áp dụng khi group là `superchat`** — xem schema mới ở mục 3.2 |
| 12 | `shared/fan-service-config.js` — `compileGroupVars()`, `groupOverrideCssBlock()`, `compileFanServiceCss()` | chưa emit rule tier-color/amount/badge | **REFACTOR (extend)** | Thêm nhánh riêng cho `cfg.superchat` để emit các rule tương đương role-styles.css cũ (tier bg/border/color, amount badge, contrast-fix trắng/đen theo tier) |
| 13 | `shared/theme-presets/helpers.js` — `defaultRoles()` | có key `superchat: {...}` | **REMOVE** key `superchat` khỏi object trả về | Trả về `{ roles: { moderator, member } }` |
| 14 | `shared/theme-presets/themes/*.js` (18 file: anime, ca-phe, cute-bubble, cute, default, discord, edgy, glassmorphism, karaoke, maid, minimal-dark, minimal-white, neon, night-sky, pastel-pink, retro, ticker-news, vtuber-cute) | mỗi file có `roles.superchat: {...}` riêng | **REMOVE** field `superchat` khỏi `roles`; **MOVE** giá trị màu/badge có ý nghĩa design sang một payload theme-level mới nếu Product muốn theme vẫn "tô màu" Super Chat mặc định (xem Open Question OQ-1, mục 5) | Cần review từng theme để không mất trắng thẩm mỹ đã thiết kế (vd tier gold `#fde047` mặc định, `retro`/`neon` có màu riêng) |
| 15 | `main/store/config-store.js` — `DEFAULT_STATE`, `_load()` | không đọc `roles.superchat` trực tiếp, nhưng `stripStaleRoleRowDefaults()` và baseline merge phụ thuộc shape `roleStyleConfig.roles` | **REFACTOR** | Thêm 1 hàm migration mới (xem mục 4) chạy 1 lần khi load config.json cũ có `roleStyleConfig.roles.superchat` |
| 16 | `main/store/theme-baseline.js` — `getDirtyFields()` | field `'kiểu mod/hội viên/superchat'` so sánh `state.roleStyleConfig` | **REFACTOR** | Đổi nhãn còn `'kiểu mod/hội viên'`; `roleStyleConfig` baseline giờ chỉ có 2 role nên diff tự động đúng, không cần logic riêng |
| 17 | `overlay/role-styles.css` dòng 1-17 | `--ovs-role-superchat-amount-font-size/-weight` default trong `:root` | **REMOVE** | Chuyển default vào CSS scoped của Fan Service |
| 18 | `overlay/role-styles.css` dòng 18-113 | selector `.ovs-superchat`/`:not(.ovs-superchat)` lồng trong block member/moderator (badge before/after, `:not(.ovs-superchat)` exclusion) | **REFACTOR** | Bỏ mọi `:not(.ovs-superchat)` — Role (moderator/member) không còn lý do phải biết tới khái niệm superchat nữa vì Fan Service giờ áp CSS specificity đủ cao để tự thắng cascade độc lập với việc Role có chạy hay không (xem mục 3.3) |
| 19 | `overlay/role-styles.css` dòng 245-419 | toàn bộ block `data-ovs-role-superchat-*` (tier color, amount badge, contrast-fix trắng/đen theo tier, bubble-wrap variant) | **MOVE → `compileFanServiceCss()`** (sinh ra CSS text, không phải file `.css` tĩnh nữa) | Đây là phần lớn nhất, xem mục 3.4 |
| 20 | `overlay/modules/css-variables.js` — `applyRoleStyleFlags()`, `applyCssVariables()` | set `data-ovs-role-superchat-*` từ `roleCompiled.rootFlags` | **REFACTOR** | Không còn nhánh này nữa vì bước #7/#19 đã loại field khỏi `compileRoleStyleToCssVariables()`. `applyFanServiceStyle()` giữ nguyên cơ chế, chỉ CSS output thay đổi |
| 21 | `overlay/modules/message-renderer.js` dòng 178-193, 266-284 | gắn `.ovs-superchat`, `.ovs-superchat-tier-N`, `--ovs-superchat-tier-color/-bg/-border`, tạo `.ovs-superchat-amount` + `.ovs-author-area` wrapper | **KEEP (làm data hook), REFACTOR comment** | Logic gắn class/dataset/inline-var **giữ nguyên 100%** — đây là hạ tầng render trung lập mà Fan Service CSS sẽ target vào. Chỉ cập nhật comment vì lý do tồn tại của các hook này đổi từ "phục vụ Role" sang "phục vụ Fan Service" |
| 22 | `overlay/modules/bubble-updater.js` dòng 104-120, 201 | mirror #21 cho diff-update path | **KEEP, REFACTOR comment** | idem |
| 23 | `overlay/modules/bubble.js` — `ROLE_PRIORITY`, `resolveRoleForNode()` | đọc `state.currentRoleStyle.roles.superchat` để tô màu tai thỏ (bunny ear) | **REFACTOR** | Superchat row cần đọc màu tai thỏ từ **Fan Service config** (group `superchat`) thay vì `state.currentRoleStyle`. `ROLE_PRIORITY` bỏ entry `{ cls: 'ovs-superchat', key: 'superchat' }`; thêm nhánh riêng: nếu `rowEl` có `.ovs-superchat` VÀ `state.currentFanService.superchat.enabled`, tô theo Fan Service; ngược lại rơi về `ROLE_PRIORITY` (chỉ còn moderator/member) như bình thường |
| 24 | `overlay/modules/pool/bubble-reset.js` | comment nhắc "reset ... superchat classes" khi tái sử dụng bubble từ pool | **KEEP, REFACTOR comment** | Cơ chế reset (xoá class/dataset/inline-var `ovs-superchat*`) không đổi — nó chỉ dọn dẹp hook trung lập ở #21, không quan tâm ai đang consume các hook đó |
| 25 | `overlay/modules/dom-diff.js` | comment generic nhắc họ class `ovs-superchat-tier-` | **KEEP** | Helper thuần diff, không có logic riêng cho superchat |
| 26 | `overlay/modules/socket.js`, `overlay/modules/state.js` | `state.currentFanService` default `{ superchat: {}, membership: {} }` | **KEEP** | Đã đúng shape Fan Service từ trước |
| 27 | `overlay/modules/theme-loader.js` | mock message preview có field `isSuperchat`/`superchatTier`/... | **KEEP** | Chỉ dùng field public của `ChatMessage`, không đọc role/fan-service config trực tiếp |
| 28 | `overlay/modules/virtual-bubble.js` | snapshot `isSuperchat`/`superchatTier/Color/Bg/Border` cho virtualization | **KEEP** | idem — đọc từ `msg`, không phải config |
| 29 | `overlay/modules/message-body.js` | không có gì liên quan superchat | **KEEP** | Đã xác nhận qua scan — chỉ liên quan `membership` (member-months, package name) |
| 30 | `renderer-dashboard/.../RoleStylesPanel.jsx` — `ROLE_TABS` entry `superchat` | tab "Super Chat" trong danh sách 3 tab | **REMOVE** | `ROLE_TABS` còn 2 entry: `moderator`, `member` |
| 31 | `renderer-dashboard/.../RoleStylesPanel.jsx` — `SUPERCHAT_DEFAULTS`, `SuperchatEditor()`, `WEIGHT_OPTIONS`, `TIER_TABLE`, `TierColorPreview()` | toàn bộ UI editor Super Chat (~280 dòng, dòng 77-91 & 329-356 & 737-914) | **MOVE → `FanServicePanel.jsx`** (rewrite thành control mới trong `GroupEditor` cho group `superchat`) | `WEIGHT_OPTIONS`/`TierColorPreview` là component thuần, copy-paste được gần như nguyên vẹn |
| 32 | `renderer-dashboard/.../RoleStylesPanel.jsx` — `ROLE_DEFAULTS_MAP.superchat`, `EMPTY_ROLE` (field `showAmount`) | tham chiếu superchat trong map dùng chung | **REFACTOR** | `ROLE_DEFAULTS_MAP = { moderator: MOD_DEFAULTS, member: MEMBER_DEFAULTS }`; `EMPTY_ROLE` bỏ field `showAmount` (chỉ superchat dùng) |
| 33 | `renderer-dashboard/.../FanServicePanel.jsx` — `GroupEditor()` | thiếu control cho tier-color/badge/amount | **REFACTOR (extend, chỉ khi `groupKey === 'superchat'`)** | Thêm section mới trong `GroupEditor`, đặt sau "Cỡ chữ & màu sắc", trước phần đóng `fieldset`, giống pattern `groupKey === 'membership'` đã có cho member-months |
| 34 | `renderer-dashboard/.../FanServicePanel.jsx` — `GROUP_META.superchat.desc` | mô tả hiện tại: "Áp dụng cho mọi tin nhắn Super Chat." | **REFACTOR** | Cập nhật copy để phản ánh Fan Service giờ là nơi DUY NHẤT chỉnh Super Chat (không còn "và Vai trò chung" nữa) |
| 35 | `renderer-dashboard/src/state/EditorStateContext.jsx` — `pushRoleUpdate`, `pushFanServiceUpdate` | cơ chế debounce-push riêng cho từng config | **KEEP** | Cơ chế không đổi; chỉ payload đi qua đổi (roleLocal không còn key `superchat`, fanServiceLocal.superchat có thêm field mới) |
| 36 | `renderer-dashboard/src/lib/ipc.js` dòng 79-85 | mock `roleStyleConfig.roles.superchat` | **REMOVE** | Bỏ key `superchat` khỏi mock `roles` |
| 37 | `renderer-dashboard/src/lib/ipc.js` dòng 86-105 | mock `fanServiceConfig` (schema đã trôi, xem SCAN-3) | **REFACTOR** | Viết lại đúng theo schema thật của `createGroupConfig()` (bao gồm field mới ở mục 3.2), không chỉ để build chạy mà để mock dashboard test được đúng hành vi |
| 38 | `renderer-dashboard/src/lib/ipc.js` dòng ~290 | `updateFanServiceConfig` mock merge | **KEEP mechanism** | Không đổi logic merge, chỉ đổi theo shape mới ở #37 |
| 39 | `renderer-dashboard/src/App.jsx` | tab `'roles'` label/hint, tab `'fanService'` label/hint | **REFACTOR** | Cập nhật copy mô tả (Roles tab không còn nhắc Super Chat) |
| 40 | `scripts/Verify fan service cascade.js` | test cascade Fan Service CSS thắng `role-styles.css` (`data-ovs-role-superchat-*`) | **REFACTOR** | Sau khi #17-19 xoá rule superchat khỏi `role-styles.css`, bài test đổi mục tiêu: xác nhận Fan Service CSS **tự đủ** làm nền tảng style cho `.ovs-superchat` mà không cần role-styles.css nữa — đồng thời thêm case mới: moderator role ENABLED + superchat row → badge/màu Moderator (Identity) có nên hiện cùng lúc hay không (theo quyết định ở mục 3.3) |
| 41 | `scripts/smoke-test-role-style-config.js` | assert `defaults.roles.superchat.*`, `merged.roles.superchat.*` | **REFACTOR** | Xoá các assertion này; các field tương ứng (badgeBefore mặc định, showAmount mặc định...) chuyển sang smoke test mới cho `fan-service-config.js` |
| 42 | `scripts/smoke-test-chat-message.js` | assert `isSuperchat`/`eventType`/tier trên `ChatMessage` | **KEEP** | Không liên quan config, test schema thuần |

**Dependency chính cần theo dõi khi implement (thứ tự phụ thuộc):**

```
shared/chat-message.js (KEEP, nguồn dữ liệu)
        │
        ▼
shared/fan-service-config.js  ◄── shared/layout-config.js (KEEP, dùng chung)
        │  (schema mới + compileFanServiceCss mới)
        ▼
overlay/modules/css-variables.js#applyFanServiceStyle (KEEP cơ chế)
        │
        ▼
overlay/modules/message-renderer.js + bubble-updater.js (KEEP hook, đổi chủ sở hữu ngữ nghĩa)
        │
        ▼
overlay/modules/bubble.js (REFACTOR nguồn màu tai thỏ)

shared/role-style-config.js (REMOVE superchat)
        │
        ├──► shared/theme-presets/helpers.js + themes/*.js (REMOVE field roles.superchat)
        ├──► main/store/config-store.js + theme-baseline.js (REFACTOR + migration)
        └──► renderer-dashboard RoleStylesPanel.jsx (REMOVE tab) 
                     │
                     ▼
             renderer-dashboard FanServicePanel.jsx (MOVE UI vào đây)
                     │
                     ▼
             renderer-dashboard EditorStateContext.jsx / ipc.js (REFACTOR shape)
```

---

## 3. THIẾT KẾ KIẾN TRÚC MỚI

### 3.1 Sơ đồ tổng quan

```
                        ChatMessage (shared/chat-message.js)
                         isSuperchat, eventType, superchatTier/Color/Bg/Border,
                         roles[] ("moderator" | "member" | "verified")
                                        │
                        ┌───────────────┴────────────────┐
                        ▼                                 ▼
                 Role (Identity only)              Fan Service
                 moderator | member                 superchat | membership
                 - màu tên / bg / border             - superchat: layout + typography +
                 - badge trước/sau tên                 (MỚI) màu theo tier + badge + amount
                 - Mốc tháng (member tiers)           - membership: layout + typography +
                 - font weight / text scale             dòng "Hội viên trong N tháng"
                        │                                 │
                        ▼                                 ▼
           compileRoleStyleToCssVariables()      compileFanServiceCss()
           → ghi vào :root (--ovs-role-*)         → <style id="ovs-fan-service-style">
             áp dụng CHO MỌI role-message           (scoped theo .ovs-message.ovs-superchat /
             (không phân biệt có phải               .ovs-message.ovs-event-membership_*)
              superchat hay không)
                        │                                 │
                        └───────────────┬─────────────────┘
                                         ▼
                            overlay DOM (.ovs-message rowEl)
                     class: ovs-moderator / ovs-member / ovs-superchat /
                            ovs-event-<type> / ovs-superchat-tier-N / ovs-member-tier-N
                     (những class này do message-renderer.js/bubble-updater.js
                      gắn KHÔNG ĐIỀU KIỆN — chỉ là data hook trung lập,
                      không quan tâm Role hay Fan Service đang tiêu thụ)
```

**Nguyên tắc cốt lõi của thiết kế mới:** `.ovs-superchat` (và các class/dataset/CSS-var đi
kèm) vẫn được `message-renderer.js` gắn lên row **vô điều kiện** như hiện tại — đây KHÔNG phải
thứ cần refactor, vì nó là hook DOM trung lập. Điều thay đổi là: **ai đọc/emit CSS nhắm vào
những hook đó.** Trước đây có 2 nguồn (`role-styles.css` với `data-ovs-role-superchat-*`, và
Fan Service với `.ovs-message.ovs-superchat` scoped). Sau refactor chỉ còn 1 nguồn: Fan
Service.

### 3.2 Schema mới của `shared/fan-service-config.js`

`createGroupConfig()` hiện tại dùng chung 100% shape cho cả `superchat` và `membership`. Sau
refactor, field mới chỉ có **ý nghĩa** khi group là `superchat` (với `membership` các field này
vẫn tồn tại trong object nhưng compiler bỏ qua — giữ đúng tinh thần "một shape chung, field vô
nghĩa với group kia thì compile không emit gì", đúng cách `showMemberMonths` hiện tại đã làm
ngược lại cho `membership`):

```js
function createGroupConfig(overrides = {}) {
  return {
    enabled: false,
    showAvatar: true, showAuthor: true, showMessage: true,
    avatarPosition: 'left', authorAlign: 'left', messagePosition: 'below',
    gapScale: 1,
    paddingTopScale: 1, paddingRightScale: 1, paddingBottomScale: 1, paddingLeftScale: 1,
    avatarScale: 1,
    authorFontScale: 1, authorColor: '#6e56f0',
    messageFontScale: 1, messageColor: '#eaecef',
    // membership-only (không đổi)
    showMemberMonths: true, monthsAlign: 'left', monthsFontScale: 1.25, monthsColor: '#ffd166',

    // ─── MỚI — chỉ có ý nghĩa khi group === 'superchat' ───────────────────
    // Badge (moved from role-style-config.js#createSuperchatDefaults)
    badgeBefore: null,          // text/emoji hoặc URL ảnh (dùng lại quoteCssContent/getBadgeImageSrc)
    badgeAfter: null,
    // Màu theo tier tiền YouTube (moved from role-style-config.js)
    useTierColor: true,         // true: đọc --ovs-superchat-tier-* (đã có sẵn inline trên row);
                                 // false: authorColor/messageColor phía trên (đã tồn tại) tự làm màu thủ công
    // Số tiền
    showAmount: true,
    amountPosition: 'inline',   // 'inline' | 'block'
    amountFontScale: 1,         // ĐỔI từ absolute px (amountFontSize) sang scale — nhất quán với
                                 // convention "mọi size field trong Fan Service là scale" đã ghi ở
                                 // đầu file. BASE_SIZES cần thêm amountFontSize: 16 (bằng messageFontSize).
    amountFontWeight: 'bold',   // 'normal' | 'bold' | 'extrabold' — giữ nguyên như cũ

    ...overrides,
  };
}
```

**Vì sao đổi `amountFontSize` (px tuyệt đối) → `amountFontScale` (scale):** toàn bộ field size
khác trong Fan Service đã là scale theo quy ước ghi rõ trong header comment của file
(`shared/fan-service-config.js` dòng 26-30). Giữ `amountFontSize` là absolute px sẽ là ngoại lệ
không nhất quán ngay trong chính group vừa nhận nó — sửa luôn cho đồng bộ, migration function
(mục 4) sẽ quy đổi giá trị cũ.

**Vì sao KHÔNG mang theo `authorFontWeight`/`messageBorderWidth`/`textScale` từ
`createRoleDefaults()`:** những field này là field chung cho MỌI role (moderator/member/superchat
đều có), không phải field riêng của superchat. Fan Service đã có field tương đương của riêng
mình (`authorFontScale`, `messageFontScale`) theo model "scale" khác hẳn model "role" — không
map 1:1 được và cũng không cần thiết, vì Fan Service khi `enabled=true` đã ghi đè hoàn toàn
font-size/color qua `groupOverrideCssBlock`. `messageBorderWidth` của Role Super Chat cũ thực
ra chưa từng được `compileRoleStyleToCssVariables()` optimize riêng cho superchat theo cách có
ý nghĩa khác member/moderator — border width superchat khi bật Fan Service nên map vào field
mới `messageBorderWidthScale` NẾU Product muốn giữ; **đánh dấu Open Question OQ-2** (mục 5) vì
đây là 1 field có thể bị mất tính năng nếu bỏ qua.

### 3.3 Quyết định thiết kế: Moderator/Member gửi Super Chat thì sao?

Đây là điểm rủi ro nhất của refactor (xem SCAN-1). Chốt hành vi mới, đơn giản hoá triệt để so
với trước:

- **Khi Fan Service `superchat.enabled = false`:** hành vi giữ nguyên như hiện tại — row rơi về
  Role (moderator/member) như một tin nhắn thường, KHÔNG có style superchat nào (kể cả tier
  color/badge tiền) — đây chính xác là hành vi "off-by-default" đã ghi trong comment gốc của
  `fan-service-config.js`, không đổi.
- **Khi Fan Service `superchat.enabled = true`:** Fan Service **sở hữu toàn bộ** phần nhìn của
  row đó — màu, nền, badge tiền, layout. Role (moderator/member) **không còn cố hoà trộn** màu
  nữa (loại bỏ ảo giác "combined role" chưa từng thực sự hoạt động — xem SCAN-1). Tuy nhiên,
  **danh tính** (identity) của người gửi — cụ thể là **badge MOD/Member trước/sau tên** — vẫn
  nên hiển thị được nếu Product muốn (đây là lý do Role tồn tại: xác nhận "ai" chứ không phải
  "họ trả bao nhiêu tiền"). Cách làm: bỏ `:not(.ovs-superchat)` khỏi các selector badge-only
  (không phải selector màu) của `role-styles.css` (mục 2, dòng #18), để badge MOD/Member vẫn
  render `::before`/`::after` trên `.ovs-author` ngay cả khi row cũng có `.ovs-superchat` —
  còn màu chữ/nền thì Fan Service's `!important` (đã ở specificity cao hơn qua kỹ thuật lặp
  class — xem `groupOverrideCssBlock` hiện tại) tự động thắng, không cần Role tự loại trừ nữa.
- Vì badge moderator/member là `content: "..."` trên `::before`/`::after` (không chiếm layout
  riêng, không đụng `.ovs-superchat-amount`), việc bật cả hai không gây xung đột vị trí.

Đây là thay đổi hành vi có thể quan sát được (badge MOD sẽ xuất hiện trên Super Chat row khi
trước đây nó biến mất) — cần ghi vào release note / test case mới trong
`Verify fan service cascade.js` (mục 2, #40).

### 3.4 Render flow (chi tiết, sau refactor)

```
1. Message tới overlay (socket.js) → normalizeMessage() (đã chạy ở main process, KHÔNG đổi)
   → msg.isSuperchat / msg.eventType='superchat' / msg.superchatTier / msg.superchatColor/...

2. createMessageNode(msg) [message-renderer.js] — KHÔNG ĐỔI LOGIC:
   a. Gắn msg.roles → rowEl.classList (ovs-moderator / ovs-member) — Identity, luôn chạy
   b. if (msg.isSuperchat): gắn ovs-superchat, ovs-superchat-tier-N,
      --ovs-superchat-tier-color/-bg/-border (inline style trên rowEl)
   c. Gắn ovs-event-<eventType>
   d. Nếu isSuperchat && superchatCurrencyRaw: tạo .ovs-superchat-amount + .ovs-author-area wrapper
   → Tất cả (a)-(d) là hook trung lập, giống hệt trước refactor.

3. applyCssVariables() [css-variables.js], chạy khi config đổi (KHÔNG chạy per-message):
   a. compileRoleStyleToCssVariables(roleStyle) → CHỈ còn moderator/member
      → ghi --ovs-role-mod-*/--ovs-role-member-* vào :root, set data-ovs-role-mod-enabled/
        data-ovs-role-member-enabled (KHÔNG còn data-ovs-role-superchat-*)
   b. applyFanServiceStyle(fanServiceConfig) → compileFanServiceCss(cfg)
      → nếu cfg.superchat.enabled: sinh block CSS scoped `.ovs-message.ovs-superchat { ... }`
        VÀ `.ovs-message.ovs-superchat .ovs-author { ... }` VÀ
        `.ovs-message.ovs-superchat .ovs-superchat-amount { ... }` (MỚI, xem 3.5) — ghi vào
        <style id="ovs-fan-service-style"> (không phải :root, không phải data-attribute)

4. CSS cascade quyết định hình ảnh cuối cùng:
   - role-styles.css: chỉ còn rule cho .ovs-moderator/.ovs-member KHÔNG loại trừ .ovs-superchat
     ở phần badge (mục 3.3) — vẫn loại trừ ở phần MÀU (để tránh Role tô màu rồi Fan Service
     tô đè lên, gây flash/layout thrash không cần thiết dù kết quả cuối vẫn đúng)
   - Fan Service <style> tag: luôn nạp SAU role-styles.css trong <head>
     (`document.head.appendChild(styleEl)` trong applyFanServiceStyle — không đổi), và dùng kỹ
     thuật lặp class để bump specificity (không đổi) → luôn thắng nếu enabled
```

### 3.5 CSS mới cần sinh trong `compileFanServiceCss()` cho group `superchat`

Nội dung port gần như nguyên vẹn từ `overlay/role-styles.css` dòng 245-419, nhưng đổi từ
`:root[data-ovs-role-superchat-*]` + biến `:root` sang **scoped selector + biến inline đã có
sẵn trên row** (`--ovs-superchat-tier-color/-bg/-border` — message-renderer.js đã set inline
trên `rowEl`, không cần đọc qua `:root` nữa vì Fan Service compile theo group, không theo từng
tier per-message):

```js
// Trong groupOverrideCssBlock(rowSelectors, group) — CHỈ chạy nhánh này khi group đại diện
// cho 'superchat' (truyền thêm cờ isSuperchatGroup vào hàm, hoặc check rowSelectors[0] có
// chứa '.ovs-superchat').
if (isSuperchatGroup) {
  const useTierColor = g.useTierColor !== false;

  // 1. Màu tên/nội dung/nền — tier color (đọc biến inline đã có sẵn trên row) hoặc màu thủ công
  //    (tái dùng authorColor/messageColor đã có trong group, KHÔNG cần field riêng)
  rules.push(`${sel} {
    background: ${useTierColor ? 'var(--ovs-superchat-tier-bg, rgba(255,202,40,0.35))' : messageBgFallback} !important;
    border-color: ${useTierColor ? 'var(--ovs-superchat-tier-border, rgba(255,202,40,0.45))' : g.messageBorderColor || 'rgba(255,202,40,0.45)'} !important;
  }`);
  // 2. Badge trước/sau tên (badgeBefore/badgeAfter mới trong group)
  rules.push(`${sel} .ovs-author::before { content: ${quoteCssContent(g.badgeBefore)}; }`);
  rules.push(`${sel} .ovs-author::after  { content: ${quoteCssContent(g.badgeAfter)}; }`);
  // 3. Amount badge (.ovs-superchat-amount) — show/hide, position, font, tier bg/border, contrast-fix
  if (g.showAmount !== false) {
    // ...position inline/block, font-size = amountFontScale * BASE_SIZES.amountFontSize,
    // font-weight = FONT_WEIGHT_MAP[g.amountFontWeight], background/border tier hoặc thủ công
  } else {
    rules.push(`${sel} .ovs-superchat-amount { display: none !important; }`);
  }
  // 4. Contrast-fix trắng/đen theo tier (chỉ áp khi useTierColor=true) — port nguyên bảng tier 1-2 => đen, 3-7 => trắng
}
```

`quoteCssContent`/`getBadgeImageSrc`/`FONT_WEIGHT_MAP` đã tồn tại trong
`shared/role-style-config.js` — khi MOVE badge logic sang `fan-service-config.js`, **export
thêm** 3 hàm/hằng này từ `role-style-config.js` (chúng là helper thuần, không gắn với khái niệm
"role") để `fan-service-config.js` import lại, tránh copy-paste logic quote CSS content 2 lần.
Ngược lại, nếu muốn tách bạch hoàn toàn 2 module, có thể extract 3 thứ này ra file mới
`shared/css-content-helpers.js` dùng chung — khuyến nghị cách này để `fan-service-config.js`
không phải phụ thuộc `role-style-config.js` (tránh coupling ngược, vì Role không còn biết gì
về Super Chat nữa thì Fan Service cũng không nên phụ thuộc ngược lại Role).

### 3.6 Override flow (dashboard)

```
FanServicePanel.jsx → GroupEditor(groupKey='superchat')
  Section "Hiển thị" (đã có) → showAvatar/showAuthor/showMessage
  Section "Bố cục" (đã có) → avatarPosition/authorAlign/messagePosition/padding
  Section "Cỡ chữ & màu sắc" (đã có) → avatarScale/authorFontScale+Color/messageFontScale+Color
  ┌─ MỚI: Section "Màu theo tier" (chỉ hiện khi groupKey === 'superchat') ─────────
  │   Toggle "Tự động dùng màu theo tier tiền YouTube" (useTierColor)
  │   → nếu useTierColor=false: hiện lại 2 ColorField authorColor/messageColor đã có sẵn
  │     phía trên Section "Cỡ chữ & màu sắc" (KHÔNG tạo field trùng — chỉ đổi label/hint
  │     tuỳ theo useTierColor, tái dùng đúng field authorColor/messageColor hiện có)
  │   TierColorPreview (moved from RoleStylesPanel.jsx, component thuần không đổi)
  ┌─ MỚI: Section "Badge" (chỉ hiện khi groupKey === 'superchat') ─────────────────
  │   BadgeFields (badgeBefore/badgeAfter) — moved from RoleStylesPanel.jsx
  ┌─ MỚI: Section "Số tiền" (chỉ hiện khi groupKey === 'superchat') ───────────────
  │   Toggle showAmount
  │   SegmentedField amountPosition (inline/block) — moved, UI y hệt cũ
  │   ScaleField amountFontScale (đổi từ SliderField px sang ScaleField, đồng bộ pattern)
  │   ButtonGroup amountFontWeight (WEIGHT_OPTIONS moved)
  └─────────────────────────────────────────────────────────────────────────────────
  onChange(patch) → pushFanServiceUpdate('superchat', patch) [KHÔNG ĐỔI cơ chế]
    → debounce 300ms (giữ FAN_SERVICE_DEBOUNCE_MS hiện tại)
    → api.updateFanServiceConfig({ superchat: patch })
    → main process: config-store.js set({ fanServiceConfig: mergeFanServiceConfig(...) })
    → broadcast qua socket.js xuống overlay → applyFanServiceStyle() re-run
```

`RoleStylesPanel.jsx` sau refactor chỉ còn 2 tab (`moderator`, `member`), không còn
`SuperchatEditor`, không còn field `showAmount`/`useTierColor`/`amountFontSize` trong
`EMPTY_ROLE`.

### 3.7 Config ownership (bảng tổng kết "ai sở hữu field nào")

| Field / khái niệm | Trước refactor | Sau refactor |
|---|---|---|
| Màu tên/nền/border của Super Chat khi KHÔNG bật Fan Service | `role-style-config.js` (luôn áp) | **Không còn tồn tại** — Super Chat không style riêng nữa nếu Fan Service tắt, row trông y hệt member/moderator/text thường theo Bố cục & Vai trò chung (đây là thay đổi hành vi có chủ đích, xem mục 5 OQ-3) |
| Màu theo tier tiền YouTube | `role-style-config.js` (`useTierColor`) | `fan-service-config.js` group `superchat` |
| Badge trước/sau tên Super Chat | `role-style-config.js` | `fan-service-config.js` group `superchat` |
| Hiển thị/vị trí/cỡ chữ số tiền | `role-style-config.js` | `fan-service-config.js` group `superchat` |
| Layout (avatar position, message position, padding, gap) | `fan-service-config.js` (đã có, không đổi) | `fan-service-config.js` (không đổi) |
| Typography chung (author/message font scale + color) | `fan-service-config.js` (đã có) | `fan-service-config.js` (không đổi) |
| Badge MOD/Member khi người gửi cũng là Super Chat | Lý thuyết "combined" nhưng thực tế bị `:not(.ovs-superchat)` chặn (bug có sẵn) | `role-style-config.js` — hiện đúng như bình thường, độc lập với Fan Service (mục 3.3) |
| `superchatTier`/`superchatColor`/`superchatBg`/`superchatBorder` | `chat-message.js` (data) | Không đổi — vẫn là data, cả Fan Service lẫn overlay hook đều chỉ đọc |
| Theme preset tô sẵn màu Super Chat | `theme-presets/themes/*.js` qua `roles.superchat` | Xem Open Question OQ-1 (mục 5) — có thể bỏ hẳn hoặc chuyển sang theme-level Fan Service preset |

---

## 4. MIGRATION STRATEGY

Áp dụng đúng pattern đã có sẵn trong `main/store/config-store.js`
(`stripStaleRoleRowDefaults()`) — một hàm migration chạy 1 lần mỗi khi `_load()` đọc
`config.json` cũ, không cần version flag riêng vì có thể tự phát hiện qua sự tồn tại của
`profile.roleStyleConfig.roles.superchat`.

```js
// main/store/config-store.js — hàm migration mới, gọi trong _load() TRƯỚC KHI
// gán vào fanServiceConfig / roleStyleConfig của state trả về.
function migrateSuperchatRoleIntoFanService(roleStyleConfig, fanServiceConfig) {
  const legacy = roleStyleConfig?.roles?.superchat;
  // Không có gì để migrate: config đã ở schema mới (không có roles.superchat), hoặc
  // legacy.enabled=false (user chưa từng bật custom style riêng cho Super Chat qua Role tab)
  // → giữ nguyên fanServiceConfig.superchat như hiện tại, KHÔNG ghi đè theo mặc định legacy.
  if (!legacy || legacy.enabled === false) {
    return fanServiceConfig;
  }

  // legacy.enabled=true nghĩa là user ĐÃ chủ động custom màu/badge Super Chat qua Role tab
  // trước đây. Nếu Fan Service superchat.enabled đã là true (user cũng dùng Fan Service song
  // song), ưu tiên giữ nguyên Fan Service hiện có — không ghi đè giá trị user đang thấy trên
  // overlay ngay lúc này. Chỉ migrate field khi Fan Service superchat CHƯA được bật, để không
  // làm mất lựa chọn có chủ đích của Fan Service.
  const fsSuperchat = fanServiceConfig?.superchat || {};
  if (fsSuperchat.enabled) {
    return fanServiceConfig;
  }

  return {
    ...fanServiceConfig,
    superchat: {
      ...fsSuperchat,
      enabled: true, // bật Fan Service để giữ nguyên hình ảnh overlay user đang thấy
      useTierColor: legacy.useTierColor !== false,
      badgeBefore: legacy.badgeBefore ?? fsSuperchat.badgeBefore ?? null,
      badgeAfter: legacy.badgeAfter ?? fsSuperchat.badgeAfter ?? null,
      showAmount: legacy.showAmount !== false,
      amountPosition: legacy.amountPosition === 'block' ? 'block' : 'inline',
      // amountFontSize (px cũ) → amountFontScale: quy đổi theo BASE_SIZES.amountFontSize mới (16)
      amountFontScale: typeof legacy.amountFontSize === 'number' && legacy.amountFontSize > 0
        ? legacy.amountFontSize / 16
        : (fsSuperchat.amountFontScale ?? 1),
      amountFontWeight: legacy.amountFontWeight || 'bold',
      // Không tier-color: map màu thủ công cũ sang authorColor/messageColor đã có sẵn trong group
      ...(legacy.useTierColor === false
        ? {
            authorColor: legacy.authorColor || fsSuperchat.authorColor,
            messageColor: legacy.messageTextColor || fsSuperchat.messageColor,
          }
        : {}),
    },
  };
}
```

**Áp dụng trong `_load()`:**

```js
if (profile?.customizeConfig) {
  const roleStyleConfig = stripStaleRoleRowDefaults(profile.roleStyleConfig) ?? baseline.roleStyleConfig;
  const fanServiceConfig = migrateSuperchatRoleIntoFanService(
    profile.roleStyleConfig, // đọc bản GỐC (trước khi bị normalizeRoleStyleConfig() bỏ field superchat)
    mergeFanServiceConfig(DEFAULT_FAN_SERVICE_CONFIG, profile.fanServiceConfig),
  );
  return {
    ...baseline,
    selectedTheme: themeId,
    customizeConfig: profile.customizeConfig,
    layoutConfig: profile.layoutConfig ?? baseline.layoutConfig,
    slotStyleConfig: profile.slotStyleConfig ?? baseline.slotStyleConfig,
    animationConfig: profile.animationConfig ?? baseline.animationConfig,
    decorationConfig: profile.decorationConfig ?? baseline.decorationConfig,
    roleStyleConfig, // normalizeRoleStyleConfig() (đã REFACTOR ở mục 2 #10) tự bỏ field superchat khi merge lần sau
    fanServiceConfig,
    lastSessionUrl: persisted.lastSessionUrl || '',
    windowBounds: persisted.windowBounds || DEFAULT_STATE.windowBounds,
  };
}
```

Sau `_flush()` lần đầu tiên (ghi lại `config.json`), `roleStyleConfig.roles.superchat` sẽ không
còn được ghi ra nữa (vì `normalizeRoleStyleConfig()` đã bỏ nhánh này) — object cũ trong file
JSON tồn đọng lại (nếu app tắt trước khi flush) vẫn an toàn vì migration function ở trên đọc
trực tiếp từ `persisted` mỗi lần load, không phụ thuộc việc đã flush hay chưa.

**Test cần thêm cho migration:** một smoke test mới `scripts/smoke-test-superchat-migration.js`
với 3 case tối thiểu:
1. `config.json` cũ, `roles.superchat.enabled: false` → `fanServiceConfig.superchat.enabled`
   giữ nguyên như trước migrate (không tự bật).
2. `config.json` cũ, `roles.superchat.enabled: true`, Fan Service chưa bật → sau migrate,
   `fanServiceConfig.superchat.enabled === true` và giữ đúng màu/badge/amount cũ.
3. `config.json` cũ có CẢ HAI đều bật (`roles.superchat.enabled: true` và
   `fanServiceConfig.superchat.enabled: true`) → Fan Service hiện có không bị ghi đè.

**Theme presets (18 file):** không cần migration runtime — đây là static data trong source
code, xử lý bằng cách sửa trực tiếp từng file (REMOVE field `superchat` khỏi `roles`) khi
implement, không phải dữ liệu user cần migrate.

---

## 5. OPEN QUESTIONS — cần Product/Design quyết định trước khi implement mục 3.2-3.4

- **OQ-1:** 18 theme preset hiện tô màu Super Chat khác nhau theo phong cách theme (`neon` chắc
  chắn có neon-glow riêng, `maid`/`vtuber-cute` có tông màu riêng...). Sau khi Super Chat rời
  khỏi Role, các theme này có còn được phép "gợi ý" màu Super Chat mặc định không?
  - **Phương án A (đơn giản nhất, khuyến nghị cho v1):** Không còn theme-specific Super Chat
    color nữa. Mọi theme dùng chung 1 default Fan Service superchat color
    (`DEFAULT_FAN_SERVICE_CONFIG.superchat`, vốn đã tồn tại độc lập với theme — xem
    `main/store/config-store.js` comment "Fan Service is deliberately NOT part of the
    theme-baseline system"). Rủi ro: chọn theme "neon" xong Super Chat trông lạc tông cho tới
    khi user tự vào Fan Service chỉnh.
  - **Phương án B:** Thêm `fanServiceConfig` (chỉ nhánh superchat) vào từng theme preset, áp
    dụng khi user CHỌN theme (giống cách `roleStyleConfig` hiện áp theo theme) — nhưng điều này
    phá vỡ đúng tinh thần "Fan Service is deliberately NOT part of the theme-baseline system"
    đã ghi rõ trong code, nên cần cân nhắc kỹ, có thể cần đổi luôn kiến trúc theme-baseline.
- **OQ-2:** `messageBorderWidth` của Role Super Chat cũ (field `role.superchat.messageBorderWidth`
  qua `createRoleDefaults()`) có cần một field tương đương `messageBorderWidthScale` mới trong
  Fan Service group `superchat` không, hay chấp nhận mất field này (border width superchat sau
  refactor luôn dùng `var(--ovs-bubble-border-width, 1px)` mặc định)?
- **OQ-3:** Xác nhận lại hành vi ở mục 3.7 hàng đầu: khi Fan Service `superchat.enabled = false`,
  Super Chat row có nên **hoàn toàn không có style đặc biệt nào** (đúng tinh thần "Super Chat
  chỉ tồn tại trong Fan Service"), hay vẫn cần một fallback tối thiểu (ví dụ luôn hiện số tiền,
  dù không tô màu) để không bị xem là "mất tính năng" đối với user chưa từng biết tới tab Fan
  Service? Tài liệu này giả định câu trả lời là "không style gì cả" (đúng như thiết kế Fan
  Service off-by-default đã ghi từ đầu) — nhưng đây là thay đổi hành vi có thể gây ngạc nhiên
  cho user cũ vì trước đây Role Super Chat mặc định `enabled: true`.

---

## 6. CHECKLIST IMPLEMENT (thứ tự khuyến nghị)

1. `shared/fan-service-config.js`: extend `createGroupConfig()` + `compileGroupVars()` +
   `groupOverrideCssBlock()` + `compileFanServiceCss()` theo mục 3.2 & 3.5. Viết smoke test mới
   `scripts/smoke-test-fan-service-superchat.js` trước khi đụng tới Role.
2. `shared/role-style-config.js`: xoá `superchat` khỏi `ROLE_KEYS`, xoá
   `createSuperchatDefaults`/`normalizeSuperchatRole`, xoá nhánh `roleKey === 'superchat'`
   trong `compileRoleStyleToCssVariables()`. Cập nhật `scripts/smoke-test-role-style-config.js`.
3. `overlay/role-styles.css`: xoá dòng 1-17 + 245-419 (block superchat màu/tier/amount); sửa
   dòng 18-113 bỏ `:not(.ovs-superchat)` ở phần badge theo mục 3.3.
4. `overlay/modules/bubble.js`: sửa `ROLE_PRIORITY`/`resolveRoleForNode()` đọc màu tai thỏ
   superchat từ `state.currentFanService.superchat` thay vì `state.currentRoleStyle.roles`.
5. `overlay/modules/message-renderer.js`, `bubble-updater.js`, `pool/bubble-reset.js`: cập nhật
   comment (không đổi logic).
6. `main/store/config-store.js`: thêm `migrateSuperchatRoleIntoFanService()` theo mục 4.
7. `main/store/theme-baseline.js`: cập nhật nhãn `getDirtyFields()`.
8. `shared/theme-presets/helpers.js` + 18 file theme: xoá field `roles.superchat` (chốt xong
   OQ-1 trước bước này).
9. `renderer-dashboard/src/components/RoleStylesPanel.jsx`: xoá tab Super Chat + code liên quan
   (mục 2 #30-32).
10. `renderer-dashboard/src/components/FanServicePanel.jsx`: thêm 3 section mới cho group
    `superchat` (mục 3.6), tái dùng component moved từ bước 9.
11. `renderer-dashboard/src/lib/ipc.js`: xoá mock `roles.superchat`, viết lại mock
    `fanServiceConfig` đúng schema mới.
12. `renderer-dashboard/src/App.jsx`: cập nhật copy 2 tab.
13. `scripts/Verify fan service cascade.js`: viết lại theo mục 2 #40 + case moderator/superchat
    kết hợp (mục 3.3).
14. Chạy toàn bộ smoke test trong `scripts/` + test migration mới (mục 4) trước khi coi refactor
    hoàn tất.

---

## 7. TÓM TẮT CHO AGENT TIẾP THEO

- Không đổi data model (`chat-message.js`). Không đổi cơ chế capture YouTube.
- Role còn 2 khoá: `moderator`, `member` — thuần Identity.
- Toàn bộ khả năng style Super Chat (màu theo tier, badge, số tiền, layout, typography) dồn
  vào `fan-service-config.js` group `superchat`, compile ra CSS **scoped** (không phải
  `:root` + `data-attribute` như Role) — do đó không cần cơ chế root-flag mới, chỉ cần mở rộng
  `compileFanServiceCss()`.
- Hook DOM trung lập (`ovs-superchat`, `ovs-superchat-tier-N`, `--ovs-superchat-tier-*`,
  `.ovs-superchat-amount`, `.ovs-author-area`) do `message-renderer.js`/`bubble-updater.js`
  gắn **không đổi** — đây là hạ tầng dùng chung, refactor chỉ đổi ai tiêu thụ nó.
- 3 quyết định cần chốt trước khi code (mục 5: OQ-1/2/3) — nếu chưa có câu trả lời, mặc định
  dùng phương án khuyến nghị đã nêu (A cho OQ-1, "bỏ field" cho OQ-2, "không style gì" cho OQ-3)
  để không block tiến độ.
- Migration bắt buộc (mục 4) để không phá overlay của user hiện tại khi họ mở app sau khi
  cập nhật — không được bỏ qua bước này.

---

## 8. COMPLETED PHASE 2

Thực hiện xong toàn bộ refactor mô tả ở mục 1-7. Build dashboard (`npm run build:dashboard`)
thành công, không lỗi compile. Toàn bộ smoke test hiện có + 2 test mới đều PASS.

### 8.1 File đã sửa

**Mới tạo:**
- `shared/css-content-helpers.js` — tách `quoteCssContent`/`isImageUrlValue`/`getBadgeImageSrc`/
  `FONT_WEIGHT_MAP` ra khỏi `role-style-config.js` thành module trung lập, để
  `fan-service-config.js` dùng chung mà không phải phụ thuộc ngược vào Role.
- `scripts/smoke-test-fan-service-superchat.js` — test badge/tier-color/manual-color/amount
  display compile đúng trong `compileFanServiceCss()`.
- `scripts/smoke-test-superchat-migration.js` — test `migrateSuperchatRoleIntoFanService()`
  (5 case: không có legacy, legacy tắt, legacy bật + tier color, legacy bật + màu thủ công,
  Fan Service đã bật sẵn thì không bị ghi đè).
- `scripts/smoke-test-fan-service-cascade.js` — thay cho
  `scripts/Verify fan service cascade.js` (đã xoá) — do `role-styles.css` không còn biết gì về
  Super Chat nữa nên không còn "cascade fight" để test; test mới xác nhận Fan Service tự áp màu
  và badge MOD của Role vẫn hiện trên dòng vừa là mod vừa là superchat.

**Sửa:**
- `shared/role-style-config.js` — Role chỉ còn Identity (`ROLE_KEYS = ['moderator', 'member']`).
  Xoá `createSuperchatDefaults`, `normalizeSuperchatRole`, field `showAmount`,
  `DEFAULT_ROLE_STYLE_CONFIG.roles.superchat`, toàn bộ nhánh `roleKey === 'superchat'` trong
  `compileRoleStyleToCssVariables`. Vẫn re-export `quoteCssContent`/`isImageUrlValue`/
  `getBadgeImageSrc` (nay lấy từ `css-content-helpers.js`) vì `message-renderer.js`/
  `bubble-updater.js` đang import chúng từ đây cho badge Mốc tháng — không đổi 2 file đó.
- `shared/fan-service-config.js` — thêm field superchat-only vào `createGroupConfig()`:
  `badgeBefore`, `badgeAfter`, `useTierColor`, `showAmount`, `amountPosition`,
  `amountFontScale`, `amountFontWeight`; thêm `BASE_SIZES.amountFontSize`.
  `groupOverrideCssBlock()` nhận thêm tham số `isSuperchatGroup`, khi `true` sẽ emit thêm CSS
  scoped cho: nền/viền theo tier hoặc màu thủ công, badge trước/sau tên, khối
  `.ovs-superchat-amount` (ẩn/hiện, inline/block, font), và fix tương phản chữ cho tier 1-2.
  `compileFanServiceCss()` truyền `isSuperchatGroup=true` cho group `superchat`.
- `overlay/role-styles.css` — xoá toàn bộ khối "3. SUPER CHAT STYLES" (~180 dòng) và badge Super
  Chat riêng; bỏ `:not(.ovs-superchat)` ở các selector badge (`::before`/`::after` + rule
  `position: relative` đi kèm) cho Mod/Member, **giữ nguyên** `:not(.ovs-superchat)` ở các rule
  màu/nền (để tránh Role tô màu rồi bị Fan Service ghi đè ngay — tránh nháy hình). Giữ lại default
  `.ovs-superchat-amount { display: none; }` (không gate theo `data-ovs-role-*` nữa) làm baseline
  khi Fan Service tắt. Tiện thể sửa 1 lỗi thừa dấu `}` mồ côi có sẵn từ trước (không liên quan
  refactor, phát hiện khi đếm brace).
- `overlay/modules/bubble.js` — `ROLE_PRIORITY` bỏ entry `superchat`. Thêm
  `resolveFanServiceSuperchatEarBg()` đọc màu tai thỏ từ `state.currentFanService.superchat`
  (theo tier color đã set inline trên rowEl, hoặc `authorColor` thủ công khi `useTierColor: false`);
  gọi hàm này trước, rơi về `resolveRoleForNode()` (mod/member) khi Fan Service superchat tắt hoặc
  dòng không phải superchat.
- `overlay/modules/message-renderer.js` — sửa comment mô tả sai kiến trúc cũ ("combined role CSS")
  thành mô tả đúng mô hình mới (Role và Fan Service mỗi bên style đúng phần mình sở hữu).
- `main/store/config-store.js` — thêm `migrateSuperchatRoleIntoFanService()` (chi tiết mục 8.3),
  gọi trong `_load()` trước khi build state; export hàm này để test.
- `main/store/theme-baseline.js` — nhãn dirty-field `'kiểu mod/hội viên/superchat'` →
  `'kiểu mod/hội viên'`.
- `main/server/shared-esm-bridge.js` — thêm `'css-content-helpers'` vào `ALLOWED_MODULES` (module
  mới cần được phép require ở phía overlay browser-side).
- `shared/theme-presets/helpers.js` — `defaultRoles()` bỏ key `superchat`.
- `shared/theme-presets/themes/*.js` (cả 18 theme) — xoá khối `roles.superchat` và field thừa
  `showAmount: null` còn sót ở `roles.moderator`/`roles.member`. Theme không còn mang theo
  "default look" riêng cho Super Chat — Fan Service dùng 1 default chung, tắt sẵn (xem OQ-1).
- `renderer-dashboard/src/components/RoleStylesPanel.jsx` — bỏ tab "Super Chat" khỏi `ROLE_TABS`,
  xoá `SuperchatEditor`, `SUPERCHAT_DEFAULTS`, `TIER_TABLE`/`TierColorPreview` (chuyển sang
  `FanServicePanel.jsx`), bỏ field `showAmount` khỏi `EMPTY_ROLE`, sửa tiêu đề panel còn
  "Mod / Hội viên".
- `renderer-dashboard/src/components/FanServicePanel.jsx` — thêm `TIER_TABLE`/`TierColorPreview`,
  `WEIGHT_OPTIONS`, `BadgeFields` (chuyển từ RoleStylesPanel.jsx); `GroupEditor` thêm 3 section chỉ
  hiện khi `groupKey === 'superchat'`: (1) toggle "Tự động dùng màu theo tier" + preview/cảnh báo,
  (2) Badge trước/sau tên, (3) toggle hiện số tiền + vị trí/cỡ chữ/độ đậm.
- `renderer-dashboard/src/lib/ipc.js` — mock `roleStyleConfig.roles` bỏ `superchat`; mock
  `fanServiceConfig.superchat` bổ sung các field mới (badgeBefore/After, useTierColor, showAmount,
  amountPosition, amountFontScale, amountFontWeight).
- `package.json` — thêm script `smoke:fan-service-superchat`, `smoke:superchat-migration`,
  `smoke:fan-service-cascade`.

**Không đổi (theo đúng phạm vi "Không sửa UI lớn / Không đổi renderer nếu chưa cần"):**
`shared/chat-message.js`, `overlay/modules/message-renderer.js` (trừ 1 comment),
`overlay/modules/bubble-updater.js`, `overlay/modules/pool/bubble-reset.js`,
`overlay/modules/dom-diff.js`, `overlay/modules/socket.js`, `renderer-dashboard/src/App.jsx`
(không có copy nào nhắc Super Chat cần sửa).

### 8.2 Schema mới

`shared/role-style-config.js`:
```js
ROLE_KEYS = ['moderator', 'member']   // trước: ['moderator', 'member', 'superchat']
```

`shared/fan-service-config.js` — `createGroupConfig()` bổ sung (tồn tại trên cả `superchat` lẫn
`membership` cho đồng nhất shape, nhưng chỉ đọc khi group là `superchat`):
```js
{
  // ...các field layout/typography sẵn có...
  badgeBefore: null,          // text/emoji hoặc URL ảnh — dùng quoteCssContent/getBadgeImageSrc
  badgeAfter: null,
  useTierColor: true,         // true = đọc --ovs-superchat-tier-* inline theo dòng; false = màu thủ công
  showAmount: true,
  amountPosition: 'inline',   // 'inline' | 'block'
  amountFontScale: 1,         // x BASE_SIZES.amountFontSize (16px)
  amountFontWeight: 'bold',   // 'normal' | 'bold' | 'extrabold'
}
```

### 8.3 Migration

`main/store/config-store.js#migrateSuperchatRoleIntoFanService(rawRoleStyleConfig, fanServiceConfig)`:

- Input: `roleStyleConfig` **thô** (đọc thẳng từ `config.json`, chưa qua `normalizeRoleStyleConfig`)
  để còn thấy được `roles.superchat` cũ trước khi nó bị chuẩn hoá bỏ đi.
- Không làm gì nếu: không có `roles.superchat`, hoặc `roles.superchat.enabled === false` (user
  chưa từng bật style riêng cho Super Chat qua tab Role cũ).
- Không làm gì nếu Fan Service `superchat.enabled` đã là `true` sẵn (ưu tiên lựa chọn Fan Service
  hiện tại của user, không ghi đè bằng dữ liệu Role cũ).
- Ngược lại: bật `fanServiceConfig.superchat.enabled = true` và copy `useTierColor`, `badgeBefore`,
  `badgeAfter`, `showAmount`, `amountPosition`, `amountFontWeight`; `amountFontSize` (px tuyệt đối)
  quy đổi thành `amountFontScale = amountFontSize / 16`; nếu `useTierColor === false` thì copy thêm
  `authorColor` và `messageTextColor` (Role) → `authorColor`/`messageColor` (Fan Service) — để
  overlay giữ nguyên hình ảnh cũ ngay sau khi cập nhật, không cần user tự cấu hình lại.

### 8.4 Kết quả build & test

```
npm run build:dashboard   → ✓ 79 modules transformed, built in 3.40s, không lỗi
node --check <file>       → tất cả file .js đã sửa đều hợp lệ
```

Smoke test (chạy bằng `node scripts/<file>.js`, đã cài `node_modules` qua
`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install`):

| Test | Kết quả |
|---|---|
| smoke-test-chat-message.js | PASS |
| smoke-test-customize-config.js | PASS |
| smoke-test-danmaku-config.js | PASS |
| smoke-test-decoration-config.js | PASS |
| smoke-test-fan-service-cascade.js (mới) | PASS |
| smoke-test-fan-service-superchat.js (mới) | PASS |
| smoke-test-role-style-config.js (đã sửa) | PASS |
| smoke-test-server.js | PASS |
| smoke-test-slot-style.js | PASS |
| smoke-test-superchat-migration.js (mới) | PASS |
| smoke-test-theme-baseline.js | PASS |
| smoke-test-ticker-config.js | PASS |
| verify-decoration-cascade.js | PASS |
| verify-layer-split.js | PASS |

Ghi chú: `smoke-test-superchat-migration.js` và `smoke-test-theme-baseline.js` require
`main/store/config-store.js`, vốn `require('electron')` ở top-level; trong sandbox này Electron
được cài với `ELECTRON_SKIP_BINARY_DOWNLOAD=1` nên không có binary thật để tự kiểm chứng — đã xác
minh 2 test này PASS bằng cách tạm thay `node_modules/electron` bằng 1 stub tối thiểu
(`{ app: { getPath: () => '/tmp/...' } }`, đủ cho `ConfigStore` không được khởi tạo trong 2 test
này — chỉ hàm thuần `migrateSuperchatRoleIntoFanService`/`buildUserOverlayProfile` được gọi), sau
đó khôi phục lại `electron` thật. Trên máy dev thật (có Electron cài đầy đủ) 2 test này chạy thẳng
không cần stub.

### 8.5 Việc cố ý KHÔNG làm (đúng theo mục "Output" và phạm vi refactor)

- Không sửa UI lớn: `FanServicePanel.jsx`/`RoleStylesPanel.jsx` chỉ thêm/bớt section theo đúng
  layout accordion/fieldset có sẵn, không đổi shell/navigation của dashboard.
- Không đổi renderer: `message-renderer.js`, `bubble-updater.js` giữ nguyên logic (chỉ 1 comment ở
  message-renderer.js) — các hook DOM trung lập (`ovs-superchat`, `--ovs-superchat-tier-*`,
  `.ovs-superchat-amount`, v.v.) vẫn được gắn y hệt như trước, refactor chỉ đổi ai tiêu thụ chúng.
- Không đổi `shared/chat-message.js` — data model và cơ chế parse tier tiền Super Chat giữ nguyên.

---

## 9. COMPLETED PHASE 3

### 9.1 Kết luận verify

Scan lại toàn bộ project sau Phase 2: **mục 1 và 2 (xoá UI Super Chat khỏi Role, dồn toàn bộ
vào Fan Service) đã được hoàn tất đúng và đầy đủ từ Phase 2** — không tìm thấy section, panel,
state, component hay import Super Chat nào còn sống trong đường dẫn Role. Phase 3 vì vậy là
**verify + đóng gói**, không phát sinh thay đổi logic mới. Chi tiết verify từng mục:

**1. UI Super Chat trong tab Role — đã sạch hoàn toàn:**
- `shared/role-style-config.js`: `ROLE_KEYS = ['moderator', 'member']`. Không còn
  `createSuperchatDefaults`, `normalizeSuperchatRole`, nhánh `roleKey === 'superchat'`. Các dòng
  còn chứa chữ "superchat" chỉ là comment giải thích lịch sử/tham chiếu chéo sang
  `fan-service-config.js`, không phải code sống.
- `renderer-dashboard/src/components/RoleStylesPanel.jsx`: `ROLE_TABS` không còn tab Super Chat.
  Không còn `SuperchatEditor`, `SUPERCHAT_DEFAULTS`, `TIER_TABLE`/`TierColorPreview` (đã chuyển
  hẳn sang `FanServicePanel.jsx`). 6 dòng còn chữ "Super Chat"/"SUPERCHAT" đều là comment giải
  thích (ví dụ: Member Tiers dùng chung model với `SUPERCHAT_TIER_TABLE` cũ), không có state hay
  JSX nào render UI Super Chat.
- `renderer-dashboard/src/lib/ipc.js`: không còn `roleStyleConfig.roles.superchat` trong mock.

**2. UI Super Chat đã dồn đúng và đầy đủ vào Fan Service, giao diện đồng bộ:**
- `renderer-dashboard/src/components/FanServicePanel.jsx`: group `superchat` có đủ 3 section
  moved từ Role cũ — (1) toggle tier-color tự động / màu thủ công + preview cảnh báo, (2) badge
  trước/sau tên, (3) toggle hiện số tiền + vị trí/cỡ chữ/độ đậm — dùng chung `GroupEditor`,
  `AccordionSection`, style token với group `membership` sẵn có → không tạo hệ thống UI mới, đúng
  yêu cầu "Giữ giao diện đồng bộ. Không tạo hệ thống mới".
- `shared/fan-service-config.js`: `compileFanServiceCss()` compile group `superchat` ra CSS
  scoped riêng (`.ovs-message.ovs-superchat ...`), độc lập với `membership`.

**3. Renderer đã đúng render flow Role → Theme → Appearance → Emphasis → Fan Service:**
- Xác nhận cascade thực tế qua `overlay/index.html` + `overlay/modules/css-variables.js`:
  - **Role**: `overlay/role-styles.css` compile từ `roleStyleConfig` (identity: mod/member).
  - **Theme**: `theme-manager.js`/`theme-baseline.js` là baseline áp giá trị mặc định cho
    Role/Customize/Decoration khi user CHỌN theme — không phải một lớp CSS runtime riêng, mà là
    nguồn dữ liệu nạp vào 3 lớp kia trước khi chúng render.
  - **Appearance** (tab Customize — font, màu, bubble, avatar...) và **Emphasis** (tab
    Decorations — sticker, hiệu ứng, texture) đều được `css-variables.js#applyCssVariables()`
    compile thành CSS custom properties ghi lên `:root`, cộng với `overlay/slot-decorations.css`
    + `overlay/decoration-layers.css` nạp trước `role-styles.css` trong `index.html`.
  - **Fan Service**: `applyFanServiceStyle()` tạo/replace **một `<style id="ovs-fan-service-style">`
    duy nhất, luôn được `document.head.appendChild()` sau cùng** (chạy sau khi mọi `<link
    rel="stylesheet">` tĩnh đã có mặt trong `<head>` từ lúc parse HTML) — do đó luôn đứng sau
    Role/Theme/Appearance/Emphasis trong source order, đúng thứ tự override yêu cầu. CSS sinh ra
    còn dùng selector scoped theo hook DOM trung lập (`.ovs-superchat`, `.ovs-membership-*`) và
    `!important` ở các điểm bắt buộc thắng (ẩn/hiện `.ovs-superchat-amount`, tô màu tier tương
    phản) để không phụ thuộc hoàn toàn vào source order khi có thay đổi thứ tự link trong tương
    lai.
- **Fan Service chỉ override khi event xảy ra, hết event quay về Role** — xác nhận cơ chế đã có
  sẵn hoạt động đúng, không cần sửa: `overlay/modules/message-renderer.js` chỉ gắn class
  `.ovs-superchat`/`data-ovs-superchat-tier`/CSS var tier lên đúng dòng tin nhắn là Super Chat
  tại thời điểm render — CSS Fan Service override dùng selector `.ovs-message.ovs-superchat...`
  nên chỉ áp lên đúng dòng đó, các dòng thường (`.ovs-message` không có `.ovs-superchat`) vẫn
  100% do Role/Theme/Appearance/Emphasis quyết định giao diện. Khi bubble được pool tái sử dụng
  cho tin nhắn kế tiếp không phải Super Chat, `overlay/modules/pool/bubble-reset.js` xoá sạch
  class/dataset/CSS var superchat còn sót (`resetMemberMonths`, dòng ~229-246, ~288-309) trước
  khi bubble build lại với dữ liệu mới → dòng đó quay về style Role/Theme/Appearance/Emphasis
  thuần, không có tàn dư Fan Service. Đây chính là cơ chế "kết thúc event quay về Role" — event ở
  đây là *một dòng tin nhắn cụ thể là Super Chat*, không phải một khoảng thời gian hiển thị tạm
  thời, và nó tự nhiên đóng khi dòng đó rời khỏi DOM/bị pool tái chế.

### 9.2 File đã sửa trong Phase 3

**Không sửa file code nào** — verify cho thấy Phase 2 đã implement đúng và đủ theo đúng tinh
thần mục 1-3 của Phase 3, không phát hiện leftover hay lệch kiến trúc cần vá. Chỉ cập nhật tài
liệu này (`docs/refactor-superchat-to-fanservice.md`, thêm mục 9).

### 9.3 Verify — không regression

Chạy lại toàn bộ 17 script trong `scripts/` (14 file `.js` bằng `node scripts/<file>.js`, 3 file
`.mjs` bằng `node scripts/<file>.mjs`) + `npm run build:dashboard`:

| Hạng mục | Test | Kết quả |
|---|---|---|
| Build | `npm run build:dashboard` | ✓ 79 modules transformed, built in 7.95s |
| Chat message / data model | smoke-test-chat-message.js | PASS |
| **Appearance** (Customize) | smoke-test-customize-config.js | PASS |
| **Emphasis** (Decoration) | smoke-test-decoration-config.js | PASS |
| **Emphasis** (Decoration cascade thật) | verify-decoration-cascade.js | PASS |
| **Emphasis** (layer split — idle/danmaku/render) | verify-layer-split.js | PASS |
| Danmaku config | smoke-test-danmaku-config.js | PASS |
| **Fan Service ↔ Role cascade** (mod + superchat cùng dòng) | smoke-test-fan-service-cascade.js | PASS |
| **Fan Service** (superchat group compile) | smoke-test-fan-service-superchat.js | PASS |
| **Role** (identity, mod/member) | smoke-test-role-style-config.js | PASS |
| Server / socket | smoke-test-server.js | PASS |
| Slot style | smoke-test-slot-style.js | PASS |
| Migration Role Super Chat → Fan Service | smoke-test-superchat-migration.js | PASS¹ |
| **Theme** (baseline dirty-fields) | smoke-test-theme-baseline.js | PASS¹ |
| Ticker config | smoke-test-ticker-config.js | PASS |
| **Bubble** (pool warm-up) | smoke-test-pool-warmup.mjs | PASS |
| **Bubble** (pool dynamic resize) | smoke-test-pool-dynamic.mjs | PASS |
| **Bubble** (reset khi tái sử dụng — bao gồm reset dấu vết superchat) | smoke-test-bubble-reset.mjs | PASS |

¹ Hai test này `require('electron')`, không có Electron binary thật trong sandbox này
(`ELECTRON_SKIP_BINARY_DOWNLOAD=1`). Verify bằng cách tạm thay `node_modules/electron` bằng stub
tối thiểu (`{ app: { getPath, getVersion } }`) — đủ để chạy các hàm thuần `migrateSuperchatRoleIntoFanService`/
`buildUserOverlayProfile`/`getDirtyFields` không cần khởi tạo `BrowserWindow` — sau đó khôi phục
lại package `electron` thật nguyên vẹn. Trên máy dev có Electron cài đầy đủ, 2 test này chạy
thẳng không cần stub.

**Kết luận:** không regression ở bất kỳ hạng mục nào trong yêu cầu VERIFY (Theme, Role,
Membership, Bubble, Decoration, Appearance, Emphasis). Membership (group thứ hai của Fan Service,
độc lập với superchat) không bị đụng tới trong Phase 3 và vẫn PASS qua
`smoke-test-fan-service-superchat.js`/`smoke-test-fan-service-cascade.js` chạy chung module.

### 9.4 Trạng thái refactor

Refactor Super Chat → Fan Service (mục 1-7 của tài liệu này) coi như **hoàn tất toàn bộ** kể từ
Phase 3. Không còn open item nào trong Checklist Implement (mục 6) chưa làm.

---

## 10. FINAL ARCHITECTURE (hoàn thiện refactor)

### 10.1 Cleanup thực hiện trong pass này

Scan sâu toàn bộ project (dead code / duplicate logic / legacy Super Chat / unused imports /
unused state / unused config / duplicate utils) cho kết quả: kiến trúc từ Phase 2-3 đã đúng đắn,
chỉ có 3 điểm lệch ownership/mock-schema thực sự cần dọn, không phát sinh thay đổi hành vi runtime:

1. **`overlay/modules/message-renderer.js` + `overlay/modules/bubble-updater.js`** — trước đây
   import `quoteCssContent`/`isImageUrlValue`/`getBadgeImageSrc` gián tiếp qua
   `/shared/role-style-config.mjs`, dù 2 hàm này đã chuyển hẳn sang `css-content-helpers.js` từ
   Phase 2. Sửa lại import thẳng từ `/shared/css-content-helpers.mjs` — cùng cách
   `fan-service-config.js` đã làm — để đường phụ thuộc rõ ràng: cả Role lẫn Fan Service đều lấy
   helper trực tiếp từ module trung lập, không bên nào phụ thuộc ngược vào bên kia qua một
   đường vòng lịch sử.
2. **`shared/role-style-config.js`** — xoá re-export `quoteCssContent`/`isImageUrlValue`/
   `getBadgeImageSrc` khỏi `module.exports` (hệ quả của #1 ở trên — không còn ai import 3 hàm này
   qua đường Role nữa). API công khai của Role giờ chỉ còn đúng những gì Role thực sự sở hữu.
3. **`renderer-dashboard/src/lib/ipc.js`** — mock `fanServiceConfig` (chỉ dùng khi chạy
   `npm run dev:dashboard` ngoài Electron) vẫn mang schema cũ trước cả refactor Super Chat →
   Fan Service (`gap`, `padding`, `authorFontSize` dạng px tuyệt đối, `nameBadges`,
   `packageNameEnabled`/`packageNameSameLine`/`packageNameFontSize`/`packageNameColor` — những
   field không còn tồn tại trong `shared/fan-service-config.js#createGroupConfig` hiện tại, vốn
   dùng field dạng scale + `showMemberMonths`/`monthsAlign`/`monthsFontScale`/`monthsColor`,
   không còn khái niệm "Tên gói hội viên"). Thay bằng `mockGroupDefaults` khớp 1:1 với
   `createGroupConfig()` thật, để `FanServicePanel.jsx` chạy đúng khi dev ngoài Electron thay vì
   âm thầm rơi về `??` fallback trong JSX cho gần như mọi field.

**Đã rà soát, xác nhận KHÔNG phải dead code / KHÔNG sửa** (để tránh phá vỡ quy ước sẵn có của
project một cách không cần thiết):
- `ROLE_CSS_PREFIX`, `createRoleDefaults` (role-style-config.js), `mergeGroupConfig`,
  `compileGroupVars` (fan-service-config.js) — export ra `module.exports` nhưng hiện chỉ được
  dùng nội bộ trong chính file đó, không ai import từ ngoài. Đây là quy ước nhất quán trên toàn
  bộ `shared/*-config.js` (đối chiếu `layout-config.js`, `customize-config.js`,
  `decoration-config.js` — tất cả đều export nguyên "bề mặt module" kể cả phần chưa có consumer
  ngoài), không phải lỗi sót riêng của refactor này nên không xoá.
- `TIER_TABLE` trong `FanServicePanel.jsx` trùng dữ liệu với `SUPERCHAT_TIER_TABLE`
  (`shared/chat-message.js`) — trùng có chủ đích: `renderer-dashboard` (bundle Vite) không import
  thẳng module CJS trong `shared/` (cùng giới hạn khiến `ipc.js` phải tự tay mirror
  `ANIMATION_STYLE_PRESETS`), và bản trong dashboard chỉ là legend hiển thị tĩnh (không có
  bg/border, không dùng để compile CSS overlay) — đã có comment giải thích ngay tại chỗ từ
  Phase 2, giữ nguyên.
- Role's "Mốc tháng" (`memberTiers`/`resolveMemberTier`) — không trùng với Fan Service
  `membership` group: `memberTiers` là thuộc tính Identity của role `member` (badge theo số
  tháng đã gắn bó, gắn liền với MỌI tin nhắn của member đó), còn Fan Service `membership` là
  style cho 3 SỰ KIỆN rời rạc (`membership_new`/`membership_milestone`/`membership_gift_sent`,
  nhận diện qua class `.ovs-event-<type>`) — khác cơ chế, khác vòng đời, không phải cùng một khái
  niệm "Membership" bị trùng lặp.
- Data-capture layer (`main/capture-preload.js` — đọc `isSuperchat`/`superchatColor`/
  `superchatAmountRaw` từ DOM YouTube) — đây là tầng thu thập dữ liệu, ngoài phạm vi refactor
  theo đúng mục 7 tài liệu này ("Không đổi cơ chế capture YouTube"), không phải logic style Super
  Chat cần dọn.

### 10.2 Kiến trúc cuối

```
                     ┌─────────────────────────────────────────────┐
                     │                 THEME (baseline)             │
                     │  shared/theme-manager.js / theme-baseline.js │
                     │  — nguồn giá trị mặc định nạp vào Role/       │
                     │  Appearance/Emphasis khi user CHỌN theme;     │
                     │  không phải một lớp CSS runtime riêng.        │
                     └───────────────────┬───────────────────────────┘
                                          │ áp giá trị mặc định khi chọn theme
                                          ▼
   ┌───────────┐   ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
   │   ROLE    │   │  APPEARANCE   │   │   EMPHASIS    │   │    FAN SERVICE     │
   │ Identity  │   │  (Customize)  │   │ (Decorations) │   │  (Super Chat +     │
   │ only      │   │               │   │               │   │   Membership)      │
   └─────┬─────┘   └───────┬───────┘   └───────┬───────┘   └─────────┬─────────┘
         │                 │                   │                     │
   role-styles.css   :root CSS vars      slot-decorations.css   <style id=
   (data-ovs-role-*  (css-variables.js   decoration-layers.css  "ovs-fan-service
   scoped selectors) #applyCssVariables)                        -style"> — scoped
                                                                 CSS, appended
                                                                 LAST vào <head>
         └─────────────────┴───────────────────┴─────────────────────┘
                                     │
                        Mọi dòng tin nhắn (.ovs-message)
                        thừa hưởng Role + Appearance + Emphasis
                        theo cascade nguồn (source order) bình thường.
                                     │
                                     ▼
                  Dòng có event (.ovs-superchat / .ovs-event-<type>)?
                        │                              │
                       KHÔNG                           CÓ
                        │                              │
                        ▼                              ▼
              Giữ nguyên style Role/          Fan Service's scoped <style>
              Appearance/Emphasis             (source-order sau cùng +
              (không có gì override)          selector cụ thể hơn + !important
                                               ở các điểm bắt buộc thắng) ghi
                                               đè MÀU/BADGE/SỐ TIỀN/SỐ THÁNG
                                               cho đúng dòng đó.
                                     │
                    Bubble bị pool tái sử dụng cho tin nhắn kế tiếp
                    (overlay/modules/pool/bubble-reset.js) →
                    xoá sạch class/dataset/CSS var event còn sót →
                    dòng mới quay lại đúng nhánh "KHÔNG" ở trên.
```

### 10.3 Render Flow (xác nhận cuối, khớp mục tiêu "Role → Theme → Appearance → Emphasis →
Fan Service")

1. **Role** — `shared/role-style-config.js` compile `roleStyleConfig` (chỉ `moderator`/`member`)
   thành `--ovs-role-*` vars + `data-ovs-role-*` root flags; `overlay/role-styles.css` đọc chúng,
   nạp vào `<head>` ở vị trí link thứ 9/14 trong `overlay/index.html`.
2. **Theme** — không phải một lớp CSS độc lập trong request-time cascade; là nguồn baseline
   (`resolveThemeState()`/`theme-manager.js`) nạp giá trị mặc định cho Role/Appearance/Emphasis
   tại thời điểm user CHỌN theme, trước khi 3 lớp kia render.
3. **Appearance** (tab "Tuỳ chỉnh"/Customize) — `customizeConfig` compile qua
   `css-variables.js#applyCssVariables()` thành `:root` custom properties (font, màu, bubble,
   avatar...), cùng lúc với Layout/SlotStyle/Animation.
4. **Emphasis** (tab "Trang trí"/Decorations) — `decorationConfig` compile ra sticker/hiệu ứng,
   dùng `overlay/slot-decorations.css` + `overlay/decoration-layers.css` (nạp trước
   `role-styles.css` trong `index.html`, link thứ 7-8/14).
5. **Fan Service** — `applyFanServiceStyle()` (`overlay/modules/css-variables.js`) tạo/replace
   MỘT `<style id="ovs-fan-service-style">` duy nhất, luôn `document.head.appendChild()` **sau
   cùng** mỗi lần state đổi — do đó luôn đứng sau toàn bộ 14 `<link rel="stylesheet">` tĩnh trong
   source order. CSS sinh ra chỉ khớp đúng dòng đang có event
   (`.ovs-message.ovs-superchat...` / `.ovs-message.ovs-event-<type>...`), dùng thêm
   `!important` ở các điểm bắt buộc thắng (ẩn/hiện `.ovs-superchat-amount`, tô màu tương phản
   theo tier) — không phụ thuộc hoàn toàn vào source order nếu sau này ai đó đổi thứ tự link
   trong `index.html`.
6. **Kết thúc event → quay về Role** — event ở đây là chính dòng tin nhắn đó có phải Super
   Chat/membership event hay không, KHÔNG phải một khung thời gian hiển thị tạm thời. Khi bubble
   pool tái sử dụng node cho tin nhắn kế tiếp (không phải event), `pool/bubble-reset.js` xoá sạch
   toàn bộ class/dataset/CSS var event trước khi build lại — dòng đó ngay lập tức chỉ còn chịu
   ảnh hưởng của Role/Appearance/Emphasis, đúng yêu cầu "Kết thúc event phải quay về Role".

### 10.4 Ownership (ai sở hữu field/logic nào)

| Miền | Sở hữu bởi | Ghi chú |
|---|---|---|
| Identity (mod/member bật/tắt, màu, badge, Mốc tháng theo tháng) | `shared/role-style-config.js` | Chỉ 2 role: `moderator`, `member`. Không biết gì về Super Chat. |
| Super Chat (màu theo tier/màu thủ công, badge, số tiền) | `shared/fan-service-config.js` group `superchat` | Single Source of Truth — không còn nơi thứ 2 nào style Super Chat. |
| Membership event (Hội viên mới/Gia hạn/Tặng) | `shared/fan-service-config.js` group `membership` | Single Source of Truth cho 3 sự kiện; độc lập với Mốc tháng (Identity). |
| Badge/CSS-content helper thuần (quote, image-url, font-weight map) | `shared/css-content-helpers.js` | Không biết khái niệm "role" hay "group"; Role và Fan Service cùng import trực tiếp, không phụ thuộc ngược lẫn nhau. |
| Data thô Super Chat (tier/color/amount đọc từ DOM YouTube) | `main/capture-preload.js` → `shared/chat-message.js` | Tầng thu thập dữ liệu, tách biệt hoàn toàn khỏi tầng style — ngoài phạm vi refactor này. |
| Hook DOM trung lập (`.ovs-superchat`, `.ovs-event-<type>`, CSS var tier) | `overlay/modules/message-renderer.js` / `bubble-updater.js` | Gắn hook không đổi qua toàn bộ refactor; Role và Fan Service chỉ khác nhau ở AI TIÊU THỤ hook, không phải ai TẠO hook. |
| Reset khi bubble tái sử dụng (đảm bảo "hết event → về Role") | `overlay/modules/pool/bubble-reset.js` | Cơ chế duy nhất dọn sạch dấu vết event khỏi 1 node trước khi tái dùng. |

### 10.5 Migration

`main/store/config-store.js#migrateSuperchatRoleIntoFanService()` — chạy một lần mỗi lúc app
`_load()` config.json cũ:
- Đọc `roleStyleConfig.roles.superchat` **thô** (trước normalize) để còn thấy field cũ.
- Không làm gì nếu không có legacy, legacy tắt, hoặc Fan Service `superchat.enabled` đã `true`
  sẵn (ưu tiên lựa chọn hiện tại của user).
- Ngược lại: bật `fanServiceConfig.superchat.enabled = true`, copy toàn bộ field khớp nghĩa
  (`useTierColor`, `badgeBefore/After`, `showAmount`, `amountPosition`, `amountFontWeight`,
  `amountFontSize` px → `amountFontScale` = px/16, và `authorColor`/`messageTextColor` khi
  `useTierColor === false`) — để overlay của user không đổi hình ảnh ngay sau khi cập nhật app.
- `stripStaleRoleRowDefaults()` (không liên quan Super Chat, migration riêng cho `rowBg`/
  `rowBorderColor` cũ) chạy song song, không xung đột.
- 18 theme preset: không cần migration runtime — sửa trực tiếp source code (đã xong ở Phase 2),
  vì đây là static data, không phải config của user.

### 10.6 Danh sách file đã thay đổi trong pass Final Cleanup này

- `overlay/modules/message-renderer.js` — import `quoteCssContent`/`isImageUrlValue`/
  `getBadgeImageSrc` trực tiếp từ `/shared/css-content-helpers.mjs` thay vì gián tiếp qua
  `/shared/role-style-config.mjs`; sửa 1 comment trỏ sai vị trí `getBadgeImageSrc`.
- `overlay/modules/bubble-updater.js` — cùng thay đổi import như trên.
- `shared/role-style-config.js` — xoá `quoteCssContent`/`isImageUrlValue`/`getBadgeImageSrc`
  khỏi `module.exports` (không còn ai import qua đường này); viết lại comment giải thích.
- `renderer-dashboard/src/lib/ipc.js` — thay mock `fanServiceConfig` (schema cũ, sai) bằng
  `mockGroupDefaults` khớp đúng `shared/fan-service-config.js#createGroupConfig()`.
- `docs/refactor-superchat-to-fanservice.md` — thêm mục 10 (Final Architecture) này.

**Không sửa file nào khác** — toàn bộ phần còn lại của refactor (schema, migration, renderer,
overlay CSS, dashboard UI) đã đúng từ Phase 2-3, xác nhận lại qua scan + test trong mục 10.7.

### 10.7 Final QA

| Hạng mục | Cách kiểm tra | Kết quả |
|---|---|---|
| Build | `npm run build:dashboard` | ✓ 79 modules transformed, không lỗi |
| Compile | `node --check` mọi file `.js` đã sửa | ✓ hợp lệ |
| Runtime — ESM bridge | Khởi `createSharedEsmRouter()` thật, fetch `/shared/role-style-config.mjs`, `/shared/css-content-helpers.mjs`, `/shared/fan-service-config.mjs`, kiểm tra `export {...}` sinh ra đúng danh sách export mới | ✓ đúng |
| Config migration | `smoke-test-superchat-migration.js` (5 case) | ✓ PASS |
| Renderer (Role/Appearance/Emphasis/cascade) | `smoke-test-role-style-config.js`, `smoke-test-customize-config.js`, `smoke-test-decoration-config.js`, `verify-decoration-cascade.js`, `verify-layer-split.js` | ✓ PASS |
| Overlay (Fan Service compile + cascade thật + bubble pool) | `smoke-test-fan-service-superchat.js`, `smoke-test-fan-service-cascade.js`, `smoke-test-pool-warmup.mjs`, `smoke-test-pool-dynamic.mjs`, `smoke-test-bubble-reset.mjs` | ✓ PASS |
| Theme baseline | `smoke-test-theme-baseline.js` | ✓ PASS |
| Server/socket, data model, các config khác | `smoke-test-server.js`, `smoke-test-chat-message.js`, `smoke-test-slot-style.js`, `smoke-test-danmaku-config.js`, `smoke-test-ticker-config.js` | ✓ PASS |

Toàn bộ 17/17 script `scripts/` PASS, build sạch. `smoke-test-superchat-migration.js` và
`smoke-test-theme-baseline.js` verify qua stub Electron tối thiểu như đã ghi ở mục 9.3 (giới hạn
sandbox, không phải lỗi code) — trên máy dev có Electron thật, 2 test này chạy thẳng.

### 10.8 Các vấn đề đã giải quyết (tổng hợp toàn bộ refactor, Phase 1 → Final)

1. Super Chat không còn là 1 "role" giả — nó là 1 loại **event** áp lên message, đúng bản chất
   (không phải identity cố định của người gửi).
2. Role thu gọn về đúng 2 khái niệm Identity thật (`moderator`, `member`) — không còn nhánh code
   nào biết Super Chat tồn tại.
3. Fan Service trở thành Single Source of Truth cho CẢ Super Chat lẫn Membership — cùng 1 schema
   (`createGroupConfig`), cùng 1 cơ chế compile (`compileFanServiceCss`), cùng 1 UI shell
   (`GroupEditor`) — không còn 2 hệ thống song song cho cùng 1 loại khái niệm.
4. Cascade CSS tường minh: Fan Service luôn thắng đúng lúc cần (event đang active) và nhường lại
   đúng lúc cần (event kết thúc / bubble tái sử dụng) — không có "cascade fight" ẩn giữa Role và
   Fan Service.
5. Migration tự động, không mất dữ liệu người dùng cũ khi cập nhật app.
6. (Pass Final Cleanup) Dọn nốt 3 điểm ownership/mock-schema lệch còn sót lại sau Phase 2-3 —
   không còn đường import gián tiếp/lịch sử nào giữa Role và Fan Service; mock dev-mode khớp đúng
   schema thật.

**Trạng thái: refactor Super Chat → Fan Service hoàn tất 100%.**
