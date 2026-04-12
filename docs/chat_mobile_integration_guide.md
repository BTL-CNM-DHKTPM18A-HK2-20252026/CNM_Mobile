# Hướng Dẫn Tích Hợp Chat Mobile

## Tổng Quan

Hệ thống chat sử dụng kết hợp REST API và WebSocket để đảm bảo real-time messaging. Mobile app cần:

1. **Xác thực**: Sử dụng JWT token
2. **REST API**: Quản lý conversations và messages
3. **WebSocket**: Nhận tin nhắn real-time và trạng thái online

## 1. Xác Thực (Authentication)

### 1.1 Đăng Nhập
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "avatar": "avatar_url"
    }
  }
}
```

### 1.2 Refresh Token
```
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

**Response:** Tương tự login response

### 1.3 Lưu Token
- Lưu `accessToken` trong memory/secure storage
- Lưu `refreshToken` trong secure storage
- Tự động refresh khi access token hết hạn

## 2. Kết Nối WebSocket

### 2.1 URL Kết Nối
```
ws://localhost:8080/ws?token=<access_token>
```
hoặc HTTPS:
```
wss://your-domain.com/ws?token=<access_token>
```

### 2.2 Events Nhận

#### Kết nối thành công:
```json
{
  "type": "CONNECT_SUCCESS",
  "data": {
    "userId": "user_id",
    "sessionId": "session_id"
  }
}
```

#### Nhận tin nhắn mới:
```json
{
  "type": "MESSAGE_RECEIVED",
  "data": {
    "id": "message_id",
    "conversationId": "conversation_id",
    "senderId": "sender_id",
    "content": "message content",
    "messageType": "TEXT",
    "timestamp": "2024-01-01T10:00:00Z",
    "isRead": false,
    "attachments": []
  }
}
```

#### Trạng thái online/offline:
```json
{
  "type": "PRESENCE_UPDATE",
  "data": {
    "userId": "user_id",
    "status": "ONLINE|OFFLINE|AWAY",
    "lastSeen": "2024-01-01T10:00:00Z"
  }
}
```

#### Typing indicator:
```json
{
  "type": "TYPING_START",
  "data": {
    "conversationId": "conversation_id",
    "userId": "user_id",
    "username": "username"
  }
}
```

### 2.3 Events Gửi

#### Gửi tin nhắn:
```json
{
  "type": "SEND_MESSAGE",
  "data": {
    "conversationId": "conversation_id",
    "content": "message content",
    "messageType": "TEXT",
    "attachments": []
  }
}
```

#### Bắt đầu typing:
```json
{
  "type": "START_TYPING",
  "data": {
    "conversationId": "conversation_id"
  }
}
```

#### Dừng typing:
```json
{
  "type": "STOP_TYPING",
  "data": {
    "conversationId": "conversation_id"
  }
}
```

#### Đánh dấu đã đọc:
```json
{
  "type": "MARK_READ",
  "data": {
    "conversationId": "conversation_id",
    "messageId": "last_read_message_id"
  }
}
```

## 3. REST API Endpoints

### 3.1 Conversations

#### Lấy danh sách conversations:
```
GET /api/conversations?page=0&size=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "conversation_id",
        "type": "DIRECT|GROUP",
        "name": "Conversation Name",
        "participants": [
          {
            "id": "user_id",
            "username": "username",
            "avatar": "avatar_url",
            "status": "ONLINE"
          }
        ],
        "lastMessage": {
          "id": "message_id",
          "content": "Last message content",
          "timestamp": "2024-01-01T10:00:00Z",
          "senderId": "sender_id"
        },
        "unreadCount": 5,
        "updatedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "totalElements": 100,
    "totalPages": 5,
    "size": 20,
    "number": 0
  }
}
```

#### Tạo conversation mới:
```
POST /api/conversations
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "type": "DIRECT",
  "participantIds": ["user_id_1", "user_id_2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "new_conversation_id",
    "type": "DIRECT",
    "participants": [...],
    "createdAt": "2024-01-01T10:00:00Z"
  }
}
```

#### Lấy chi tiết conversation:
```
GET /api/conversations/{conversationId}
Authorization: Bearer <access_token>
```

### 3.2 Messages

