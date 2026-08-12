import { DrexdelUser } from './user';

export type MediaType = 'IMAGE' | 'VIDEO';

export interface PostAuthor {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface PostEventSummary {
  id: string;
  title: string;
  date: string;
}

export interface Post {
  id: string;
  userId: string;
  user: PostAuthor;
  eventId?: string;
  event?: PostEventSummary;
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  durationSeconds?: number;
  caption: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isPastEventMemory: boolean;
  isUpcomingEventReel: boolean;
  isSoftDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
  savesCount?: number;
  isEdited?: boolean;
  editedAt?: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: PostAuthor;
  content: string;
  parentCommentId?: string;
  replies?: Comment[];
  isSoftDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Like {
  id: string;
  postId: string;
  userId: string;
  user: PostAuthor;
  createdAt: string;
}

export interface Share {
  id: string;
  postId: string;
  sharedById: string;
  sharedBy: PostAuthor;
  sharedToId: string;
  sharedTo: PostAuthor;
  createdAt: string;
}

export interface UploadSession {
  uploadUrl: string;
  fileKey: string;
  bucket: string;
}

export interface CreatePostPayload {
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  durationSeconds?: number;
  caption: string;
  eventId?: string;
  isPastEventMemory?: boolean;
  isUpcomingEventReel?: boolean;
}

export interface CreateCommentPayload {
  content: string;
  parentCommentId?: string;
}

export interface SharePayload {
  sharedToIds: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
        hasMore: boolean;
  };
}

/** Partial patch body for editing a post (PATCH /posts/:id). */
export interface EditPostPayload {
  mediaUrl?: string;
  mediaType?: MediaType;
  thumbnailUrl?: string;
  durationSeconds?: number;
  caption?: string;
  eventId?: string;
  isPastEventMemory?: boolean;
  isUpcomingEventReel?: boolean;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

/** Body for reporting a post (POST /posts/:id/report). */
export interface ReportPostPayload {
  reason?: PostReportReason;
  details?: string;
}

export type PostReportReason = 'SPAM' | 'HARMFUL' | 'IMPERSONATION' | 'COPYRIGHT' | 'OTHER';

export interface PostReport {
  id: string;
  postId: string;
  userId: string;
  reason: PostReportReason;
  details?: string | null;
  createdAt: string;
}

export interface SavedPost {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
  user?: PostAuthor;
}

