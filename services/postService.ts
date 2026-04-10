import api from './api';

export interface CreatePostRequest {
  content?: string;
  location?: string;
  // optionally images, attachments, etc.
  [key: string]: any;
}

export interface UpdatePostRequest {
  content?: string;
  location?: string;
  [key: string]: any;
}

export interface PostResponse {
  postId: string;
  authorId: string;
  content?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string | null;
  isDeleted?: boolean;
  // additional fields from backend mapper
  [key: string]: any;
}

export const postService = {
  /**
   * Create a new post. Backend should determine author from token.
   */
  createPost: async (payload: CreatePostRequest) => {
    return await api.post('/posts', payload);
  },

  /**
   * Get posts of a specific user (paginated).
   * Tries a few common endpoints used in the app.
   */
  getUserPosts: async (userId: string, page = 0, size = 20) => {
    const endpoints = [`/users/${userId}/posts`, `/posts/user/${userId}`, `/posts?authorId=${userId}`];
    for (const ep of endpoints) {
      try {
        const res: any = await api.get(ep, { params: { page, size } });
        return res;
      } catch (err) {
        // try next
      }
    }
    // final fallback: try posts with query
    return await api.get('/posts', { params: { page, size, authorId: userId } });
  },

  /**
   * Get news feed / timeline posts (paginated).
   * Tries multiple endpoints and returns the first successful response.
   */
  getNewsFeed: async (page = 0, size = 20) => {
    const endpoints = ['/timeline/posts', '/posts/timeline', '/posts'];
    for (const ep of endpoints) {
      try {
        const res: any = await api.get(ep, { params: { page, size } });
        return res;
      } catch (err) {
        // continue to next
      }
    }
    // If all fail throw
    throw new Error('Không thể tải news feed');
  },

  getPostById: async (postId: string) => {
    return await api.get(`/posts/${postId}`);
  },

  updatePost: async (postId: string, payload: UpdatePostRequest) => {
    return await api.put(`/posts/${postId}`, payload);
  },

  deletePost: async (postId: string) => {
    return await api.delete(`/posts/${postId}`);
  },
};

export default postService;
