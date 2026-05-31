import { useState } from 'react';
import type { ChatUiMessage } from '@/services/chatMessageAdapter';

interface UseChatReplyReturn {
  replyingTo: ChatUiMessage | null;
  setReplyingTo: React.Dispatch<React.SetStateAction<ChatUiMessage | null>>;
  forwardingMsg: ChatUiMessage | null;
  setForwardingMsg: React.Dispatch<React.SetStateAction<ChatUiMessage | null>>;
  clearReply: () => void;
  clearForward: () => void;
}

export function useChatReply(): UseChatReplyReturn {
  const [replyingTo, setReplyingTo] = useState<ChatUiMessage | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<ChatUiMessage | null>(null);

  const clearReply = () => setReplyingTo(null);
  const clearForward = () => setForwardingMsg(null);

  return {
    replyingTo,
    setReplyingTo,
    forwardingMsg,
    setForwardingMsg,
    clearReply,
    clearForward,
  };
}
