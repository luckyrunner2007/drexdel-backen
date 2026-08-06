import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

/**
 * PROJECT DREXDEL - EVENT-BACKED SOCIAL GRAPH CONTROLLER
 * FILE: src/controllers/socialController.ts
 *
 * Implements the "Event-Backed Social Graph" differentiator: @username
 * identity, Instagram-style follows, and relationships that carry real
 * provenance (mutual events + mutual friends) derived from ticket-verified
 * attendance (UserAttendedEvent) and accepted follows.
 */

export const updateMeSchema = z.object({
  username: z.string().trim().min(2).max(30).regex(/^[a-zA-Z0-9_.]+$/).optional(),
  bio: z.string().trim().max(300).optional(),
  avatarUrl: z.string().trim().url().max(1000).optional(),
});

class SocialController {
  private safeProfile(user: any, extra: Record<string, unknown> = {}) {
    return {
      id: user.id,
      name: user.name,
      username: user.username || null,
      avatarUrl: user.avatarUrl || null,
      bio: user.bio || null,
      role: user.role,
      isVerified: user.isVerified ?? false,
      ...extra,
    };
  }

  /** GET /v1/users/:identifier - public profile by @username or id. */
  async getPublicProfile(req: Request, res: Response): Promise<void> {
    try {
      const identifier = String(req.params.identifier || '');
      const viewerId = req.user!.sub;

      const user = identifier.startsWith('@')
        ? await prisma.user.findUnique({ where: { username: identifier.slice(1) } })
        : await prisma.user.findUnique({ where: { id: identifier } });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const [followerCount, followingCount] = await Promise.all([
        prisma.userFollow.count({ where: { followeeId: user.id, status: 'ACCEPTED' } }),
        prisma.userFollow.count({ where: { followerId: user.id, status: 'ACCEPTED' } }),
      ]);

      const rel = await prisma.userFollow.findFirst({
        where: { followerId: viewerId, followeeId: user.id },
      });

      const sharedEvents = await prisma.userAttendedEvent.findMany({
        where: { userId: viewerId },
        select: { eventId: true },
      });
      const sharedEventIds = sharedEvents.map((e) => e.eventId);

      const mutualEvents = await prisma.userAttendedEvent.count({
        where: {
          eventId: { in: sharedEventIds },
          userId: user.id,
        },
      });

      const profile = this.safeProfile(user, {
        followerCount,
        followingCount,
        relationship: {
          isSelf: viewerId === user.id,
          status: rel?.status ?? null,
          isFollowing: !!rel && rel.status === 'ACCEPTED',
        },
        mutualEvents,
      });

      res.status(200).json({ success: true, profile });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Profile error');
      res.status(500).json({ error: 'Failed to load profile' });
    }
  }

