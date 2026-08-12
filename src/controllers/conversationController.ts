import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { chatBroker } from '../websocket/chatBroker';

export const startDmSchema = z.object({ userId: z.string().min(1).max(64) });
export const sendDmSchema = z.object({ content: z.string().min(1).max(5000), messageType: z.enum(['TEXT','IMAGE','EVENT_CARD','SYSTEM']).default('TEXT') });
export const createGroupSchema = z.object({ title: z.string().min(1).max(120), description: z.string().max(2000).optional().nullable(), avatarUrl: z.string().url().optional().nullable(), isPublic: z.boolean().optional().default(false), memberIds: z.array(z.string().min(1).max(64)).max(100).default([]) });
export const updateGroupSchema = z.object({ title: z.string().min(1).max(120).optional().nullable(), description: z.string().max(2000).optional().nullable(), avatarUrl: z.string().url().optional().nullable(), isPublic: z.boolean().optional() });
export const addMembersSchema = z.object({ userIds: z.array(z.string().min(1).max(64)).min(1).max(50) });

function pairKeyFor(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function previewOf(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

class ConversationController {
  private async assertMember(conversationId: string, userId: string) {
    return prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  }

  async listInbox(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const memberships = await prisma.conversationMember.findMany({
        where: { userId },
        include: {
          conversation: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } },
                },
              },
            },
          },
        },
        orderBy: { conversation: { lastMessageAt: 'desc' } },
      });
      const inbox = memberships.map((m: any) => {
        const others = m.conversation.members
          .filter((mem: any) => mem.userId !== userId)
          .map((mem: any) => mem.user);
        const lastAt = m.conversation.lastMessageAt;
        const unread = lastAt && (!m.lastReadAt || m.lastReadAt < lastAt) ? 1 : 0;
        return {
          id: m.conversation.id,
          type: m.conversation.type,
          title: m.conversation.title,
          description: m.conversation.description || null,
          avatarUrl: m.conversation.avatarUrl || null,
          isPublic: m.conversation.isPublic || false,
          createdBy: m.conversation.createdBy || null,
          lastMessageAt: m.conversation.lastMessageAt,
          lastMessagePreview: m.conversation.lastMessagePreview,
          muted: m.muted,
          lastReadAt: m.lastReadAt,
          unreadHint: unread,
          peers: others,
          members: m.conversation.members.map((mem: any) => ({
            userId: mem.userId,
            role: mem.role,
            user: mem.user,
          })),
        };
      });
      res.status(200).json({ success: true, conversations: inbox });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'List inbox error');
      res.status(500).json({ error: 'Failed to load conversations' });
    }
  }

  async startOrGetDm(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || startDmSchema.parse(req.body);
      const peerId: string = data.userId;
      if (peerId === userId) { res.status(400).json({ error: 'Cannot start a DM with yourself' }); return; }
      const peer = await prisma.user.findUnique({
        where: { id: peerId },
        select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true },
      });
      if (!peer) { res.status(404).json({ error: 'User not found' }); return; }
      const blocked = await prisma.userFollow.findFirst({
        where: { status: 'BLOCKED', OR: [ { followerId: userId, followeeId: peerId }, { followerId: peerId, followeeId: userId } ] },
      });
      if (blocked) { res.status(403).json({ error: 'Unable to message this user' }); return; }
      const pairKey = pairKeyFor(userId, peerId);
      let conversation = await prisma.conversation.findUnique({
        where: { pairKey },
        include: {
          members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } },
          },
        },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { type: 'DIRECT', pairKey, members: { create: [{ userId }, { userId: peerId }] } },
          include: {
            members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } },
            },
          },
        });
      }
      const peers = (conversation as any).members.filter((m: any) => m.userId !== userId).map((m: any) => m.user);
      res.status(200).json({ success: true, conversation: { id: conversation.id, type: conversation.type, lastMessageAt: conversation.lastMessageAt, lastMessagePreview: conversation.lastMessagePreview, peers } });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Start DM error');
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  }

  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const before = req.query.before as string | undefined;
      const limit = Math.min(Number(req.query.limit || 50), 100);
      const member = await this.assertMember(conversationId, userId);
      if (!member) { res.status(403).json({ error: 'Access denied' }); return; }
      const history = await prisma.message.findMany({
        where: { conversationId, isSoftDeleted: false, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
      });
      const reversed = history.reverse();
      res.status(200).json({ success: true, messages: reversed, nextCursor: reversed.length > 0 ? reversed[0].createdAt.toISOString() : null });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Get DM messages error');
      res.status(500).json({ error: 'Failed to load messages' });
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = (req as any).validatedBody || sendDmSchema.parse(req.body);
      if (!(await this.assertMember(conversationId, userId))) { res.status(403).json({ error: 'Access denied' }); return; }
      const now = new Date();
      const message = await prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: { conversationId, senderId: userId, content: data.content, messageType: data.messageType, deliveredAt: now },
          include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        });
        await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: previewOf(data.content) } });
        await tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: now } });
        return created;
      });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'new_dm', message);
      res.status(201).json({ success: true, message });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Send DM error');
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  async markRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!(await this.assertMember(conversationId, userId))) { res.status(403).json({ error: 'Access denied' }); return; }
      const now = new Date();
      await prisma.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadAt: now } });
      await prisma.message.updateMany({ where: { conversationId, senderId: { not: userId }, readAt: null, isSoftDeleted: false }, data: { readAt: now } });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'read_receipt', { conversationId, userId, readAt: now.toISOString() });
      res.status(200).json({ success: true, readAt: now.toISOString() });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Mark read error');
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  }

  async createGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const data = (req as any).validatedBody || createGroupSchema.parse(req.body);
      const memberIds = [...new Set([userId, ...data.memberIds])].filter((id) => id !== userId);
      const users = await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } });
      const foundIds = new Set(users.map((u: any) => u.id));
      const missing = memberIds.filter((id) => !foundIds.has(id));
      if (missing.length > 0) { res.status(404).json({ error: `User(s) not found: ${missing.join(', ')}` }); return; }
      const blocked = await prisma.userFollow.findFirst({ where: { status: 'BLOCKED', OR: [ { followerId: userId, followeeId: { in: memberIds } }, { followerId: { in: memberIds }, followeeId: userId } ] } });
      if (blocked) { res.status(403).json({ error: 'Cannot create group: blocked relationship exists' }); return; }
      const conversation: any = await prisma.$transaction(async (tx) => {
        const created = await tx.conversation.create({
          data: { type: 'GROUP', title: data.title, description: data.description, avatarUrl: data.avatarUrl, isPublic: data.isPublic ?? false, createdBy: userId, members: { create: [ { userId, role: 'ADMIN' as any }, ...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as any })) ] } },
          include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } },
          },
        });
        await tx.message.create({ data: { conversationId: created.id, senderId: userId, content: 'Group "' + data.title + '" created', messageType: 'SYSTEM' } });
        return created;
      });
      const peers = (conversation as any).members.filter((m: any) => m.userId !== userId).map((m: any) => m.user);
      await chatBroker.broadcastToRoom('dm_' + conversation.id, 'group_created', { conversationId: conversation.id, title: conversation.title, members: (conversation as any).members.map((m: any) => m.user) });
      res.status(201).json({ success: true, conversation: { id: conversation.id, type: conversation.type, title: conversation.title, description: conversation.description, avatarUrl: conversation.avatarUrl, isPublic: conversation.isPublic, createdBy: conversation.createdBy, lastMessageAt: conversation.lastMessageAt, lastMessagePreview: conversation.lastMessagePreview, peers, members: conversation.members.map((m: any) => ({ userId: m.userId, role: m.role, user: m.user })) } });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Create group error');
      res.status(500).json({ error: 'Failed to create group' });
    }
  }

  async updateGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = (req as any).validatedBody || updateGroupSchema.parse(req.body);
      const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!membership) { res.status(403).json({ error: 'Access denied' }); return; }
      if (membership.role !== 'ADMIN') { res.status(403).json({ error: 'Only group admins can update group info' }); return; }
      const updated = await prisma.conversation.update({ where: { id: conversationId }, data: { ...(data.title !== undefined && { title: data.title }), ...(data.description !== undefined && { description: data.description }), ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }), ...(data.isPublic !== undefined && { isPublic: data.isPublic }) }, include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } } } });
      const peers = updated.members.filter((m: any) => m.userId !== userId).map((m: any) => m.user);
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'group_updated', { conversationId: updated.id, title: updated.title, description: updated.description, avatarUrl: updated.avatarUrl, isPublic: updated.isPublic });
      res.status(200).json({ success: true, conversation: { id: updated.id, type: updated.type, title: updated.title, description: updated.description, avatarUrl: updated.avatarUrl, isPublic: updated.isPublic, createdBy: updated.createdBy, lastMessageAt: updated.lastMessageAt, lastMessagePreview: updated.lastMessagePreview, peers, members: updated.members.map((m: any) => ({ userId: m.userId, role: m.role, user: m.user })) } });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Update group error');
      res.status(500).json({ error: 'Failed to update group' });
    }
  }

  async addMembers(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = (req as any).validatedBody || addMembersSchema.parse(req.body);
      const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!membership || membership.role !== 'ADMIN') { res.status(403).json({ error: 'Only group admins can add members' }); return; }
      const existingMembers = await prisma.conversationMember.findMany({ where: { conversationId, userId: { in: data.userIds } }, select: { userId: true } });
      const existingIds = new Set(existingMembers.map((m: any) => m.userId));
      const newIds = data.userIds.filter((id: string) => !existingIds.has(id) && id !== userId);
      if (newIds.length === 0) { res.status(400).json({ error: 'All specified users are already members or invalid' }); return; }
      const users = await prisma.user.findMany({ where: { id: { in: newIds } }, select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } });
      const foundIds = new Set(users.map((u: any) => u.id));
      const missing = newIds.filter((id: string) => !foundIds.has(id));
      if (missing.length > 0) { res.status(404).json({ error: `User(s) not found: ${missing.join(', ')}` }); return; }
      const blocked = await prisma.userFollow.findFirst({ where: { status: 'BLOCKED', OR: [ { followerId: userId, followeeId: { in: newIds } }, { followerId: { in: newIds }, followeeId: userId } ] } });
      if (blocked) { res.status(403).json({ error: 'Cannot add member: blocked relationship exists' }); return; }
      await prisma.conversationMember.createMany({ data: newIds.map((id: string) => ({ conversationId, userId: id, role: 'MEMBER' as any })) });
      const now = new Date();
      await prisma.message.createMany({ data: newIds.map((id: string) => ({ conversationId, senderId: userId, content: (users.find((u: any) => u.id === id)?.name || 'A user') + ' was added to the group', messageType: 'SYSTEM', createdAt: now })) });
      const updatedConversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { members: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, isVerified: true } } } } } });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'member_added', { conversationId, members: (updatedConversation?.members || []).map((m: any) => ({ userId: m.userId, role: m.role, user: m.user })) });
      res.status(200).json({ success: true, members: updatedConversation?.members.map((m: any) => ({ userId: m.userId, role: m.role, user: m.user })) });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Add members error');
      res.status(500).json({ error: 'Failed to add members' });
    }
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : (req.params as any).userId;
      if (targetUserId === userId) { res.status(400).json({ error: 'Use leave group to remove yourself' }); return; }
      const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!membership) { res.status(403).json({ error: 'Access denied' }); return; }
      const targetMembership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: targetUserId } }, include: { user: true } });
      if (!targetMembership) { res.status(404).json({ error: 'Member not found' }); return; }
      if (membership.role !== 'ADMIN') { res.status(403).json({ error: 'Only group admins can remove members' }); return; }
      await prisma.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId: targetUserId } } });
      await prisma.message.create({ data: { conversationId, senderId: userId, content: `${targetMembership.user?.name || 'A user'} was removed from the group`, messageType: 'SYSTEM' } });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'member_removed', { conversationId, userId: targetUserId });
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Remove member error');
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  async leaveGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } }, include: { user: true } });
      if (!membership) { res.status(403).json({ error: 'Access denied' }); return; }
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { members: { where: { role: 'ADMIN' } } } });
      if (!conversation) { res.status(404).json({ error: 'Conversation not found' }); return; }
      const isLastAdmin = membership.role === 'ADMIN' && conversation.members.filter((m: any) => m.role === 'ADMIN').length <= 1;
      await prisma.$transaction(async (tx) => {
        await tx.conversationMember.delete({ where: { conversationId_userId: { conversationId, userId } } });
        await tx.message.create({ data: { conversationId, senderId: userId, content: isLastAdmin ? 'Group dissolved (last admin left)' : `${membership.user?.name || 'A user'} left the group`, messageType: 'SYSTEM' } });
        if (isLastAdmin) {
          const nextAdmin = await tx.conversationMember.findFirst({ where: { conversationId }, orderBy: { joinedAt: 'asc' }, include: { user: true } });
          if (nextAdmin) { await tx.conversationMember.update({ where: { id: nextAdmin.id }, data: { role: 'ADMIN' } }); await tx.message.create({ data: { conversationId, senderId: userId, content: `${nextAdmin.user?.name || 'A user'} is now a group admin`, messageType: 'SYSTEM' } }); }
          else { await tx.conversation.delete({ where: { id: conversationId } }); }
        }
      });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'member_removed', { conversationId, userId });
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Leave group error');
      res.status(500).json({ error: 'Failed to leave group' });
    }
  }

  async transferAdmin(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : (req.params as any).userId;
      if (targetUserId === userId) { res.status(400).json({ error: 'Cannot transfer admin to yourself' }); return; }
      const membership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
      if (!membership || membership.role !== 'ADMIN') { res.status(403).json({ error: 'Only group admins can transfer admin' }); return; }
      const targetMembership = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId, userId: targetUserId } }, include: { user: true } });
      if (!targetMembership) { res.status(404).json({ error: 'Target user is not a member' }); return; }
      await prisma.$transaction(async (tx) => {
        await tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { role: 'MEMBER' } });
        await tx.conversationMember.update({ where: { conversationId_userId: { conversationId, userId: targetUserId } }, data: { role: 'ADMIN' } });
        await tx.message.create({ data: { conversationId, senderId: userId, content: `${targetMembership.user?.name || 'A user'} is now a group admin`, messageType: 'SYSTEM' } });
      });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'admin_transferred', { conversationId, newAdminId: targetUserId });
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Transfer admin error');
      res.status(500).json({ error: 'Failed to transfer admin' });
    }
  }

  async dissolveGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.sub;
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { members: { where: { userId }, include: { user: true } } } });
      if (!conversation || conversation.type !== 'GROUP') { res.status(404).json({ error: 'Group not found' }); return; }
      const membership = conversation.members[0];
      if (!membership || membership.role !== 'ADMIN') { res.status(403).json({ error: 'Only group admins can dissolve the group' }); return; }
      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({ where: { conversationId } });
        await tx.conversationMember.deleteMany({ where: { conversationId } });
        await tx.conversation.delete({ where: { id: conversationId } });
      });
      await chatBroker.broadcastToRoom('dm_' + conversationId, 'group_dissolved', { conversationId });
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error({ err: error, path: req.path }, 'Dissolve group error');
      res.status(500).json({ error: 'Failed to dissolve group' });
    }
  }
}

export const conversationController = new ConversationController();