#### Lấy tin nhắn trong conversation:
```
GET /api/conversations/{conversationId}/messages?page=0&size=50
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "message_id",
        "conversationId": "conversation_id",
        "senderId": "sender_id",
        "sender": {
          "id": "user_id",
          "username": "username",
          "avatar": "avatar_url"
        },
        "content": "Message content",
        "messageType": "TEXT|IMAGE|FILE|STICKER",
        "timestamp": "2024-01-01T10:00:00Z",
        "isRead": true,
        "readBy": ["user_id_1", "user_id_2"],
        "attachments": [
          {
            "id": "attachment_id",
            "type": "IMAGE",
            "url": "attachment_url",
            "filename": "filename.jpg",
            "size": 1024000
          }
        ],
        "reactions": [
          {
            "emoji": "👍",
            "userId": "user_id",
            "username": "username"
          }
        ]
      }
    ],
    "totalElements": 500,
    "totalPages": 10,
    "size": 50,
    "number": 0
  }
}
```

#### Gửi tin nhắn (thông qua WebSocket - preferred):
Sử dụng WebSocket event `SEND_MESSAGE`

#### Gửi tin nhắn (fallback REST):
```
POST /api/conversations/{conversationId}/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "content": "Message content",
  "messageType": "TEXT",
  "attachments": []
}
```

## 4. Upload File/Ảnh

### 4.1 Upload lên S3:
```
POST /api/upload/s3
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <file_data>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://s3-bucket-url/file.jpg",
    "key": "file_key",
    "bucket": "bucket_name"
  }
}
```

### 4.2 Gửi tin nhắn với attachment:
Sau khi upload, gửi message với `attachments` array chứa URL từ S3.

## 5. Friends/Contacts

### 5.1 Lấy danh sách bạn bè:
```
GET /api/friends?page=0&size=20
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "friend_id",
        "username": "friend_username",
        "email": "friend@example.com",
        "avatar": "avatar_url",
        "status": "ONLINE|OFFLINE|AWAY",
        "lastSeen": "2024-01-01T10:00:00Z"
      }
    ],
    "totalElements": 50
  }
}
```

### 5.2 Gửi lời mời kết bạn:
```
POST /api/friends/requests
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "receiverId": "user_id_to_add"
}
```

## 6. User Profile

### 6.1 Lấy thông tin user:
```
GET /api/users/profile
Authorization: Bearer <access_token>
```

### 6.2 Cập nhật profile:
```
PUT /api/users/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "username": "new_username",
  "avatar": "new_avatar_url",
  "status": "new_status"
}
```

## 7. Xử Lý Lỗi

### 7.1 HTTP Status Codes:
- `200`: Thành công
- `201`: Tạo thành công
- `400`: Bad Request - Dữ liệu không hợp lệ
- `401`: Unauthorized - Token không hợp lệ
- `403`: Forbidden - Không có quyền
- `404`: Not Found - Resource không tồn tại
- `409`: Conflict - Xung đột dữ liệu
- `500`: Internal Server Error

### 7.2 Error Response Format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message in Vietnamese/English",
    "details": {}
  }
}
```

### 7.3 WebSocket Errors:
```json
{
  "type": "ERROR",
  "data": {
    "code": "WS_ERROR",
    "message": "WebSocket error message"
  }
}
```

## 8. Best Practices cho Mobile

### 8.1 Connection Management:
- Tự động reconnect WebSocket khi mất kết nối
- Implement heartbeat/ping để giữ connection alive
- Handle network changes (WiFi ↔ Mobile Data)

### 8.2 Token Management:
- Refresh token trước khi hết hạn (thường 15 phút trước)
- Store tokens securely (Keychain/iOS, Keystore/Android)
- Clear tokens khi logout

### 8.3 Message Handling:
- Cache messages locally cho offline viewing
- Sync unread counts khi reconnect
- Handle message delivery status (sending, sent, delivered, read)

### 8.4 Performance:
- Pagination cho conversations và messages
- Lazy loading images/attachments
- Compress images trước khi upload

### 8.5 UI/UX:
- Show typing indicators
- Real-time presence status
- Push notifications cho messages khi app background
- Message read receipts

## 9. Testing Checklist

- [ ] Đăng nhập/đăng xuất thành công
- [ ] WebSocket kết nối và nhận messages
- [ ] Gửi text messages
- [ ] Upload và gửi images/files
- [ ] Tạo conversation mới
- [ ] Typing indicators hoạt động
- [ ] Presence status updates
- [ ] Token refresh tự động
- [ ] Error handling cho network issues
- [ ] Offline message sync khi reconnect

## 10. Environment Variables

```env
API_BASE_URL=http://localhost:8080/api
WS_BASE_URL=ws://localhost:8080/ws
S3_BUCKET_URL=https://your-s3-bucket.s3.amazonaws.com
```

---

*Tài liệu này được tạo dựa trên phân tích code backend và web client. Cập nhật khi có thay đổi trong API.*