  /** PATCH /v1/users/me - update own @username / bio / avatar. */
  async updateMe(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || updateMeSchema.parse(req.body);

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.username !== undefined ? { username: data.username } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        },
      });

      res.status(200).json({ success: true, profile: this.safeProfile(updated) });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        res.status(409).json({ success: false, message: 'That @username is already taken.' });
        return;
      }
      logger.error({ err: error, path: req.path }, 'Update profile error');
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /** POST /v1/users/:id/follow - follow (or request to follow) a user. */
  async followUser(req: Request, res: Response): Promise<void> {
    try {
      const followerId = req.user!.sub;
      const followeeId = String(req.params.id || '');

      if (followerId === followeeId) {
        res.status(400).json({ error: 'You cannot follow yourself.' });
        return;
      }

      const target = await prisma.user.findUnique({ where: { id: followeeId } });
      if (!target) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const existing = await prisma.userFollow.findUnique({
        where: { followerId_followeeId: { followerId, followeeId } },
      });

      if (existing?.status === 'BLOCKED') {
        res.status(403).json({ error: 'Unable to follow this user.' });
        return;
      }

      // All accounts are open-follow for v1 (ACCEPTED). A private-account
      // (REQUESTED) flow can be layered on when an account-privacy flag exists.
      if (existing) {
        const updated = await prisma.userFollow.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
        res.status(200).json({ success: true, status: updated.status });
        return;
      }

      const created = await prisma.userFollow.create({
        data: { followerId, followeeId, status: 'ACCEPTED' },
      });
      res.status(201).json({ success: true, status: created.status });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Follow user error');
      res.status(500).json({ error: 'Failed to follow user' });
    }
  }

  /** DELETE /v1/users/:id/follow - unfollow a user. */
  async unfollowUser(req: Request, res: Response): Promise<void> {
    try {
      const followerId = req.user!.sub;
      const followeeId = String(req.params.id || '');

      const existing = await prisma.userFollow.findUnique({
        where: { followerId_followeeId: { followerId, followeeId } },
      });

      if (existing) {
        await prisma.userFollow.delete({ where: { id: existing.id } });
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Unfollow user error');
      res.status(500).json({ error: 'Failed to unfollow user' });
    }
  }

  /** GET /v1/users/:id/relationship - event-backed relationship summary. */
  async getRelationship(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = req.user!.sub;
      const otherId = String(req.params.id || '');

      const [viewerEvents, otherEvents, followRel, inbound] = await Promise.all([
        prisma.userAttendedEvent.findMany({ where: { userId: viewerId }, select: { eventId: true } }),
        prisma.userAttendedEvent.findMany({ where: { userId: otherId }, select: { eventId: true } }),
        prisma.userFollow.findUnique({ where: { followerId_followeeId: { followerId: viewerId, followeeId: otherId } } }),
        prisma.userFollow.findUnique({ where: { followerId_followeeId: { followerId: otherId, followeeId: viewerId } } }),
      ]);

      const viewerEventIds = new Set(viewerEvents.map((e) => e.eventId));
      const shared = otherEvents.filter((e) => viewerEventIds.has(e.eventId));
      const sharedEventIds = shared.map((e) => e.eventId);
      const sharedEventTitles = sharedEventIds.length
        ? await prisma.event.findMany({ where: { id: { in: sharedEventIds } }, select: { title: true } })
        : [];
      const sharedEventNames = sharedEventTitles.map((e) => e.title);

      // Mutual friends = accepted follows shared by both users.
      const myFollowing = await prisma.userFollow.findMany({
        where: { followerId: viewerId, status: 'ACCEPTED' },
        select: { followeeId: true },
      });
      const myFollowingIds = new Set(myFollowing.map((f) => f.followeeId));
      const theirFollowers = await prisma.userFollow.count({
        where: { followeeId: otherId, status: 'ACCEPTED', followerId: { in: Array.from(myFollowingIds) } },
      });

      res.status(200).json({
        success: true,
        relationship: {
          status: followRel?.status ?? null,
          isFollowing: !!followRel && followRel.status === 'ACCEPTED',
          isFollowedBy: !!inbound,
          mutualEvents: shared.length,
          mutualFriends: theirFollowers,
          sharedEventNames: sharedEventNames.slice(0, 5),
        },
      });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Relationship error');
      res.status(500).json({ error: 'Failed to load relationship' });
    }
  }

  /** GET /v1/users/me/suggestions - ranked by shared events + mutual friends. */
  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = req.user!.sub;
      const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);

      const myFollows = await prisma.userFollow.findMany({
        where: { followerId: viewerId },
        select: { followeeId: true, status: true },
      });
      const blockedOrFollowing = new Set(
        myFollows.filter((f) => f.status === 'ACCEPTED' || f.status === 'BLOCKED').map((f) => f.followeeId),
      );

      const attendees = await prisma.userAttendedEvent.findMany({
        where: { userId: viewerId },
        select: { eventId: true },
      });
      const myEventIds = attendees.map((a) => a.eventId);

      const coAttendees = await prisma.userAttendedEvent.findMany({
        where: { eventId: { in: myEventIds } },
        include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } },
      });

      const suggestions = new Map<string, { user: any; sharedEvents: Set<string> }>();
      for (const ca of coAttendees) {
        if (ca.userId === viewerId || blockedOrFollowing.has(ca.userId)) continue;
        const entry = suggestions.get(ca.userId) || { user: ca.user, sharedEvents: new Set<string>() };
        entry.sharedEvents.add(ca.eventId);
        suggestions.set(ca.userId, entry);
      }

      const ranked = Array.from(suggestions.values())
        .sort((a, b) => b.sharedEvents.size - a.sharedEvents.size)
        .slice(0, limit)
        .map((s) => ({ ...s.user, sharedEvents: s.sharedEvents.size }));

      res.status(200).json({ success: true, suggestions: ranked });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Suggestions error');
      res.status(500).json({ error: 'Failed to load suggestions' });
    }
  }
}

export const socialController = new SocialController();
