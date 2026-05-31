# Kế hoạch Port Feature từ CNM_Web → CNM_Mobile

> Ngày: 31/05/2026
> Mục tiêu: Đối chiếu feature gap và lập lộ trình đưa các chức năng từ Web sang Mobile

---

## ✅ Mobile đã có (không cần port)

### Chat

| Feature                   | Mobile | Ghi chú                                                   |
| ------------------------- | ------ | --------------------------------------------------------- |
| Gửi TEXT                  | ✅     | `chat-ui.tsx`, `MessageInput.tsx`                         |
| Gửi IMAGE                 | ✅     | `CustomImagePicker.tsx`, `AttachMenuContent.tsx`          |
| Gửi VIDEO                 | ✅     | `CustomImagePicker.tsx`                                   |
| Gửi MEDIA (file)          | ✅     | `chatFileService.ts`                                      |
| Gửi VOICE                 | ✅     | Thu âm + `VoicePlayer` trong `MessageItem`                |
| Gửi STICKER/EMOJI         | ✅     | `EmojiStickerPicker.tsx`, `ReactionPicker.tsx`            |
| Reactions                 | ✅     | `reactToMessage()` trong `chatService.ts`                 |
| Pin/Unpin messages        | ✅     | `pinMessage()`, `unpinMessage()`, `PinnedListContent.tsx` |
| Recall message            | ✅     | `recallMessage()`                                         |
| Delete message            | ✅     | `deleteMessageLocal()`                                    |
| Forward message           | ✅     | `ForwardModalContent.tsx`                                 |
| Reply message             | ✅     | Có reply UI                                               |
| Read receipts             | ✅     | Xử lý qua WebSocket                                       |
| Share Contact             | ✅     | `ShareContactContent.tsx`                                 |
| System messages           | ✅     | `SystemMessageBubble.tsx`                                 |
| Typing indicator          | ✅     | via WebSocket                                             |
| Self chat                 | ✅     | `ensureSelfConversation()`                                |
| AI Chat                   | ✅     | `ensureAiConversation()`                                  |
| Create Group              | ✅     | `create-group.tsx`, `createGroupConversation()`           |
| Group members             | ✅     | `MemberListModal.tsx`                                     |
| Media viewer (fullscreen) | ✅     | `MediaViewer.tsx`                                         |
| Rich text render          | ✅     | `RichTextRenderer.tsx`                                    |
| Message search            | ✅     | `search.tsx`                                              |

### Auth & Profile

| Feature         | Mobile | Ghi chú                                                          |
| --------------- | ------ | ---------------------------------------------------------------- |
| Login           | ✅     | `login.tsx`                                                      |
| Register        | ✅     | `register.tsx`                                                   |
| Forgot password | ✅     | `forgot-password.tsx`                                            |
| Edit profile    | ✅     | `edit-profile.tsx`                                               |
| Settings        | ✅     | `settings.tsx`, `appearance.tsx`, `language.tsx`, `password.tsx` |
| Personal wall   | ✅     | `personal-wall.tsx`                                              |
| Personal menu   | ✅     | `personal-menu.tsx`                                              |
| QR scan         | ✅     | `qr-scan.tsx`                                                    |
| Profile view    | ✅     | `profile.tsx`                                                    |

### Social

| Feature         | Mobile | Ghi chú               |
| --------------- | ------ | --------------------- |
| Timeline (feed) | ✅     | `(tabs)/timeline.tsx` |
| Create post     | ✅     | `create-post.tsx`     |
| Story creator   | ✅     | `story-creator.tsx`   |
| Friend requests | ✅     | `friend-requests.tsx` |
| Contacts        | ✅     | `(tabs)/contacts.tsx` |
| Explore         | ✅     | `(tabs)/explore.tsx`  |
| User profile    | ✅     | Có profile view       |

### Real-time

| Feature     | Mobile | Ghi chú                               |
| ----------- | ------ | ------------------------------------- |
| WebSocket   | ✅     | Kết nối STOMP                         |
| Presence    | ✅     | `presenceService.ts`                  |
| WebRTC call | ✅     | `webrtcService.ts`, `CallOverlay.tsx` |

