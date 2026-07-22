import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { PropertyListing } from '../entities/PropertyListing';

function firstImageUrl(details: any, metadata: any): string {
  const pick = (v: unknown): string => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const direct = [
    details?.imageUrl,
    details?.coverImage,
    details?.image_url,
    details?.cover_image,
    metadata?.imageUrl,
    metadata?.coverImage,
    metadata?.image_url,
    metadata?.cover_image,
  ];
  for (const c of direct) {
    const hit = pick(c);
    if (hit) return hit;
  }
  const pools = [details?.images, details?.photos, metadata?.images, metadata?.photos];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const img of pool) {
      if (typeof img === 'string') {
        const hit = pick(img);
        if (hit) return hit;
      } else if (img && typeof img === 'object') {
        const hit = pick(
          (img as any).url ||
            (img as any).src ||
            (img as any).path ||
            (img as any).imageUrl ||
            (img as any).image_url,
        );
        if (hit) return hit;
      }
    }
  }
  return '';
}

function imageList(details: any, metadata: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: string) => {
    if (!v || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  const cover = firstImageUrl(details, metadata);
  if (cover) push(cover);
  for (const pool of [details?.images, details?.photos, metadata?.images]) {
    if (!Array.isArray(pool)) continue;
    for (const img of pool) {
      if (typeof img === 'string') push(img.trim());
      else if (img && typeof img === 'object') {
        const u = String((img as any).url || (img as any).src || (img as any).path || (img as any).imageUrl || '').trim();
        if (u) push(u);
      }
    }
  }
  return out;
}

function view(row: PropertyListing) {
  const details: any = row.details || {};
  const metadata: any = row.metadata || {};
  const images = imageList(details, metadata);
  const cover = images[0] || '';
  return {
    ...row,
    transaction_type: row.listingType,
    property_type: row.propertyType,
    moderation_status: row.moderationStatus,
    status: row.moderationStatus,
    user_id: row.customerId,
    photoCount: Math.max(Number(row.photoCount || 0), images.length),
    image_url: cover,
    cover_image: cover,
    images,
    description: details.description || '',
    bhk: details.bhk ?? null,
    area_sqft: details.areaSqft ?? details.area_sqft ?? null,
    amenities: details.amenities || [],
  };
}

export class PropertyService {
  private repo = AppDataSource.getRepository(PropertyListing);

  async list(input: {
    q?: string;
    type?: string;
    propertyType?: string;
    minPrice?: number;
    maxPrice?: number;
    limit: number;
    offset: number;
  }) {
    const qb = this.repo
      .createQueryBuilder('p')
      .where("p.moderationStatus IN ('approved','verified')");
    if (input.q) {
      qb.andWhere('(p.title ILIKE :q OR p.city ILIKE :q OR p.locality ILIKE :q)', {
        q: `%${input.q}%`,
      });
    }
    if (input.type) qb.andWhere('p.listingType = :type', { type: input.type.toLowerCase() });
    if (input.propertyType) {
      qb.andWhere('LOWER(p.propertyType) = LOWER(:propertyType)', {
        propertyType: input.propertyType,
      });
    }
    if (Number.isFinite(input.minPrice)) {
      qb.andWhere('p.price >= :minPrice', { minPrice: input.minPrice });
    }
    if (Number.isFinite(input.maxPrice)) {
      qb.andWhere('p.price <= :maxPrice', { maxPrice: input.maxPrice });
    }
    const [items, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .take(input.limit)
      .skip(input.offset)
      .getManyAndCount();
    return { items: items.map(view), total, limit: input.limit, offset: input.offset };
  }

  async get(id: string, customerId?: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (
      !row ||
      (!['approved', 'verified'].includes(row.moderationStatus) && row.customerId !== customerId)
    ) {
      return null;
    }
    return view(row);
  }

  async my(customerId: string) {
    const rows = await this.repo.find({ where: { customerId }, order: { createdAt: 'DESC' } });
    return rows.map(view);
  }

  async create(customerId: string, input: any) {
    const title = String(input.title || '').trim();
    if (title.length < 5) throw new Error('Property title must contain at least 5 characters');
    const price = Number(input.price || 0);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Valid property price is required');
    const images = Array.isArray(input.images)
      ? input.images.map(String).filter(Boolean).slice(0, 20)
      : [];
    const row = this.repo.create({
      customerId,
      title,
      locality: String(input.locality || '').trim() || null,
      city: String(input.city || '').trim() || null,
      listingType: String(input.transaction_type || input.listingType || 'rent').toLowerCase(),
      propertyType: String(input.property_type || input.propertyType || 'Apartment'),
      price: price.toFixed(2),
      postedBy: String(input.posted_by || 'Owner'),
      photoCount: images.length,
      moderationStatus: 'pending',
      isReported: false,
      isAutoFlagged: false,
      submittedAt: new Date(),
      details: {
        description: String(input.description || '').trim(),
        areaSqft: Number(input.area_sqft || input.areaSqft || 0),
        bhk: Number(input.bhk || 0) || null,
        images,
        coverImage: images[0] || input.cover_image || input.image_url || '',
        amenities: Array.isArray(input.amenities) ? input.amenities.map(String) : [],
      },
      metadata: { contactPreference: input.contactPreference || 'chat' },
    });
    return view(await this.repo.save(row));
  }

  async update(customerId: string, id: string, input: any) {
    const row = await this.repo.findOne({ where: { id, customerId } });
    if (!row) throw new Error('Property not found');
    if (!['pending', 'rejected'].includes(row.moderationStatus)) {
      throw new Error('Only pending or rejected listings can be edited');
    }
    if (input.title !== undefined) {
      const title = String(input.title).trim();
      if (title.length < 5) throw new Error('Property title must contain at least 5 characters');
      row.title = title;
    }
    if (input.price !== undefined) {
      const price = Number(input.price);
      if (!Number.isFinite(price) || price <= 0) throw new Error('Valid property price is required');
      row.price = price.toFixed(2);
    }
    if (input.city !== undefined) row.city = String(input.city).trim() || null;
    if (input.locality !== undefined) row.locality = String(input.locality).trim() || null;
    if (input.transaction_type !== undefined || input.listingType !== undefined) {
      row.listingType = String(input.transaction_type || input.listingType).toLowerCase();
    }
    if (input.property_type !== undefined || input.propertyType !== undefined) {
      row.propertyType = String(input.property_type || input.propertyType);
    }
    const details: any = { ...(row.details || {}) };
    if (input.description !== undefined) details.description = String(input.description).trim();
    if (input.area_sqft !== undefined || input.areaSqft !== undefined) {
      details.areaSqft = Number(input.area_sqft ?? input.areaSqft ?? 0);
    }
    if (input.bhk !== undefined) details.bhk = Number(input.bhk) || null;
    if (Array.isArray(input.amenities)) details.amenities = input.amenities.map(String);
    if (Array.isArray(input.images)) {
      details.images = input.images.map(String).filter(Boolean).slice(0, 20);
      details.coverImage = details.images[0] || '';
      row.photoCount = details.images.length;
    }
    row.details = details;
    row.moderationStatus = 'pending';
    row.submittedAt = new Date();
    return view(await this.repo.save(row));
  }

  async remove(customerId: string, id: string) {
    const row = await this.repo.findOne({ where: { id, customerId } });
    if (!row) throw new Error('Property not found');
    await this.repo.remove(row);
  }

  async inquire(senderId: string, propertyId: string, message: string) {
    const property = await this.repo.findOne({ where: { id: propertyId } });
    if (!property || !['approved', 'verified'].includes(property.moderationStatus)) {
      throw new Error('Property not found');
    }
    const text = message.trim();
    if (text.length < 2) throw new Error('Inquiry message is required');
    const id = randomUUID();
    await AppDataSource.query(
      'INSERT INTO property_inquiries (id, property_id, sender_id, owner_id, message, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, propertyId, senderId, property.customerId, text, 'open'],
    );
    return { id, propertyId, senderId, ownerId: property.customerId, message: text, status: 'open' };
  }

  async messages(customerId: string) {
    return AppDataSource.query(
      'SELECT * FROM property_inquiries WHERE owner_id = $1 OR sender_id = $1 ORDER BY created_at DESC',
      [customerId],
    );
  }

  async saveSearch(customerId: string, input: any) {
    const id = randomUUID();
    const name = String(input.name || 'Saved search').trim() || 'Saved search';
    const query = input.query || input;
    const notify = Boolean(input.notify);
    await AppDataSource.query(
      'INSERT INTO property_saved_searches (id, customer_id, name, query_json, notify) VALUES ($1, $2, $3, $4::json, $5)',
      [id, customerId, name, JSON.stringify(query), notify],
    );
    return { id, name, query, notify };
  }

  async savedSearches(customerId: string) {
    const rows: any[] = await AppDataSource.query(
      'SELECT * FROM property_saved_searches WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId],
    );
    return rows.map((row) => ({
      ...row,
      query: typeof row.query_json === 'string' ? JSON.parse(row.query_json) : row.query_json,
    }));
  }

  async saveRent(customerId: string, input: any) {
    const id = String(input.id || randomUUID());
    const propertyName = String(input.property_name || input.propertyName || '').trim();
    const monthlyRent = Number(input.monthly_rent || input.monthlyRent || 0);
    if (!propertyName) throw new Error('Property name is required');
    if (!Number.isFinite(monthlyRent) || monthlyRent <= 0) {
      throw new Error('Valid monthly rent is required');
    }
    const paidMonths = Array.isArray(input.paid_months || input.paidMonths)
      ? input.paid_months || input.paidMonths
      : [];
    const rows = await AppDataSource.query(
      `INSERT INTO property_rent_trackers
        (id, customer_id, property_name, monthly_rent, paid_months, updated_at)
       VALUES ($1, $2, $3, $4, $5::json, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         property_name = EXCLUDED.property_name,
         monthly_rent = EXCLUDED.monthly_rent,
         paid_months = EXCLUDED.paid_months,
         updated_at = CURRENT_TIMESTAMP
       WHERE property_rent_trackers.customer_id = EXCLUDED.customer_id
       RETURNING *`,
      [id, customerId, propertyName, monthlyRent, JSON.stringify(paidMonths)],
    );
    if (!rows.length) throw new Error('Rent tracker not found');
    return rows[0];
  }

  async rent(customerId: string) {
    return AppDataSource.query(
      'SELECT * FROM property_rent_trackers WHERE customer_id = $1 ORDER BY updated_at DESC',
      [customerId],
    );
  }

  async estimate(input: { city?: string; propertyType?: string; bhk?: number }) {
    const qb = this.repo
      .createQueryBuilder('p')
      .where("p.moderationStatus IN ('approved','verified')");
    if (input.city) qb.andWhere('p.city ILIKE :city', { city: input.city });
    if (input.propertyType) {
      qb.andWhere('LOWER(p.propertyType) = LOWER(:propertyType)', {
        propertyType: input.propertyType,
      });
    }
    if (input.bhk) {
      qb.andWhere("CAST(p.details ->> 'bhk' AS integer) = :bhk", { bhk: input.bhk });
    }
    const rows = await qb.getMany();
    const prices = rows
      .map((row) => Number(row.price))
      .filter((price) => price > 0)
      .sort((a, b) => a - b);
    if (!prices.length) return { low: 0, average: 0, high: 0, sampleSize: 0 };
    return {
      low: prices[0],
      average: prices.reduce((total, price) => total + price, 0) / prices.length,
      high: prices[prices.length - 1],
      sampleSize: prices.length,
    };
  }
}
