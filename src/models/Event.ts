import { prisma } from '../config/db';

export interface EventDatabaseDocument {
  id: string;
  title: string;
  description: string;
  location: string;
  date: Date;
  organizerId: string;
  category?: string;
  totalCapacity: number;
  ticketsSold: number;
  grossRevenue: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EventModel {
  public static async insertNewEvent(document: EventDatabaseDocument): Promise<EventDatabaseDocument> {
    const created = await prisma.event.create({
      data: {
        id: document.id,
        title: document.title,
        description: document.description || '',
        date: document.date || new Date(),
        location: document.location,
        category: document.category,
        status: 'PUBLISHED',
        organizerId: document.organizerId || '',
        totalCapacity: document.totalCapacity || 0,
        ticketsSold: document.ticketsSold || 0,
        grossRevenue: document.grossRevenue || 0,
      },
    });

    return {
      ...document,
      id: created.id,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    } as EventDatabaseDocument;
  }

  public static async findEventById(id: string): Promise<EventDatabaseDocument | null> {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return null;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      date: event.date,
      organizerId: event.organizerId,
      category: event.category || undefined,
      totalCapacity: event.totalCapacity,
      ticketsSold: event.ticketsSold,
      grossRevenue: Number(event.grossRevenue),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    } as EventDatabaseDocument;
  }

  public static async decrementInventoryAllocation(eventId: string, tierId: string, quantity: number): Promise<boolean> {
    const result = await prisma.$transaction(async (tx) => {
      const tier = await tx.ticketTier.findUnique({ where: { id: tierId } });
      if (!tier || !tier.isActive || tier.ticketsSold + quantity > tier.totalAllocation) {
        return false;
      }

      await tx.ticketTier.update({
        where: { id: tierId },
        data: { ticketsSold: { increment: quantity } },
      });

      await tx.event.update({
        where: { id: eventId },
        data: {
          ticketsSold: { increment: quantity },
        },
      });

      return true;
    });

    return result;
  }

  public static async retrieveAllActiveEvents(): Promise<EventDatabaseDocument[]> {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED' },
    });

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      date: event.date,
      organizerId: event.organizerId,
      category: event.category || undefined,
      totalCapacity: event.totalCapacity,
      ticketsSold: event.ticketsSold,
      grossRevenue: Number(event.grossRevenue),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    } as EventDatabaseDocument));
  }
}