---

## ❌ Mobile chưa có (cần port từ Web)

### Chat - Mức độ ƯU TIÊN CAO

| #   | Feature                         |                                Web (CNM_Web)                                 |                                                        Mobile (CNM_Mobile)                                                         | Độ ưu tiên |
| --- | ------------------------------- | :--------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------: | :--------: |
| 1   | **IMAGE_GROUP (gửi nhiều ảnh)** |          `useChatWindow.ts` → `handleImagesSubmit()` tạo album grid          |                                                      Mobile chỉ gửi 1 ảnh/lần                                                      | 🔥 **Cao** |
| 2   | **Poll (Tạo & Vote)**           |        `CreatePollModal.tsx`, `PollCard` trong `ChatMessageList.tsx`         |                                                           ❌ Không có gì                                                           | 🔥 **Cao** |
| 3   | **Pinned message list sidebar** |               `ChatInfoSidebar.tsx` — danh sách ghim ở sidebar               |                                      Chỉ có `PinnedListContent.tsx` cơ bản, thiếu UI quản lý                                       | 🔥 **Cao** |
| 4   | **Group permissions**           |   `ChatInfoSidebar.tsx` — 8 permission toggle (editInfo, pin, poll, etc.)    |                                                            ❌ Không có                                                             | 🔥 **Cao** |
| 5   | **Call history**                |        `ChatMessageList.tsx` → `CallHistoryMessage`, `GroupCallCard`         |                                                  ❌ Không render lịch sử cuộc gọi                                                  | 🔥 **Cao** |
| 6   | **Link preview**                |      `LinkPreview`, `GroupJoinLinkPreview` trong `ChatMessageList.tsx`       |                                                 ❌ Không render link preview card                                                  | 🔥 **Cao** |
| 7   | **Message edit inline**         |                  `ChatMessageList.tsx` → inline edit input                   |                                                            ❌ Không có                                                             | 🔥 **Cao** |
| 8   | **Conversation list sidebar**   | `ChatDashboardLegacy.tsx` — nhóm messages, badge unread, tìm kiếm, phân loại | Mobile có conversation list trong `(tabs)/chat.tsx` nhưng thiếu feature: pin đầu danh sách, search trong list, group cloud/AI tags |   Medium   |

### Chat - Mức độ TRUNG BÌNH

| #   | Feature                       |              Web (CNM_Web)               | Mobile (CNM_Mobile) | Độ ưu tiên |
| --- | ----------------------------- | :--------------------------------------: | :-----------------: | :--------: |
| 9   | **Story reply**               |        Gửi storyId trong message         |     ❌ Không có     | Trung bình |
| 10  | **Mention (@user) dropdown**  | `MentionDropdown.tsx` trong ChatComposer |     ❌ Không có     | Trung bình |
| 11  | **GIF picker**                |         StickerPicker có tab GIF         |     ❌ Không có     | Trung bình |
| 12  | **Image caption**             |           Gửi caption kèm ảnh            |     ❌ Không có     | Trung bình |
| 13  | **Formatting toolbar**        |    `ChatInput` có format bold/italic     |  ❌ Chỉ text thuần  | Trung bình |
| 14  | **Voice/video call in group** |             `GroupCallCard`              |   ❌ Chỉ call P2P   | Trung bình |

### Chat - Mức độ THẤP

| #   | Feature                          |            Web (CNM_Web)             | Mobile (CNM_Mobile) | Độ ưu tiên |
| --- | -------------------------------- | :----------------------------------: | :-----------------: | :--------: |
| 15  | **Conversation tags**            | Tag cloud/AI trong conversation list |     ❌ Không có     |    Thấp    |
| 16  | **Mark conversations as unread** |     Tính năng trong menu context     |     ❌ Không có     |    Thấp    |
| 17  | **Auto-delete messages**         |     Cài đặt auto-delete duration     |     ❌ Không có     |    Thấp    |
| 18  | **Conversation search**          |    Search trong conversation list    |     ❌ Không có     |    Thấp    |
| 19  | **Nickname management**          |       Đặt biệt danh cho member       |     ❌ Không có     |    Thấp    |

