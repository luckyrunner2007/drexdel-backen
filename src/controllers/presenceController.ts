import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { cacheSet, getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

/**
 * PROJECT DREXDEL - LIVE EVENT PRESENCE ENGINE ("Who's here now")
 * FILE: src/controllers/presenceController.ts
 *
 * A user present at an event (holding a BOOKED ticket and inside the venue
 * geofence) heartbeats their presence. Friends (ACCEPTED follows) can then
 * see a "Live at X" section in the chat inbox — the differentiator that
 * reuses the existing geofence/ticket infra.
 *
 * Presence is stored in Redis with a short TTL (expires automatically when
 * someone leaves), keyed as `presence:event:{eventId}:{userId}`.
 *
 * Privacy: every user controls their `presenceVisibility`:
 *   - PUBLIC       -> anyone can discover them at an event
 *   - FRIENDS_ONLY -> only ACCEPTED followers see them (default)
 *   - HIDDEN       -> the heartbeat is acknowledged locally, never shared
 *
 * Notifications: when a friend first crosses INTO the geofence (arrival), a
 * `presence:arrival:{followerId}` Redis list entry is appended so the app can
 * show "X just arrived at Y" without polling the DB.
 */

const PRESENCE_TTL_SECONDS = 120;
const GEOFENCE_METERS = 150;
const ARRIVAL_FEED_TTL_SECONDS = 60 * 60 * 24 * 7; // keep arrival events for a week
const ARRIVAL_FEED_MAX_LENGTH = 50;

export const heartbeatSchema = z.object({
  eventId: z.string().cuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const presenceVisibilitySchema = z.object({
  visibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'HIDDEN']),
});

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class PresenceController {
  /** POST /v1/presence/heartbeat - report "I am at this event right now". */
  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || heartbeatSchema.parse(req.body);

      // Load the user's presence privacy setting (defaults to FRIENDS_ONLY).
      let presenceVisibility = 'FRIENDS_ONLY';
      try {
        const me = await prisma.user.findUnique({
          where: { id: userId },
          select: { presenceVisibility: true },
        });
        presenceVisibility = me?.presenceVisibility || 'FRIENDS_ONLY';
      } catch {
        presenceVisibility = 'FRIENDS_ONLY';
      }

      // Only verified attendees can be "present".
      const ticket = await prisma.ticket.findFirst({
        where: { userId, eventId: data.eventId, status: 'BOOKED' as any },
      });
      if (!ticket) {
        res.status(403).json({ success: false, error: 'You must hold a ticket to this event to share presence.' });
        return;
      }

      // Geofence containment check when the event has coordinates.
      const event = await prisma.event.findUnique({
        where: { id: data.eventId },
        select: { latitude: true, longitude: true, title: true },
      });

      let inside = true;
      if (event?.latitude != null && event?.longitude != null) {
        inside = distanceMeters(data.lat, data.lng, event.latitude, event.longitude) <= GEOFENCE_METERS;
      }

      const client = await getRedisClient();
      const presenceKey = `presence:event:${data.eventId}:${userId}`;

      // Privacy: HIDDEN users still get a 200 (the client knows they are at
      // the event) but their presence is never exposed to anyone else.
      if (presenceVisibility === 'HIDDEN') {
        res.status(200).json({ success: true, inside, shared: false, visibility: 'HIDDEN' });
        return;
      }

      const payload = {
        userId,
        eventId: data.eventId,
        at: Date.now(),
        inside,
        lat: data.lat,
        lng: data.lng,
        visibility: presenceVisibility,
        eventTitle: event?.title || null,
      };

      // Detect arrival transitions: previous heartbeat was missing OR was
      // outside the geofence, and now we are inside -> notify this user's friends.
      if (inside && client) {
        let wasPresent = false;
        try {
          const prevRaw = await client.get(presenceKey);
          if (prevRaw) {
            const prev = JSON.parse(prevRaw);
            wasPresent = !!prev?.inside;
          }
        } catch {
          wasPresent = false;
        }

        if (!wasPresent) {
          await this.notifyFollowersOfArrival(userId, data.eventId, event?.title || null);
        }
      }

      // Even outside the tight geofence (e.g. walking in), keep presence for
      // a short grace window but mark containment for the client's own radar.
      await cacheSet(presenceKey, JSON.stringify(payload), PRESENCE_TTL_SECONDS);

      res.status(200).json({
        success: true,
        inside,
        shared: true,
        visibility: presenceVisibility,
      });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Presence heartbeat error');
      res.status(500).json({ error: 'Failed to update presence' });
    }
  }

  /**
   * Append a compact arrival event to every ACCEPTED follower's Redis feed so
   * their app can show "X just arrived at Y". Failures never break the
   * heartbeat path; they are logged and swallowed.
   */
  private async notifyFollowersOfArrival(userId: string, eventId: string, eventTitle: string | null): Promise<void> {
    try {
      const follows = await prisma.userFollow.findMany({
        where: { followeeId: userId, status: 'ACCEPTED' },
        select: { followerId: true },
      });
      if (follows.length === 0) return;

      const client = await getRedisClient();
      if (!client) return;

      const entry = JSON.stringify({ friendId: userId, eventId, eventTitle, at: Date.now() });

      for (const follow of follows) {
        const feedKey = `presence:arrival:${follow.followerId}`;
        try {
          const len = await client.lPush(feedKey, entry);
          if (len > ARRIVAL_FEED_MAX_LENGTH) {
            await client.lTrim(feedKey, 0, ARRIVAL_FEED_MAX_LENGTH - 1);
          }
          await client.expire(feedKey, ARRIVAL_FEED_TTL_SECONDS);
        } catch (err) {
          logger.warn({ err: err, followerId: follow.followerId }, 'Failed to enqueue presence arrival');
        }
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to notify followers of arrival');
    }
  }

  /** GET /v1/presence/events - events where the viewer's friends are present now. */
  async getEventsWithFriendsPresent(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = req.user!.sub;

      // Accepted follows only (privacy: presence is friends-only).
      const follows = await prisma.userFollow.findMany({
        where: { followerId: viewerId, status: 'ACCEPTED' },
        select: { followeeId: true },
      });
      const friendIds = new Set(follows.map((f) => f.followeeId));
      if (friendIds.size === 0) {
        res.status(200).json({ success: true, events: [] });
        return;
      }

      const client = await getRedisClient();
      if (!client) {
        res.status(200).json({ success: true, events: [] });
        return;
      }

      // Gather presence keys belonging to the viewer's friends, keeping the
      // exact coordinates so the radar can plot friends on a map.
      const presentUserIds = new Set<string>();
      const eventToUsers = new Map<string, { userId: string; lat: number | null; lng: number | null }[]>();
      let cursor = '0';
      do {
        const scan = await client.scan(cursor, { MATCH: 'presence:event:*', COUNT: 100 });
        cursor = scan.cursor;
        for (const key of scan.keys) {
          const m = /^presence:event:(.+):(.+)$/.exec(key);
          if (!m) continue;
          const [, eventId, uid] = m;
          if (!friendIds.has(uid)) continue;

          let payload: any = null;
          try {
            const raw = await client.get(key);
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = null;
          }
          // Skip hidden members and out-of-geofence heartbeats.
          if (!payload || payload.visibility === 'HIDDEN' || !payload.inside) continue;

          presentUserIds.add(uid);
          if (!eventToUsers.has(eventId)) eventToUsers.set(eventId, []);
          eventToUsers.get(eventId)!.push({ userId: uid, lat: payload.lat ?? null, lng: payload.lng ?? null });
        }
      } while (cursor !== '0');

      if (eventToUsers.size === 0) {
        res.status(200).json({ success: true, events: [] });
        return;
      }

      const [events, members] = await Promise.all([
        prisma.event.findMany({
          where: { id: { in: Array.from(eventToUsers.keys()) } },
          select: { id: true, title: true, location: true, date: true, latitude: true, longitude: true },
        }),
        prisma.user.findMany({
          where: { id: { in: Array.from(presentUserIds) } },
          select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true },
        }),
      ]);

      const memberMap = new Map(members.map((m) => [m.id, m]));
      const result = events.map((ev) => ({
        ...ev,
        members: (eventToUsers.get(ev.id) || [])
          .map((m) => ({ ...memberMap.get(m.userId), lat: m.lat, lng: m.lng }))
          .filter((m) => m && m.id),
      }));

      res.status(200).json({ success: true, events: result });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Presence list error');
      res.status(500).json({ error: 'Failed to load live events' });
    }
  }

  /** GET /v1/presence/notifications - friend arrivals feed for this user. */
  async getFriendArrivals(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = req.user!.sub;
      const client = await getRedisClient();
      if (!client) {
        res.status(200).json({ success: true, arrivals: [] });
        return;
      }

      const feedKey = `presence:arrival:${viewerId}`;
      const raw = await client.lRange(feedKey, 0, ARRIVAL_FEED_MAX_LENGTH - 1);

      const entries: any[] = [];
      const friendIds = new Set<string>();
      for (const item of raw) {
        try {
          const parsed = JSON.parse(item);
          if (!parsed?.friendId || !parsed?.eventId) continue;
          entries.push(parsed);
          friendIds.add(parsed.friendId);
        } catch {
          // skip malformed entries
        }
      }

      // Enrich with friend names/avatars for rendering.
      let friendMap = new Map<string, any>();
      if (friendIds.size > 0) {
        const friends = await prisma.user.findMany({
          where: { id: { in: Array.from(friendIds) } },
          select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true },
        });
        friendMap = new Map(friends.map((f) => [f.id, f]));
      }

      res.status(200).json({
        success: true,
        arrivals: entries.map((a) => ({ ...a, friend: friendMap.get(a.friendId) || null })),
      });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Presence arrivals error');
      res.status(500).json({ error: 'Failed to load arrival feed' });
    }
  }

  /** DELETE /v1/presence/notifications - clear the arrival feed for this user. */
  async clearFriendArrivals(req: Request, res: Response): Promise<void> {
    try {
      const viewerId = req.user!.sub;
      const client = await getRedisClient();
      if (client) {
        await client.del(`presence:arrival:${viewerId}`);
      }
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Clear presence arrivals error');
      res.status(500).json({ error: 'Failed to clear arrival feed' });
    }
  }

  /** GET /v1/presence/visibility - read the caller's presence privacy setting. */
  async getPresenceVisibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { presenceVisibility: true },
      });
      res.status(200).json({ success: true, visibility: me?.presenceVisibility || 'FRIENDS_ONLY' });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Presence visibility read error');
      res.status(500).json({ error: 'Failed to load presence visibility' });
    }
  }

  /** PATCH /v1/presence/visibility - update the caller's presence privacy. */
  async setPresenceVisibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || presenceVisibilitySchema.parse(req.body);

      await prisma.user.update({
        where: { id: userId },
        data: { presenceVisibility: data.visibility },
      });

      res.status(200).json({ success: true, visibility: data.visibility });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Presence visibility update error');
      res.status(500).json({ error: 'Failed to update presence visibility' });
    }
  }
}

export const presenceController = new PresenceController();
