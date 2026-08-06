import { prisma } from '../config/db';

export enum PaymentStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

export interface PaymentRecord {
  id?: string;
  transactionId: string;
  eventId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  status: PaymentStatus;
  gatewayReference?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export class PaymentModel {
  public static async create(record: PaymentRecord): Promise<PaymentRecord> {
    const created = await prisma.payment.create({
      data: {
        transactionId: record.transactionId,
        eventId: record.eventId,
        userId: record.userId,
        amount: record.amount,
        currency: record.currency,
        paymentMethod: record.paymentMethod as any,
        customerPhone: record.customerPhone,
        customerEmail: record.customerEmail,
        status: record.status as any,
        provider: 'manual',
        idempotencyKey: record.transactionId,
      },
    });

    return {
      ...record,
      id: created.id,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  public static async updateStatus(
    transactionId: string,
    status: PaymentStatus,
    gatewayReference?: string | null,
    errorMessage?: string | null
  ): Promise<PaymentRecord | null> {
    const updated = await prisma.payment.update({
      where: { transactionId },
      data: {
        status: status as any,
        gatewayReference,
        errorMessage,
      },
    });

    return {
      id: updated.id,
      transactionId: updated.transactionId,
      eventId: updated.eventId,
      userId: updated.userId,
      amount: Number(updated.amount),
      currency: updated.currency,
      paymentMethod: updated.paymentMethod,
      customerPhone: updated.customerPhone,
      customerEmail: updated.customerEmail,
      status: updated.status as PaymentStatus,
      gatewayReference: updated.gatewayReference,
      errorMessage: updated.errorMessage,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  public static async findByTransactionId(transactionId: string): Promise<PaymentRecord | null> {
    const payment = await prisma.payment.findUnique({ where: { transactionId } });
    if (!payment) return null;

    return {
      id: payment.id,
      transactionId: payment.transactionId,
      eventId: payment.eventId,
      userId: payment.userId,
      amount: Number(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      customerPhone: payment.customerPhone,
      customerEmail: payment.customerEmail,
      status: payment.status as PaymentStatus,
      gatewayReference: payment.gatewayReference,
      errorMessage: payment.errorMessage,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }
}