### Auth - Mức độ THẤP

| #   | Feature                |                  Web                  |   Mobile    | Độ ưu tiên |
| --- | ---------------------- | :-----------------------------------: | :---------: | :--------: |
| 20  | **Gmail OAuth2 login** |           Login bằng Google           | ❌ Không có |    Thấp    |
| 21  | **Gmail modal**        | `GmailModal.tsx` — yêu cầu nhập email | ❌ Không có |    Thấp    |

### User & Settings - Mức độ TRUNG BÌNH

| #   | Feature                              |                          Web                          |                  Mobile                  | Độ ưu tiên |
| --- | ------------------------------------ | :---------------------------------------------------: | :--------------------------------------: | :--------: |
| 22  | **Storage management**               | `StorageService` → hiển thị dung lượng ảnh/video/file |               ❌ Không có                | Trung bình |
| 23  | **Privacy settings**                 |               Privacy level, block list               |               ❌ Không có                | Trung bình |
| 24  | **Notification settings**            |         Tắt/mở notification theo conversation         |             ❌ Chưa thấy UI              | Trung bình |
| 25  | **Account settings (PIN, password)** |               Web có PIN code settings                | Mobile có `password.tsx` nhưng thiếu PIN | Trung bình |

### Social - Mức độ TRUNG BÌNH

| #   | Feature          |              Web               |   Mobile    | Độ ưu tiên |
| --- | ---------------- | :----------------------------: | :---------: | :--------: |
| 26  | **Video feed**   | `VideoFeed.tsx` — TikTok-style | ❌ Không có | Trung bình |
| 27  | **Post edit**    |         Edit bài viết          | ❌ Không có | Trung bình |
| 28  | **Post report**  |        Report bài viết         | ❌ Không có | Trung bình |
| 29  | **Post archive** |      `SocialArchive.tsx`       | ❌ Không có |    Thấp    |
| 30  | **My activity**  |        `MyActivity.tsx`        | ❌ Không có |    Thấp    |

---

## 📋 Lộ trình Port (Theo thứ tự ưu tiên)

### Phase 1 — 🔥 Ngay lập tức (1-2 ngày)

| #   | Feature           | File cần port từ Web                                            | File đích trên Mobile                                 |
| --- | ----------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Poll (Tạo & Vote) | `CreatePollModal.tsx`, `ChatMessageList.tsx:150-440` (PollCard) | Tạo mới: `app/poll-create.tsx`, sửa `chat-detail.tsx` |
| 2   | IMAGE_GROUP       | `useChatWindow.ts` → `handleImagesSubmit()`                     | Sửa `CustomImagePicker.tsx` + `chatService.ts`        |
| 3   | Group Permissions | `ChatInfoSidebar.tsx` → permission toggle                       | Sửa `GroupTab.tsx`, thêm API                          |

### Phase 2 — 📱 Trong tuần (3-5 ngày)

| #   | Feature                                                     |
| --- | ----------------------------------------------------------- |
| 4   | Call history render (`CallHistoryMessage`, `GroupCallCard`) |
| 5   | Link preview + Group join link card                         |
| 6   | Message edit inline                                         |
| 7   | Pinned message list quản lý                                 |
| 8   | GIF picker                                                  |
| 9   | Mention @user                                               |

### Phase 3 — 🎯 Hoàn thiện (1-2 tuần)

| #   | Feature                                |
| --- | -------------------------------------- |
| 10  | Storage management UI                  |
| 11  | Privacy settings                       |
| 12  | Video feed (tương tự TikTok)           |
| 13  | Gmail OAuth2 login                     |
| 14  | Group call support                     |
| 15  | Notification settings per conversation |
| 16  | Account PIN settings                   |

---

## 📊 Tổng quan

| Loại                      |    Số lượng     |
| ------------------------- | :-------------: |
| ✅ Mobile đã có           |  ~35 features   |
| ❌ Cần port (ưu tiên cao) |   8 features    |
| ❌ Cần port (trung bình)  |   13 features   |
| ❌ Cần port (thấp)        |   9 features    |
| **Tổng cần port**         | **30 features** |
