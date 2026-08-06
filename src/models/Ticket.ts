import { prisma } from '../config/db';
import { EncryptedTicket } from '../@types/drexdel_app_types';

export class TicketModel {
  public static async create(ticket: EncryptedTicket): Promise<EncryptedTicket> {
    const created = await prisma.ticket.create({
      data: {
        id: ticket.id,
        transactionId: ticket.id,
        eventId: ticket.eventId,
        userId: ticket.userId,
        tierId: ticket.tierId,
        cryptographicToken: ticket.cryptographicToken,
        qrCodeString: ticket.qrCodeString,
        status: ticket.status.toUpperCase() as any,
      },
    });

    return {
      ...ticket,
      id: created.id,
      status: created.status.toLowerCase() as EncryptedTicket['status'],
    };
  }

  public static async findById(ticketId: string): Promise<EncryptedTicket | null> {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return null;

    return {
      id: ticket.id,
      eventId: ticket.eventId,
      userId: ticket.userId,
      tierId: ticket.tierId,
      purchaseTimestamp: ticket.createdAt.toISOString(),
      cryptographicToken: ticket.cryptographicToken,
      qrCodeString: ticket.qrCodeString,
      status: ticket.status.toLowerCase() as EncryptedTicket['status'],
    };
  }
}
