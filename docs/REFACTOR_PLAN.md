# Kế hoạch Tái cấu trúc (Refactor) CNM_Mobile: Layer-First → Feature-First

> **Ngày:** 31/05/2026
> **Trạng thái:** 🟢 Phase 1-3 hoàn tất | 🟡 Phase 4 chưa làm
> **Mục tiêu:** Chuyển từ cấu trúc Layer-First (theo loại file) sang Feature-First (theo tính năng)
> **Tham khảo:** CNM_Web (`src/features/*`) đã áp dụng Feature-First thành công

---

## ✅ PHASE 1-3: HOÀN TẤT (31/05/2026)

### Cấu trúc mới đã tạo

```
src/
├── features/
│   ├── chat/           ← 25+ components (message/input/media/poll/group/shared)
│   │   ├── hooks/      ← 7 hooks (useChatMessages, useChatSend, useChatUpload, ...)
│   │   ├── services/   ← 6 services (chatService, chatFileService, ...)
│   │   ├── utils/      ← 5 utils (splitMessage, plainTextToTiptap, ...)
│   │   ├── types/
│   │   ├── styles/
│   │   └── index.ts    ← barrel export
│   ├── auth/           ← authService
│   ├── friends/        ← friendService
│   ├── social/         ← PostCard
│   ├── user/           ← (ready)
│   └── notification/   ← (ready)
├── shared/
│   ├── services/       ← api.ts, mediaUtils
│   ├── constants/      ← theme
│   ├── context/        ← ThemeContext, PresenceContext
│   └── ...
└── i18n/               (unchanged)
```

### File cũ vẫn giữ ở gốc

- `app/chat-detail.tsx` (7383 dòng) — **chưa tách**, vẫn là monolith
- `services/`, `hooks/`, `components/`, `utils/` — giữ lại để tương thích ngược
- `tsc --noEmit` → **0 errors** ✅

## 1. ĐÁNH GIÁ HIỆN TRẠNG (Audit)

### 1.1 Cấu trúc hiện tại (Layer-First)

```
CNM_Mobile/
├── app/               # 📍 7383 dòng = MONOLITH!
│   ├── chat-detail.tsx    ← 7383 dòng - FILE NGUY HIỂM NHẤT
│   ├── chat-ui.tsx        ← 301 dòng - có thể gộp/sắp xếp lại
│   ├── login.tsx, register.tsx, ...
│   └── (tabs)/            ← Navigation
├── components/         # 📍 13 chat components + common + post
│   ├── chat/              ← Đã grouping theo feature (tốt)
│   ├── common/
│   ├── post/
│   └── GroupTab.tsx
├── hooks/              # 📍 5 hooks toàn cục
├── services/           # 📍 10 services toàn cục
├── utils/              # 📍 chat/ + group/
├── constants/          # 📍 theme
├── context/            # 📍 Theme, Presence
├── types/              # 📍 Định nghĩa type
├── i18n/               # 📍 Đa ngôn ngữ
└── docs/               # 📍 Tài liệu
```

### 1.2 Các file "quá khổ" (Monoliths)

| File                                    |   Dòng    | Vấn đề                                                                                                                                        |
| --------------------------------------- | :-------: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **`app/chat-detail.tsx`**               | **7.383** | ⛔ **NGUY HIỂM NHẤT**: Gồm chat logic, rendering, upload, WebSocket, modals, voice, contacts, groups, AI, settings — **MỌI THỨ** trong 1 file |
| `app/chat.tsx` (tabs)                   |    887    | ❌ Lớn – chat list screen nên được tách                                                                                                       |
| `app/register.tsx`                      |    828    | ❌ Lớn – form đăng ký quá dài                                                                                                                 |
| `app/personal-wall.tsx`                 |    802    | ❌ Lớn                                                                                                                                        |
| `components/chat/CustomImagePicker.tsx` |    665    | ❌ Lớn                                                                                                                                        |
| `app/search.tsx`                        |    563    | ⚠️ Trung bình                                                                                                                                 |
| `components/GroupTab.tsx`               |    464    | ⚠️ Nên tách                                                                                                                                   |
| `hooks/useChatSocket.ts`                |    396    | ⚠️ Trung bình                                                                                                                                 |
| `services/chatService.ts`               |    320    | ⚠️ Đã khá lớn                                                                                                                                 |

