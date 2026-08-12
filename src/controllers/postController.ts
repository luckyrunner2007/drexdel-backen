import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { supabaseAdmin, getSupabaseBucket, buildStoragePath, isImageMime, isVideoMime } from '../config/supabase';

const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'],
};

const MAX_FILE_SIZE = {
  IMAGE: 15 * 1024 * 1024,  // 15MB
  VIDEO: 100 * 1024 * 1024  // 100MB
};
import { requireAuth } from '../middleware/auth';

export const uploadMediaSchema = z.object({
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().positive().optional(),
});


export const createPostSchema = z.object({
  mediaUrl: z.string().min(1).max(500),
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  thumbnailUrl: z.string().url().max(500).optional(),
  durationSeconds: z.number().int().positive().optional(),
  caption: z.string().min(1).max(5000),
  eventId: z.string().optional(),
  isPastEventMemory: z.boolean().optional(),
  isUpcomingEventReel: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().optional(),
});

export const shareSchema = z.object({
  sharedToIds: z.array(z.string().min(1)).min(1).max(50),
});

export const editPostSchema = createPostSchema.partial().extend({
  caption: z.string().min(1).max(5000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export const reportPostSchema = z.object({
  reason: z.enum(['SPAM', 'HARMFUL', 'IMPERSONATION', 'COPYRIGHT', 'OTHER']).default('SPAM'),
  details: z.string().max(2000).optional(),
});

const SAVED_USER_SELECT = { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } };

export class PostController {
  async createUploadSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const body = (req as any).validatedBody || uploadMediaSchema.parse(req.body);
      const allowedMimes = body.mediaType === 'IMAGE' ? ALLOWED_MIME_TYPES.IMAGE : ALLOWED_MIME_TYPES.VIDEO;
      if (!allowedMimes.includes(body.mimeType)) {
        res.status(400).json({ error: 'Invalid file type. Allowed: ' + allowedMimes.join(', ') });
        return;
      }
      if (body.fileSize) {
        const maxSize = body.mediaType === 'IMAGE' ? MAX_FILE_SIZE.IMAGE : MAX_FILE_SIZE.VIDEO;
        if (body.fileSize > maxSize) {
          res.status(400).json({ error: 'File too large. Max size: ' + (maxSize / 1024 / 1024) + 'MB' });
          return;
        }
      }
      const tempPostId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const fileKey = buildStoragePath(userId, tempPostId, body.filename);
      const bucket = getSupabaseBucket();
      if (!supabaseAdmin) {
        res.status(503).json({ error: 'Media storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.' });
        return;
      }
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(fileKey, { upsert: false });
      if (error || !data?.signedUrl) {
        logger.error({ err: error }, 'Supabase signed URL failed');
        res.status(500).json({ error: 'Failed to create upload session' });
        return;
      }
      res.status(200).json({ uploadUrl: data.signedUrl, fileKey, bucket });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Upload session error');
      res.status(500).json({ error: 'Failed to create upload session' });
    }
  }

  async listFeed(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = (req as any).user.sub;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;
      const where: any = { isSoftDeleted: false, status: 'PUBLISHED' };
      if (req.query.eventId) where.eventId = String(req.query.eventId);
      if (req.query.mediaType) where.mediaType = String(req.query.mediaType).toUpperCase();
      const [posts, total] = await Promise.all([
        prisma.post.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } }, event: { select: { id: true, title: true, date: true } } } }),
        prisma.post.count({ where }),
      ]);
      const postIds = posts.map(p => p.id);
      const [likesMap, commentsCountMap, likesCountMap, myLikes] = await Promise.all([
        postIds.length ? prisma.like.findMany({ where: { postId: { in: postIds } }, select: { postId: true, userId: true } }) : Promise.resolve([]),
        postIds.length ? prisma.comment.groupBy({ by: ['postId'], where: { postId: { in: postIds }, isSoftDeleted: false }, _count: { _all: true } }) : Promise.resolve([]),
        postIds.length ? prisma.like.groupBy({ by: ['postId'], where: { postId: { in: postIds } }, _count: { _all: true } }) : Promise.resolve([]),
        postIds.length ? prisma.like.findMany({ where: { postId: { in: postIds }, userId: viewerId }, select: { postId: true } }) : Promise.resolve([]),
      ]);
      const likesByPost = new Map(likesMap.map(l => [l.postId, l.userId]));
      const commentsByPost = new Map(commentsCountMap.map(c => [c.postId, c._count._all]));
      const likesCountByPost = new Map(likesCountMap.map(c => [c.postId, c._count._all]));
      const myLikeSet = new Set(myLikes.map(l => l.postId));
      const result = posts.map(p => ({ ...p, likesCount: likesCountByPost.get(p.id) || 0, commentsCount: commentsByPost.get(p.id) || 0, isLiked: myLikeSet.has(p.id), likes: undefined }));
      res.status(200).json({ success: true, data: result, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + result.length < total } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Feed error');
      res.status(500).json({ error: 'Failed to load feed' });
    }
  }

  async getPost(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = (req as any).user.sub;
      const post = await prisma.post.findFirst({ where: { id: String(req.params.id), isSoftDeleted: false }, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } }, event: { select: { id: true, title: true, date: true } } } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const [likesCount, commentsCount, isLiked] = await Promise.all([
        prisma.like.count({ where: { postId: post.id } }),
        prisma.comment.count({ where: { postId: post.id, isSoftDeleted: false } }),
        prisma.like.findFirst({ where: { postId: post.id, userId: viewerId } }),
      ]);
      res.status(200).json({ success: true, data: { ...post, likesCount, commentsCount, isLiked: !!isLiked } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Get post error');
      res.status(500).json({ error: 'Failed to load post' });
    }
  }

  async createPost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const body = (req as any).validatedBody || createPostSchema.parse(req.body);
      if (!isImageMime('') && !isVideoMime('')) { /* validation already done */ }
      const post = await prisma.post.create({ data: { userId, mediaUrl: body.mediaUrl, mediaType: body.mediaType, thumbnailUrl: body.thumbnailUrl || null, durationSeconds: body.durationSeconds || null, caption: body.caption, eventId: body.eventId || null, isPastEventMemory: body.isPastEventMemory || false, isUpcomingEventReel: body.isUpcomingEventReel || false, status: 'PUBLISHED' }, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } });
      res.status(201).json({ success: true, data: post });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Create post error');
      res.status(500).json({ error: 'Failed to create post' });
    }
  }

  async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const post = await prisma.post.findUnique({ where: { id: String(req.params.id) } });
      if (!post || post.isSoftDeleted) { res.status(404).json({ error: 'Post not found' }); return; }
      if (post.userId !== userId) { res.status(403).json({ error: 'Not authorized' }); return; }
      await prisma.post.update({ where: { id: post.id }, data: { isSoftDeleted: true, deletedAt: new Date(), deletedBy: userId } });
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Delete post error');
      res.status(500).json({ error: 'Failed to delete post' });
    }
  }

  async listComments(req: Request, res: Response): Promise<void> {
    try {
      const postId = String(req.params.id);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;
      const where: any = { postId, isSoftDeleted: false };
      if (req.query.parentCommentId) where.parentCommentId = String(req.query.parentCommentId);
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } }),
        prisma.comment.count({ where }),
      ]);
      res.status(200).json({ success: true, data: comments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + comments.length < total } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Comments error');
      res.status(500).json({ error: 'Failed to load comments' });
    }
  }

  async createComment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const postId = String(req.params.id);
      const body = (req as any).validatedBody || createCommentSchema.parse(req.body);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      if (body.parentCommentId) {
        const parent = await prisma.comment.findFirst({ where: { id: body.parentCommentId, postId, isSoftDeleted: false } });
        if (!parent) { res.status(404).json({ error: 'Parent comment not found' }); return; }
      }
      const comment = await prisma.comment.create({ data: { postId, userId, content: body.content, parentCommentId: body.parentCommentId || null }, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } });
      res.status(201).json({ success: true, data: comment });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Create comment error');
      res.status(500).json({ error: 'Failed to create comment' });
    }
  }

  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const comment = await prisma.comment.findFirst({ where: { id: String(req.params.commentId) } });
      if (!comment || comment.isSoftDeleted) { res.status(404).json({ error: 'Comment not found' }); return; }
      if (comment.userId !== userId) { res.status(403).json({ error: 'Not authorized' }); return; }
      await prisma.comment.update({ where: { id: comment.id }, data: { isSoftDeleted: true } });
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Delete comment error');
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }

  async toggleLike(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const postId = String(req.params.id);
      const existing = await prisma.like.findFirst({ where: { postId, userId } });
      if (existing) {
        await prisma.like.delete({ where: { id: existing.id } });
        res.status(200).json({ success: true, data: { liked: false } });
      } else {
        await prisma.like.create({ data: { postId, userId } });
        res.status(200).json({ success: true, data: { liked: true } });
      }
    } catch (err) {
      logger.error({ err, path: req.path }, 'Like error');
      res.status(500).json({ error: 'Failed to toggle like' });
    }
  }

  async listLikes(req: Request, res: Response): Promise<void> {
    try {
      const postId = String(req.params.id);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;
      const [likes, total] = await Promise.all([
        prisma.like.findMany({ where: { postId }, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } }),
        prisma.like.count({ where: { postId } }),
      ]);
      res.status(200).json({ success: true, data: likes.map(l => l.user), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + likes.length < total } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Likes list error');
      res.status(500).json({ error: 'Failed to load likes' });
    }
  }

  async sharePost(req: Request, res: Response): Promise<void> {
    try {
      const sharedById = (req as any).user.sub;
      const postId = String(req.params.id);
      const body = (req as any).validatedBody || shareSchema.parse(req.body);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const existing = await prisma.share.findFirst({ where: { postId, sharedById, sharedToId: { in: body.sharedToIds } } });
      if (existing) { res.status(400).json({ error: 'Already shared to at least one of the selected users' }); return; }
      const shares = await prisma.$transaction(
        body.sharedToIds.map((sharedToId: string) => prisma.share.create({ data: { postId, sharedById, sharedToId } }))
      );
      logger.info({ postId, sharedById, count: shares.length }, 'Post shared');
      res.status(201).json({ success: true, data: shares });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Share error');
            res.status(500).json({ error: 'Failed to share post' });
    }
  }

  async editPost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const postId = String(req.params.id);
      const body = (req as any).validatedBody || editPostSchema.parse(req.body);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      if (post.userId !== userId) { res.status(403).json({ error: 'Not authorized' }); return; }
      const update: any = { isEdited: true, editedAt: new Date() };
      if (body.caption !== undefined) update.caption = body.caption;
      if (body.mediaUrl) update.mediaUrl = body.mediaUrl;
      if (body.mediaType) update.mediaType = body.mediaType;
      if (body.thumbnailUrl) update.thumbnailUrl = body.thumbnailUrl;
      if (body.durationSeconds) update.durationSeconds = body.durationSeconds;
      if (body.eventId) update.eventId = body.eventId;
      if (body.status) update.status = body.status;
      const edited = await prisma.post.update({
        where: { id: post.id },
        data: update,
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } }, event: { select: { id: true, title: true, date: true } } },
      });
      res.status(200).json({ success: true, data: edited });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Edit post error');
      res.status(500).json({ error: 'Failed to edit post' });
    }
  }

  async reportPost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const postId = String(req.params.id);
      const body = (req as any).validatedBody || reportPostSchema.parse(req.body);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const existing = await prisma.postReport.findFirst({ where: { postId, userId, reason: body.reason } });
      if (existing) { res.status(200).json({ success: true, data: { reported: true, id: existing.id } }); return; }
      const created = await prisma.$transaction(async (tx: any) => {
        const rep = await tx.postReport.create({ data: { postId, userId, reason: body.reason, details: body.details || null } });
        await tx.post.update({ where: { id: postId }, data: { isReported: true } });
        return rep;
      });
      logger.info({ postId, userId, reason: body.reason }, 'Post reported');
      res.status(201).json({ success: true, data: { reported: true, id: created.id } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Report post error');
      res.status(500).json({ error: 'Failed to report post' });
    }
  }

  async savePost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.sub;
      const postId = String(req.params.id);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const existing = await prisma.savedPost.findFirst({ where: { postId, userId } });
      if (existing) {
        await prisma.savedPost.delete({ where: { id: existing.id } });
      } else {
        await prisma.savedPost.create({ data: { postId, userId } });
      }
      const savesCount = await prisma.savedPost.count({ where: { postId } });
      res.status(200).json({ success: true, data: { saved: !existing, savesCount } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'Save post error');
      res.status(500).json({ error: 'Failed to save post' });
    }
  }

  async listSaves(req: Request, res: Response): Promise<void> {
    try {
      const postId = String(req.params.id);
      const post = await prisma.post.findFirst({ where: { id: postId, isSoftDeleted: false } });
      if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;
      const [saves, total] = await Promise.all([
        prisma.savedPost.findMany({ where: { postId }, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: SAVED_USER_SELECT } }),
        prisma.savedPost.count({ where: { postId } }),
      ]);
      res.status(200).json({ success: true, data: saves.map((s: any) => s.user), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + saves.length < total } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'List saves error');
      res.status(500).json({ error: 'Failed to load saves' });
    }
  }

  async listSavedPosts(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = (req as any).user.sub;
      const postId = String(req.params.id);
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
      const skip = (page - 1) * limit;
      const [saves, total] = await Promise.all([
        prisma.savedPost.findMany({
          where: { userId: viewerId, post: { isSoftDeleted: false } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { post: { include: { user: SAVED_USER_SELECT, event: { select: { id: true, title: true, date: true } } } } },
        }),
        prisma.savedPost.count({ where: { userId: viewerId, post: { isSoftDeleted: false } } }),
      ]);
      const posts = saves.map((s: any) => s.post);
      res.status(200).json({ success: true, data: posts, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + posts.length < total } });
    } catch (err) {
      logger.error({ err, path: req.path }, 'List saved posts error');
      res.status(500).json({ error: 'Failed to load saved posts' });
    }
  }
}

export const postController = new PostController();
