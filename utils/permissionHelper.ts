/**
 * Permission Helper - Kiểm tra quyền hạn nhóm
 * Chỉ áp dụng cho GROUP chat, PRIVATE chat không bị ảnh hưởng
 */

export type MemberRole = 'ADMIN' | 'DEPUTY' | 'MEMBER' | null;
export type ConversationType = 'GROUP' | 'PRIVATE' | 'DIRECT' | 'SELF' | 'AI' | 'CLOUD';

export interface ConversationPermissions {
  canEditInfo?: boolean;
  canPinMessages?: boolean;
  canSendMessages?: boolean;
  isMemberApprovalRequired?: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Kiểm tra xem có phải GROUP chat không
 */
export const isGroupChat = (conversationType?: string): boolean => {
  if (!conversationType) return false;
  return String(conversationType).toUpperCase() === 'GROUP';
};

/**
 * Kiểm tra xem có phải PRIVATE chat không (chat đơn)
 */
export const isPrivateChat = (conversationType?: string): boolean => {
  if (!conversationType) return false;
  const type = String(conversationType).toUpperCase();
  return ['PRIVATE', 'DIRECT', 'ONE_TO_ONE'].includes(type);
};

/**
 * Kiểm tra xem user có phải Admin hoặc Deputy không
 */
export const isAdminOrDeputy = (userRole?: MemberRole): boolean => {
  return userRole === 'ADMIN' || userRole === 'DEPUTY';
};

/**
 * ✅ Kiểm tra quyền gửi tin nhắn (canSendMessages)
 * - PRIVATE chat: luôn cho phép
 * - GROUP chat + Admin/Deputy: luôn cho phép
 * - GROUP chat + Member: kiểm tra canSendMessages permission
 */
export const checkSendMessagePermission = (
  conversationType?: string,
  userRole?: MemberRole,
  permissions?: ConversationPermissions,
): PermissionCheckResult => {
  // PRIVATE chat: luôn cho phép
  if (isPrivateChat(conversationType)) {
    return { allowed: true };
  }

  // Không phải GROUP chat: cho phép
  if (!isGroupChat(conversationType)) {
    return { allowed: true };
  }

  // GROUP chat + Admin/Deputy: luôn cho phép
  if (isAdminOrDeputy(userRole)) {
    return { allowed: true };
  }

  // GROUP chat + Member: kiểm tra permission
  if (permissions?.canSendMessages === false) {
    return {
      allowed: false,
      reason: 'Người quản lý nhóm đã tắt tính năng gửi tin nhắn cho thành viên',
    };
  }

  return { allowed: true };
};

/**
 * ✅ Kiểm tra quyền ghim tin nhắn (canPinMessages)
 * - PRIVATE chat: luôn cho phép
 * - GROUP chat + Admin/Deputy: luôn cho phép
 * - GROUP chat + Member: kiểm tra canPinMessages permission
 */
export const checkPinMessagePermission = (
  conversationType?: string,
  userRole?: MemberRole,
  permissions?: ConversationPermissions,
): PermissionCheckResult => {
  // PRIVATE chat: luôn cho phép
  if (isPrivateChat(conversationType)) {
    return { allowed: true };
  }

  // Không phải GROUP chat: cho phép
  if (!isGroupChat(conversationType)) {
    return { allowed: true };
  }

  // GROUP chat + Admin/Deputy: luôn cho phép
  if (isAdminOrDeputy(userRole)) {
    return { allowed: true };
  }

  // GROUP chat + Member: kiểm tra permission
  if (permissions?.canPinMessages === false) {
    return {
      allowed: false,
      reason: 'Chỉ Admin hoặc Phó nhóm mới có quyền ghim tin nhắn',
    };
  }

  return { allowed: true };
};

/**
 * ✅ Kiểm tra quyền chỉnh sửa thông tin nhóm (canEditInfo)
 * - PRIVATE chat: không áp dụng
 * - GROUP chat + Admin/Deputy: luôn cho phép
 * - GROUP chat + Member: kiểm tra canEditInfo permission
 */
export const checkEditGroupInfoPermission = (
  conversationType?: string,
  userRole?: MemberRole,
  permissions?: ConversationPermissions,
): PermissionCheckResult => {
  // Không phải GROUP chat: không áp dụng
  if (!isGroupChat(conversationType)) {
    return { allowed: false, reason: 'Chỉ áp dụng cho nhóm chat' };
  }

  // GROUP chat + Admin/Deputy: luôn cho phép
  if (isAdminOrDeputy(userRole)) {
    return { allowed: true };
  }

  // GROUP chat + Member: kiểm tra permission
  if (permissions?.canEditInfo === false) {
    return {
      allowed: false,
      reason: 'Chỉ Admin hoặc Phó nhóm mới có quyền cập nhật thông tin nhóm',
    };
  }

  return { allowed: true };
};

/**
 * ✅ Kiểm tra quyền thêm thành viên (isMemberApprovalRequired)
 * - PRIVATE chat: không áp dụng
 * - GROUP chat + Admin/Deputy: luôn cho phép
 * - GROUP chat + Member + isMemberApprovalRequired=true: không cho phép
 * - GROUP chat + Member + isMemberApprovalRequired=false: cho phép
 */
export const checkAddMembersPermission = (
  conversationType?: string,
  userRole?: MemberRole,
  permissions?: ConversationPermissions,
): PermissionCheckResult => {
  // Không phải GROUP chat: không áp dụng
  if (!isGroupChat(conversationType)) {
    return { allowed: false, reason: 'Chỉ áp dụng cho nhóm chat' };
  }

  // GROUP chat + Admin/Deputy: luôn cho phép
  if (isAdminOrDeputy(userRole)) {
    return { allowed: true };
  }

  // GROUP chat + Member: kiểm tra isMemberApprovalRequired
  if (permissions?.isMemberApprovalRequired === true) {
    return {
      allowed: false,
      reason: 'Chỉ Admin hoặc Phó nhóm mới có quyền thêm thành viên',
    };
  }

  return { allowed: true };
};