### 1.3 Các vấn đề nghiêm trọng

#### 🔴 Vấn đề A: `app/chat-detail.tsx` – 7.383 dòng chứa tất cả

File này bao gồm **MỌI CHỨC NĂNG CHAT**:

- Kết nối WebSocket & xử lý realtime
- Gửi TEXT, IMAGE, VIDEO, FILE, VOICE, CONTACT
- Upload lên S3 với progress bar
- **Poll** (tạo, vote) – vừa thêm
- **Group permissions** – vừa thêm
- Pinned messages, reactions, reply, forward, recall, edit
- Voice recording & playback
- Media gallery & fullscreen viewer
- **Group info panel** (edit name, avatar, members, permissions)
- **AI Chat** section
- Search messages
- Friend request notice
- **Inline styles** via StyleSheet.create() - 500+ lines

#### 🔴 Vấn đề B: Tight Coupling

- `chat-detail.tsx` import từ **15 components + 10 services + 6 hooks + 4 utils + 5 context/constants**
- Mỗi callback (`useCallback`) trong file này phụ thuộc vào hàng chục state khác
- Các component con (`MessageItem`, `MessageList`, `ChatHeader`) nhận `any` props (`export type MessageListProps = any`)

#### 🟡 Vấn đề C: Đặt sai vị trí

- `components/GroupTab.tsx` – là **screen-level component**, không phải shared component
- `hooks/` – chứa cả hook chat + hook voice + hook local deleted → nên chia theo feature
- `services/chatService.ts` – 320 dòng, nên tách thành từng service nhỏ theo domain
- `components/chat/*` – đã grouping tốt nhưng chưa có cấu trúc feature rõ ràng

---

## 2. KIẾN TRÚC MỤC TIÊU (Feature-First)

### 2.1 Cấu trúc đích

```
CNM_Mobile/
├── src/
│   ├── features/               # 📁 Tính năng
│   │   ├── auth/               # Login, Register, Forgot Password, OAuth2
│   │   │   ├── screens/        # login.tsx, register.tsx, forgot-password.tsx
│   │   │   ├── components/     # LoginForm.tsx, GmailModal.tsx
│   │   │   ├── hooks/          # useAuth.ts
│   │   │   ├── services/       # authService.ts
│   │   │   └── types/          # auth.types.ts
│   │   │
│   │   ├── chat/               # 💎 CHAT - QUAN TRỌNG NHẤT
│   │   │   ├── screens/        # chat-detail.tsx ← TÁCH NHỎ!
│   │   │   │   ├── ChatDetailScreen.tsx  (orchestrator, ~500 dòng)
│   │   │   │   ├── ChatListScreen.tsx    (từ app/chat-ui.tsx)
│   │   │   │   └── ConversationList.tsx  (từ app/chat.tsx tabs)
│   │   │   ├── components/     # Tất cả components chat từ components/chat/
│   │   │   │   ├── message/    # MessageItem, MessageList, RichTextRenderer
│   │   │   │   ├── input/      # ChatInput, AttachMenu, EmojiStickerPicker
│   │   │   │   ├── media/      # MediaViewer, ImagePicker, VoicePlayer
│   │   │   │   ├── poll/       # PollCard, PollCreateModal
│   │   │   │   ├── group/      # GroupTab, GroupPermissionsModal, MemberListModal
│   │   │   │   └── shared/     # ForwardModal, PinnedList, ShareContact
│   │   │   ├── hooks/          # useChatSocket, useVoiceRecording, useLocalDeleted
│   │   │   ├── services/       # chatService.ts, chatFileService, chatMessageAdapter
│   │   │   ├── utils/          # splitMessage, plainTextToTiptap, systemMessage
│   │   │   └── types/          # chat.types.ts
│   │   │
│   │   ├── social/             # Timeline, Posts, Stories
│   │   │   ├── screens/        # timeline, create-post, story-creator
│   │   │   ├── components/     # PostCard, CommentModal
│   │   │   ├── services/       # Từ services/ (nếu có)
│   │   │   └── types/
│   │   │
│   │   ├── friends/            # Bạn bè, kết bạn
│   │   │   ├── screens/        # friend-requests, contacts
│   │   │   ├── components/
│   │   │   ├── services/       # friendService.ts
│   │   │   └── types/
│   │   │
│   │   ├── user/               # Profile, Settings
│   │   │   ├── screens/        # profile, edit-profile, settings
│   │   │   ├── components/
│   │   │   ├── services/
│   │   │   └── types/
│   │   │
│   │   └── notification/       # Thông báo
│   │       ├── screens/
│   │       ├── components/
│   │       └── services/
│   │
│   ├── shared/                 # 📁 Dùng chung
│   │   ├── ui/                 # Button, Icon, Avatar, Modal (common components)
│   │   ├── hooks/              # useTheme, usePresence (global hooks)
│   │   ├── services/           # api.ts (HTTP client), mediaUtils
│   │   ├── utils/              # countWords, groupMembers (non-feature utils)
│   │   ├── constants/          # colors, theme
│   │   ├── context/            # ThemeContext, PresenceContext
│   │   └── types/              # Global types
│   │
│   └── i18n/                   # Đa ngôn ngữ (giữ nguyên)
│
├── app/                        # 📁 Navigation (Expo Router)
│   └── (tabs)/ + screens → import từ src/features/
│
└── ...
```

