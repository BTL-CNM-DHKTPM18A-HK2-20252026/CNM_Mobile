// ── Chat Feature: Barrel Export ──────────────────────────────────────────
// Auto-generated during refactoring. Re-export all chat modules.

// Hooks
export { useChatMessages } from './hooks/useChatMessages';
export { useChatSend } from './hooks/useChatSend';
export { useChatUpload } from './hooks/useChatUpload';
export { useChatReply } from './hooks/useChatReply';
export { useChatSocket } from './hooks/useChatSocket';
export { useVoiceRecording } from './hooks/useVoiceRecording';
export { useLocalDeleted } from './hooks/useLocalDeleted';

// Services
export { chatService } from './services/chatService';
export { chatFileService, type PickedMedia } from './services/chatFileService';
export { mapChatPayloadToUiMessage, mapChatPayloadListToUiMessages, type ChatUiMessage, type ChatUiReaction } from './services/chatMessageAdapter';
export { fetchConversationMembers } from './services/chatConversationMembers';
export { webrtcService } from './services/webrtcService';

// Message Components
export { ImageMessage } from './components/message/ImageMessage';
export { ImageGroupMessage } from './components/message/ImageGroupMessage';
export { VoiceMessage } from './components/message/VoiceMessage';

// Input Components
export { AttachMenuContent } from './components/input/AttachMenuContent';
export { ReactionPicker } from './components/input/ReactionPicker';

// Poll Components
export { default as PollCard } from './components/poll/PollCard';
export { default as PollCreateModal } from './components/poll/PollCreateModal';

// Group Components
export { default as GroupPermissionsModal } from './components/group/GroupPermissionsModal';

// Shared Components
export { ForwardModalContent } from './components/shared/ForwardModalContent';
export { PinnedListContent } from './components/shared/PinnedListContent';
export { ShareContactContent } from './components/shared/ShareContactContent';

// Legacy (to be removed after full migration)
export { MessageList } from './components/MessageList';
export { MessageItem } from './components/message/MessageItem';
export { ChatHeader } from './components/ChatHeader';
