import { drexdelApiClient, ApiResponse } from './client';
import { Post, Comment, Like, Share, UploadSession, CreatePostPayload, CreateCommentPayload, SharePayload, EditPostPayload, ReportPostPayload, PostAuthor, PaginatedResponse } from '../../@types/posts';

/** Server envelope for non-paginated endpoints: { success, data } */
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

class PostsApi {
  public async createUploadSession(mediaType: 'IMAGE' | 'VIDEO', filename: string, mimeType: string): Promise<ApiResponse<UploadSession>> {
    return await drexdelApiClient.post<UploadSession>('/media/upload-session', { mediaType, filename, mimeType });
  }

  public async uploadToPresignedUrl(uploadUrl: string, file: Blob): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': (file as any).type || 'application/octet-stream' },
      body: file as any,
    });
    if (!res.ok) throw new Error('Upload failed with status ' + res.status);
  }

  public async createPost(payload: CreatePostPayload): Promise<ApiResponse<ApiEnvelope<Post>>> {
    return await drexdelApiClient.post<ApiEnvelope<Post>>('/posts', payload);
  }

  public async fetchFeed(params: { page?: number; limit?: number; eventId?: string; mediaType?: 'IMAGE' | 'VIDEO' }): Promise<ApiResponse<PaginatedResponse<Post[]>>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.eventId) qs.set('eventId', params.eventId);
    if (params.mediaType) qs.set('mediaType', params.mediaType);
    const q = qs.toString();
    return await drexdelApiClient.get<PaginatedResponse<Post[]>>('/posts/feed' + (q ? '?' + q : ''));
  }

  public async fetchPost(postId: string): Promise<ApiResponse<ApiEnvelope<Post>>> {
    return await drexdelApiClient.get<ApiEnvelope<Post>>('/posts/' + postId);
  }

  public async deletePost(postId: string): Promise<ApiResponse<ApiEnvelope<null>>> {
    return await drexdelApiClient.delete('/posts/' + postId);
  }

  public async fetchComments(postId: string, params: { page?: number; limit?: number; parentCommentId?: string }): Promise<ApiResponse<PaginatedResponse<Comment[]>>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.parentCommentId) qs.set('parentCommentId', params.parentCommentId);
    const q = qs.toString();
    return await drexdelApiClient.get<PaginatedResponse<Comment[]>>('/posts/' + postId + '/comments' + (q ? '?' + q : ''));
  }

  public async createComment(postId: string, payload: CreateCommentPayload): Promise<ApiResponse<ApiEnvelope<Comment>>> {
    return await drexdelApiClient.post<ApiEnvelope<Comment>>('/posts/' + postId + '/comments', payload);
  }

  public async deleteComment(postId: string, commentId: string): Promise<ApiResponse<ApiEnvelope<null>>> {
    return await drexdelApiClient.delete('/posts/' + postId + '/comments/' + commentId);
  }

  public async toggleLike(postId: string): Promise<ApiResponse<ApiEnvelope<{ liked: boolean }>>> {
    return await drexdelApiClient.post<ApiEnvelope<{ liked: boolean }>>('/posts/' + postId + '/like', {});
  }

  public async fetchLikes(postId: string, params: { page?: number; limit?: number }): Promise<ApiResponse<PaginatedResponse<Like[]>>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return await drexdelApiClient.get<PaginatedResponse<Like[]>>('/posts/' + postId + '/likes' + (q ? '?' + q : ''));
  }

  public async sharePost(postId: string, payload: SharePayload): Promise<ApiResponse<ApiEnvelope<Share[]>>> {
    return await drexdelApiClient.post<ApiEnvelope<Share[]>>('/posts/' + postId + '/share', payload);
  }

  public async editPost(postId: string, payload: EditPostPayload): Promise<ApiResponse<ApiEnvelope<Post>>> {
    return await drexdelApiClient.patch<ApiEnvelope<Post>>('/posts/' + postId, payload);
  }

  public async reportPost(postId: string, payload: ReportPostPayload): Promise<ApiResponse<ApiEnvelope<{ reported: boolean; id: string }>>> {
    return await drexdelApiClient.post<ApiEnvelope<{ reported: boolean; id: string }>>('/posts/' + postId + '/report', payload);
  }

  public async savePost(postId: string): Promise<ApiResponse<ApiEnvelope<{ saved: boolean; savesCount: number }>>> {
    return await drexdelApiClient.post<ApiEnvelope<{ saved: boolean; savesCount: number }>>('/posts/' + postId + '/save', {});
  }

  public async listSaves(postId: string, params: { page?: number; limit?: number }): Promise<ApiResponse<PaginatedResponse<PostAuthor[]>>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return await drexdelApiClient.get<PaginatedResponse<PostAuthor[]>>('/posts/' + postId + '/saves' + (q ? '?' + q : ''));
  }

  public async listSavedPosts(params: { page?: number; limit?: number }): Promise<ApiResponse<PaginatedResponse<Post[]>>> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return await drexdelApiClient.get<PaginatedResponse<Post[]>>('/posts/saved' + (q ? '?' + q : ''));
  }
}

export const postsApi = new PostsApi();