### 2.2 Nguyên tắc tách

| Nguyên tắc                                 | Mô tả                                                               |
| ------------------------------------------ | ------------------------------------------------------------------- |
| **1 Feature = 1 folder**                   | Mọi code liên quan đến feature đó đều trong 1 folder                |
| **Screen không chứa logic**                | Screen chỉ là orchestrator, gọi hooks/services                      |
| **Shared ≠ Feature**                       | Code dùng chung nhiều feature → `shared/`, code riêng → `features/` |
| **Component không import từ feature khác** | Nếu A import B từ feature khác → B nên lên shared/                  |

---

## 3. LỘ TRÌNH REFACTOR (Step-by-Step)

### 🟢 Phase 1: Chuẩn bị (Day 1) — KHÔNG thay đổi logic

| Bước    | Mô tả                                                              | File ảnh hưởng  |
| ------- | ------------------------------------------------------------------ | --------------- |
| **1.1** | Tạo cấu trúc thư mục đích `src/features/*`, `src/shared/*`         | Chưa có         |
| **1.2** | Cấu hình path alias `@features/`, `@shared/` trong `tsconfig.json` | `tsconfig.json` |
| **1.3** | Kiểm tra TypeScript vẫn build OK sau khi thêm alias                | `tsc --noEmit`  |
| **1.4** | Viết script kiểm tra (smoke test) để verify app chạy sau mỗi phase | CI/CD           |

### 🟡 Phase 2: Tách Monolith `chat-detail.tsx` (Day 2-4) — QUAN TRỌNG NHẤT

**Chiến lược:** Không tách 1 lần → chia làm 4 bước nhỏ, mỗi bước có thể deploy riêng.

#### Bước 2.1: Tách Hooks ra khỏi chat-detail (Day 2)

| File mới                                     | Nội dung                                            | Dòng giảm |
| -------------------------------------------- | --------------------------------------------------- | :-------: |
| `src/features/chat/hooks/useChatMessages.ts` | State messages + fetch + pagination                 | ~400 dòng |
| `src/features/chat/hooks/useChatSend.ts`     | `sendMessage`, `handleSendMedia`, `handlePickImage` | ~500 dòng |
| `src/features/chat/hooks/useChatUpload.ts`   | S3 upload, progress tracking                        | ~200 dòng |
| `src/features/chat/hooks/useChatReply.ts`    | Reply, forward state                                | ~150 dòng |

`chat-detail.tsx` sau bước 2.1: **~5.500 dòng** (giảm ~1.800)

#### Bước 2.2: Tách Modals & Panels (Day 3)

