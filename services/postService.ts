import api from './api';

export interface CreatePostRequest {
  content?: string;
  location?: string;
  mediaIds?: string[];        // nếu có upload ảnh/video
  [key: string]: any;
}

export interface UpdatePostRequest {
  content?: string;
  location?: string;
  mediaIds?: string[];
  [key: string]: any;
}

export interface PostResponse {
  postId: string;
  authorId: string;
  content?: string;
  location?: string;
  mediaUrls?: string[];       // hoặc images, attachments tùy backend trả về
  createdAt: string;
  updatedAt?: string | null;
  isDeleted?: boolean;
  likeCount?: number;
  commentCount?: number;
  [key: string]: any;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;           // current page
  [key: string]: any;
}

const postService = {
  /**
   * Tạo bài viết mới
   */
  createPost: async (userId: string, payload: CreatePostRequest) => {
    return await api.post<PostResponse>('/posts', payload, {
      headers: { 'X-User-Id': userId },
    });
  },

  /**
   * Lấy chi tiết một bài viết
   */
  getPostById: async (postId: string, userId: string) => {
    return await api.get<PostResponse>(`/posts/${postId}`, {
      headers: { 'X-User-Id': userId },
    });
  },

  /**
   * Lấy danh sách bài viết của một user (Profile)
   */
  getUserPosts: async (userId: string, page: number = 0, size: number = 20) => {
    return await api.get<PageResponse<PostResponse>>(`/posts/user/${userId}`, {
      params: { page, size },
    });
  },

  /**
   * Lấy News Feed / Timeline
   * Lưu ý: Nên truyền userId để backend trả về feed cá nhân hóa
   */
  getNewsFeed: async (userId: string, page: number = 0, size: number = 20) => {
    return await api.get<PageResponse<PostResponse>>('/posts/feed', {
      params: { page, size },
      headers: { 'X-User-Id': userId },   // Rất quan trọng
    });
  },

  /**
   * Cập nhật bài viết
   */
  updatePost: async (postId: string, userId: string, payload: UpdatePostRequest) => {
    return await api.put<PostResponse>(`/posts/${postId}`, payload, {
      headers: { 'X-User-Id': userId },
    });
  },

  /**
   * Xóa bài viết
   */
  deletePost: async (postId: string, userId: string) => {
    return await api.delete(`/posts/${postId}`, {
      headers: { 'X-User-Id': userId },
    });
  },
};

export default postService;