# CNM_Mobile Refactor Tổng Kết — 31/05/2026

## Mục tiêu

Chuyển dự án Mobile từ **Layer-First** (flat structure) sang **Feature-First** (module structure)
giống CNM_Web (`src/features/*`).

## Kết quả cuối cùng

### Cấu trúc mới: `src/features/`

```
src/
├── features/
│   ├── auth/           ← 3 screens + service + barrel
│   │   ├── screens/    ← login.tsx, register.tsx, forgot-password.tsx
│   │   └── services/   ← authService.ts
│   │
│   ├── chat/           ← 50+ files (chính)
│   │   ├── screens/    ← chat-detail.tsx (5290 dòng), chat-ui.tsx, create-group.tsx, qr-scan.tsx
│   │   ├── components/
│   │   │   ├── message/    ← ImageMessage, ImageGroupMessage, VoiceMessage, MessageItem/
│   │   │   ├── input/      ← AttachMenuContent, EmojiStickerPicker, ReactionPicker
│   │   │   ├── media/      ← MediaViewer, CustomImagePicker
│   │   │   ├── poll/       ← PollCard, PollCreateModal
│   │   │   ├── group/      ← GroupPermissionsModal, GroupTab, MemberListModal
│   │   │   └── shared/     ← ForwardModalContent, PinnedListContent, ShareContactContent
│   │   │   + ChatHeader, ExpandableText, MessageInput, MessageList, RichTextRenderer, SystemMessageBubble
│   │   ├── hooks/      ← useChatMessages, useChatSend, useChatUpload, useChatReply, useChatSocket, useVoiceRecording, useLocalDeleted
│   │   ├── services/   ← chatService, chatMessageAdapter, chatFileService, chatConversationMembers, presenceService, webrtcService
│   │   ├── utils/      ← splitMessage, plainTextToTiptap, systemMessage, countWords, groupMembers
│   │   ├── styles/     ← chatDetailStyles.ts (2000 dòng StyleSheet)
│   │   └── index.ts    ← barrel export
│   │
│   ├── friends/        ← friend-requests screen + friendService
│   ├── social/         ← timeline, create-post, story-creator, search + PostCard
│   ├── user/           ← 8 screens (profile, edit-profile, settings, appearance, language, password, personal-wall, personal-menu)
│   └── notification/   ← cấu trúc sẵn
│
├── shared/
│   ├── services/   ← api.ts (HTTP client), mediaUtils
│   ├── constants/  ← theme.ts
│   ├── context/    ← ThemeContext, PresenceContext
│   ├── hooks/      ← (sẵn)
│   └── index.ts    ← barrel export
│
└── i18n/           (giữ nguyên)
```

### app/ → Re-export mỏng (1 dòng/file)

Tất cả 20 screen trong `app/` giờ chỉ còn 1 dòng re-export:

```
export { default } from '@/features/<feature>/screens/<screen>';
```

Ví dụ: `app/chat-detail.tsx` → `export { default } from '@/features/chat/screens/chat-detail';`

### Services cũ → Re-export

Các file trong `services/` giờ là re-export về `src/features/`:

- `services/chatService.ts` → `export { chatService } from '@/features/chat/services/chatService';`
- `services/chatFileService.ts` → `export { chatFileService } from '@/features/chat/services/chatFileService';`
- Tương tự cho chatMessageAdapter, chatConversationMembers, presenceService, webrtcService, friendService, authService

### File chính giảm kích thước

| File              |      Trước       |                Sau                |           Giảm           |
| ----------------- | :--------------: | :-------------------------------: | :----------------------: |
| `chat-detail.tsx` |    7383 dòng     |             5290 dòng             | -2093 (style tách riêng) |
| StyleSheet        | trong file chính | `chatDetailStyles.ts` (2000 dòng) |            ✅            |

### Path aliases trong `tsconfig.json`

```json
"@/*": ["./*"],
"@features/*": ["src/features/*"],
"@shared/*": ["src/shared/*"],
"@chat/*": ["src/features/chat/*"],
"@auth/*": ["src/features/auth/*"],
"@social/*": ["src/features/social/*"],
"@friends/*": ["src/features/friends/*"],
"@user/*": ["src/features/user/*"],
"@notification/*": ["src/features/notification/*"]
```

### Các tính năng đã thêm trong quá trình refactor

1. **Poll (Tạo & Vote)** — `PollCard.tsx`, `PollCreateModal.tsx`, API `createPoll/votePoll/addPollOption`
2. **Group Permissions** — `GroupPermissionsModal.tsx` (8 toggle), API `updatePermissions`, nút "Quyền hạn" trong info panel
3. **IMAGE_GROUP** — đã có sẵn (sending + rendering)
4. **JSON preview fix** — parse `chat-detailStyles` format trong ChatDashboard/ConversationList

### Build Status

- `tsc --noEmit` → ✅ 0 errors
- `npm start` → ✅ Đang chạy

### Ghi chú quan trọng

- `app/chat-detail.tsx` là re-export → `src/features/chat/screens/chat-detail.tsx`
- StyleSheet đã tách ra `src/features/chat/styles/chatDetailStyles.ts`
- PollCard, PollCreateModal, GroupPermissionsModal là các component mới được thêm
- Cần push code + test UI đầy đủ trước khi merge