| File mới                                     | Nội dung                                              | Dòng giảm |
| -------------------------------------------- | ----------------------------------------------------- | :-------: |
| `src/features/chat/screens/InfoPanel.tsx`    | Group info panel (name, avatar, members, permissions) | ~500 dòng |
| `src/features/chat/screens/MediaGallery.tsx` | Media gallery with fullscreen                         | ~400 dòng |
| `src/features/chat/screens/SearchPanel.tsx`  | Message search UI                                     | ~200 dòng |

`chat-detail.tsx` sau bước 2.2: **~4.400 dòng** (giảm ~1.100)

#### Bước 2.3: Tách Message Rendering (Day 3-4)

| File mới                                                       | Nội dung                 | Dòng giảm |
| -------------------------------------------------------------- | ------------------------ | :-------: |
| `src/features/chat/components/message/TextMessage.tsx`         | Rich text rendering      | ~50 dòng  |
| `src/features/chat/components/message/ImageMessage.tsx`        | Single image + caption   | ~80 dòng  |
| `src/features/chat/components/message/ImageGroupMessage.tsx`   | Grid layout + Zalo-style | ~150 dòng |
| `src/features/chat/components/message/VideoMessage.tsx`        | Video player             | ~80 dòng  |
| `src/features/chat/components/message/VoiceMessage.tsx`        | Voice player             | ~80 dòng  |
| `src/features/chat/components/message/FileMessage.tsx`         | File bubble              | ~80 dòng  |
| `src/features/chat/components/message/ShareContactMessage.tsx` | Contact card             | ~80 dòng  |

`chat-detail.tsx` sau bước 2.3: **~3.500 dòng** (giảm ~900)

#### Bước 2.4: Tách Render Functions & Styles (Day 4)

| File mới                                         | Nội dung                                  | Dòng giảm |
| ------------------------------------------------ | ----------------------------------------- | :-------: |
| `src/features/chat/screens/ChatDetailScreen.tsx` | Screen orchestrator (giữ lại)             | ~500 dòng |
| `src/features/chat/styles/chat-detail.styles.ts` | Tất cả StyleSheet.create                  | ~500 dòng |
| `src/features/chat/utils/renderUtils.ts`         | Helper functions (getFileIconColor, etc.) | ~100 dòng |

`chat-detail.tsx` sau bước 2.4: **~2.500 dòng** ✅ **Giảm từ 7.383 → 2.500**

### 🟠 Phase 3: Di chuyển các thành phần còn lại (Day 5-7)

| Bước     | Từ                                   | Đến                                                |
| -------- | ------------------------------------ | -------------------------------------------------- |
| **3.1**  | `services/authService.ts` (422 dòng) | `src/features/auth/services/authService.ts`        |
| **3.2**  | `services/friendService.ts`          | `src/features/friends/services/friendService.ts`   |
| **3.3**  | `services/chatService.ts` (320 dòng) | `src/features/chat/services/chatService.ts`        |
| **3.4**  | `services/chatFileService.ts`        | `src/features/chat/services/chatFileService.ts`    |
| **3.5**  | `services/chatMessageAdapter.ts`     | `src/features/chat/services/chatMessageAdapter.ts` |
| **3.6**  | `services/presenceService.ts`        | `src/features/chat/services/presenceService.ts`    |
| **3.7**  | `services/webrtcService.ts`          | `src/features/chat/services/webrtcService.ts`      |
| **3.8**  | `hooks/useChatSocket.ts` (396 dòng)  | `src/features/chat/hooks/useChatSocket.ts`         |
| **3.9**  | `hooks/useVoiceRecording.ts`         | `src/features/chat/hooks/useVoiceRecording.ts`     |
| **3.10** | `hooks/useLocalDeleted.ts`           | `src/features/chat/hooks/useLocalDeleted.ts`       |
| **3.11** | `utils/chat/*`                       | `src/features/chat/utils/*`                        |
| **3.12** | `utils/group/groupMembers.ts`        | `src/features/chat/utils/groupMembers.ts`          |
| **3.13** | `components/chat/*`                  | `src/features/chat/components/*`                   |
| **3.14** | `components/GroupTab.tsx`            | `src/features/chat/components/group/GroupTab.tsx`  |
| **3.15** | `components/post/PostCard.tsx`       | `src/features/social/components/PostCard.tsx`      |

