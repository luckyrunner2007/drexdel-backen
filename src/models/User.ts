import { prisma } from '../config/db';

export interface UserDatabaseDocument {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  role: string;
  passwordHash: string;
  escrowWalletBalance: number;
  devicePushToken?: string;
  isAccountLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  public static async create(document: UserDatabaseDocument): Promise<UserDatabaseDocument> {
    const created = await prisma.user.create({
      data: {
        id: document.id,
        email: document.email,
        name: document.name,
        role: document.role as any,
        passwordHash: document.passwordHash,
        escrowBalance: document.escrowWalletBalance,
        devicePushToken: document.devicePushToken,
        isAccountLocked: document.isAccountLocked,
      },
    });

    return {
      ...document,
      id: created.id,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    } as UserDatabaseDocument;
  }

  public static async findById(id: string): Promise<UserDatabaseDocument | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber || undefined,
      role: user.role as any,
      passwordHash: user.passwordHash,
      escrowWalletBalance: Number(user.escrowBalance),
      devicePushToken: user.devicePushToken || undefined,
      isAccountLocked: user.isAccountLocked,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as UserDatabaseDocument;
  }

  public static async findByEmailOrPhone(identity: string): Promise<UserDatabaseDocument | null> {
    const cleanIdentity = identity.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentity },
          { phoneNumber: identity },
        ],
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phoneNumber: user.phoneNumber || undefined,
      role: user.role as any,
      passwordHash: user.passwordHash,
      escrowWalletBalance: Number(user.escrowBalance),
      devicePushToken: user.devicePushToken || undefined,
      isAccountLocked: user.isAccountLocked,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } as UserDatabaseDocument;
  }

  public static async pushAttendedEventId(userId: string, eventId: string): Promise<boolean> {
    const existing = await prisma.userAttendedEvent.findFirst({
      where: { userId, eventId },
    });

    if (existing) return true;

    await prisma.userAttendedEvent.create({
      data: {
        userId,
        eventId,
      },
    });

    return true;
  }
}
