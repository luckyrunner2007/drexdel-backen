import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { cacheGet, cacheSet, getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

// Validation schemas
export const createEventSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  date: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  location: z.string().min(3).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: z.string().max(50).optional(),
  ticketTiers: z.array(z.object({
    name: z.string().min(1).max(100),
    price: z.number().min(0),
    currency: z.enum(['RWF', 'USD', 'EUR']).default('RWF'),
    totalAllocation: z.number().int().min(1).max(100000),
    maxPerUser: z.number().int().min(1).max(100).default(10),
  })).min(1).max(10),
});

export const listEventsSchema = z.object({
  page: z.preprocess((val) => typeof val === 'string' ? Number(val) : val, z.number().int().positive().default(1)),
  limit: z.preprocess((val) => typeof val === 'string' ? Number(val) : val, z.number().int().positive().max(100).default(20)),
  category: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  lat: z.preprocess((val) => typeof val === 'string' && val.trim() !== '' ? Number(val) : val, z.number().finite().optional()),
  lng: z.preprocess((val) => typeof val === 'string' && val.trim() !== '' ? Number(val) : val, z.number().finite().optional()),
  radiusKm: z.preprocess((val) => typeof val === 'string' ? Number(val) : val, z.number().positive().default(50)),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const query = (req as any).validatedQuery || listEventsSchema.parse(req.query);
    const { page, limit, category, status, lat, lng, radiusKm, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    // Cache key includes query params
    const cacheKey = `events:list:${page}:${limit}:${category || 'all'}:${status || 'all'}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    // Geo query (simplified — scale: use PostGIS for accurate radius)
    if (lat && lng) {
      // Approximate bounding box for performance
      const kmPerDegree = 111;
      const latDelta = radiusKm / kmPerDegree;
      const lngDelta = radiusKm / (kmPerDegree * Math.cos(lat * Math.PI / 180));
      
      where.latitude = { gte: lat - latDelta, lte: lat + latDelta };
      where.longitude = { gte: lng - lngDelta, lte: lng + lngDelta };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          ticketTiers: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              totalAllocation: true,
              ticketsSold: true,
              maxPerUser: true,
            }
          },
          organizer: {
            select: { id: true, name: true }
          }
        },
        orderBy: { date: 'asc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where })
    ]);

    const result = {
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + events.length < total
      }
    };

    // Cache for 5 minutes (scale: invalidate on event update)
    await cacheSet(cacheKey, JSON.stringify(result), 300);

    return res.status(200).json(result);
    
  } catch (error) {
    logger.error({ err: error }, 'Events list error');
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const data = (req as any).validatedBody || createEventSchema.parse(req.body);
    const organizerId = req.user!.sub;

    // Calculate total capacity from tiers
    const totalCapacity = data.ticketTiers.reduce((sum: number, t: any) => sum + t.totalAllocation, 0);

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          title: data.title,
          description: data.description,
          date: new Date(data.date),
          endDate: data.endDate ? new Date(data.endDate) : null,
          location: data.location,
          latitude: data.latitude,
          longitude: data.longitude,
          category: data.category,
          status: 'PUBLISHED', // or DRAFT if needs approval
          totalCapacity,
          organizerId,
          ticketTiers: {
            create: data.ticketTiers.map((tier: any) => ({
              name: tier.name,
              price: tier.price,
              currency: tier.currency,
              totalAllocation: tier.totalAllocation,
              maxPerUser: tier.maxPerUser,
            }))
          }
        },
        include: { ticketTiers: true }
      });

      return created;
    });

    try {
      const client = await getRedisClient();
      if (client) {
        const keys = await client.keys('events:list:*');
        if (keys.length > 0) await client.del(keys);
      }
    } catch (cacheError) {
      logger.warn({ err: cacheError }, 'Failed to invalidate event list cache');
    }

    return res.status(201).json(event);
    
  } catch (error) {
    logger.error({ err: error }, 'Events create error');
    return res.status(500).json({ error: 'Failed to create event' });
  }
};

export const getEventById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const cacheKey = `event:${id}`;
    
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        return res.status(200).json(JSON.parse(cached));
      } catch (cacheError) {
        logger.warn({ err: cacheError }, 'Failed to parse cached event data');
      }
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        ticketTiers: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            totalAllocation: true,
            ticketsSold: true,
            maxPerUser: true,
          }
        },
        organizer: {
          select: { id: true, name: true }
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    try {
      await cacheSet(cacheKey, JSON.stringify(event), 300);
    } catch (cacheError) {
      logger.warn({ err: cacheError }, 'Failed to cache event data');
    }

    return res.status(200).json(event);
    
  } catch (error) {
    logger.error({ err: error }, 'Events get by ID error');
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
};