### 🔴 Phase 4: Cleanup & Test (Day 8-9)

| Bước    | Mô tả                                                            |
| ------- | ---------------------------------------------------------------- |
| **4.1** | Xóa các file cũ ở root (sau khi xác nhận import mới hoạt động)   |
| **4.2** | Import alias: đổi `@/components/chat/...` → `@features/chat/...` |
| **4.3** | Kiểm tra toàn bộ luồng chat (gửi/nhận/upload)                    |
| **4.4** | Kiểm tra toàn bộ navigation                                      |
| **4.5** | Chạy full TypeScript check: `npx tsc --noEmit`                   |

---

## 4. VÍ DỤ MINH HỌA: Tách `chat-detail.tsx`

### 4.1 File mới: `src/features/chat/hooks/useChatUpload.ts`

```typescript
// Chỉ xử lý upload media lên S3
export function useChatUpload(conversationId: string) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrentIndex, setUploadCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadToS3 = useCallback(
    async (media: PickedMedia): Promise<string> => {
      // Logic upload
      return chatFileService.uploadMedia(media, (p) =>
        setUploadProgress(p.percent),
      );
    },
    [],
  );

  const uploadMultipleToS3 = useCallback(
    async (items: PickedMedia[]): Promise<string[]> => {
      setIsUploading(true);
      const urls: string[] = [];
      for (let i = 0; i < items.length; i++) {
        setUploadCurrentIndex(i);
        urls.push(await uploadToS3(items[i]));
      }
      setIsUploading(false);
      return urls;
    },
    [uploadToS3],
  );

  return {
    uploadProgress,
    uploadCurrentIndex,
    isUploading,
    uploadMultipleToS3,
    reset: () => {
      setUploadProgress(0);
      setUploadCurrentIndex(0);
      setIsUploading(false);
    },
  };
}
```

### 4.2 File mới: `src/features/chat/screens/ChatDetailScreen.tsx` (giảm còn ~500 dòng)

```typescript
export default function ChatDetailScreen() {
  // Chỉ còn orchestration
  const { conversationId, ... } = useChatInit();
  const { messages, ... } = useChatMessages(conversationId);
  const { sendText, ... } = useChatSend(conversationId);
  const { uploadProgress, ... } = useChatUpload(conversationId);
  const { replyTo, ... } = useChatReply();

  // Render
  return (
    <SafeAreaView>
      <ChatHeader ... />
      <MessageList messages={messages} ... />
      <MessageInput ... />
      <PollCreateModal ... />
      <GroupPermissionsModal ... />
    </SafeAreaView>
  );
}
```

### 4.3 File mới: `src/features/chat/services/chatService.ts` (tách thành domain)

```typescript
// chatService.ts → chia nhỏ:
// - chatMessageService.ts   (send, edit, recall, react)
// - chatConversationService.ts (getConversations, create, members)
// - chatMediaService.ts     (upload, presigned-url)
// - chatPollService.ts      (createPoll, votePoll)
// - chatPermissionService.ts (updatePermissions)
```

---

## 5. TỔNG QUAN TÁC ĐỘNG

| Chỉ số             |                 Hiện tại                  |                 Sau Refactor                  |
| ------------------ | :---------------------------------------: | :-------------------------------------------: |
| **File lớn nhất**  |      7.383 dòng (`chat-detail.tsx`)       |              ~500 dòng mỗi file               |
| **Cấu trúc**       |            Layer-First (flat)             |            Feature-First (module)             |
| **Số thư mục**     |              ~8 thư mục gốc               |     ~10 thư mục gốc + ~30 feature folders     |
| **Path alias**     |                `@/` (root)                |        `@/`, `@features/`, `@shared/`         |
| **Tight coupling** | `chat-detail.tsx` import 30+ dependencies |   Mỗi hook/service import 2-5 dependencies    |
| **Bảo trì**        |        Sợ sửa file chat-detail.tsx        | Sửa từng module riêng biệt không sợ ảnh hưởng |
