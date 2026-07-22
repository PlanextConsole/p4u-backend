import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { PropertyListing } from '../entities/PropertyListing';

function view(row: PropertyListing) {
  const d: any = row.details || {}; const m: any = row.metadata || {};
  return { ...row, transaction_type: row.listingType, property_type: row.propertyType, moderation_status: row.moderationStatus, status: row.moderationStatus, user_id: row.customerId, image_url: d.imageUrl || d.coverImage || m.imageUrl || '', cover_image: d.coverImage || d.imageUrl || '', images: d.images || [], description: d.description || '', bhk: d.bhk ?? null, area_sqft: d.areaSqft ?? d.area_sqft ?? null, amenities: d.amenities || [] };
}

export class PropertyService {
  private repo = AppDataSource.getRepository(PropertyListing);
  async list(input: { q?: string; type?: string; propertyType?: string; minPrice?: number; maxPrice?: number; limit: number; offset: number }) {
    const qb = this.repo.createQueryBuilder('p').where("p.moderationStatus IN ('approved','verified')");
    if (input.q) qb.andWhere('(p.title LIKE :q OR p.city LIKE :q OR p.locality LIKE :q)', { q: `%${input.q}%` });
    if (input.type) qb.andWhere('p.listingType = :type', { type: input.type });
    if (input.propertyType) qb.andWhere('p.propertyType = :propertyType', { propertyType: input.propertyType });
    if (Number.isFinite(input.minPrice)) qb.andWhere('p.price >= :minPrice', { minPrice: input.minPrice });
    if (Number.isFinite(input.maxPrice)) qb.andWhere('p.price <= :maxPrice', { maxPrice: input.maxPrice });
    const [items, total] = await qb.orderBy('p.createdAt','DESC').take(input.limit).skip(input.offset).getManyAndCount();
    return { items: items.map(view), total, limit: input.limit, offset: input.offset };
  }
  async get(id: string, customerId?: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row || (!['approved','verified'].includes(row.moderationStatus) && row.customerId !== customerId)) return null;
    return view(row);
  }
  async my(customerId: string) { return (await this.repo.find({ where: { customerId }, order: { createdAt: 'DESC' } })).map(view); }
  async create(customerId: string, input: any) {
    const title = String(input.title || '').trim(); if (title.length < 5) throw new Error('Property title must contain at least 5 characters');
    const price = Number(input.price || 0); if (!Number.isFinite(price) || price <= 0) throw new Error('Valid property price is required');
    const images = Array.isArray(input.images) ? input.images.map(String).filter(Boolean).slice(0, 20) : [];
    const row = this.repo.create({ customerId, title, locality: String(input.locality || '').trim() || null, city: String(input.city || '').trim() || null, listingType: String(input.transaction_type || input.listingType || 'rent').toLowerCase(), propertyType: String(input.property_type || input.propertyType || 'Apartment'), price: price.toFixed(2), postedBy: String(input.posted_by || 'Owner'), photoCount: images.length, moderationStatus: 'pending', isReported: false, isAutoFlagged: false, submittedAt: new Date(), details: { description: String(input.description || '').trim(), areaSqft: Number(input.area_sqft || input.areaSqft || 0), bhk: Number(input.bhk || 0) || null, images, coverImage: images[0] || input.cover_image || input.image_url || '', amenities: Array.isArray(input.amenities) ? input.amenities.map(String) : [] }, metadata: { contactPreference: input.contactPreference || 'chat' } });
    return view(await this.repo.save(row));
  }
  async update(customerId: string, id: string, input: any) {
    const row = await this.repo.findOne({ where: { id, customerId } }); if (!row) throw new Error('Property not found');
    if (!['pending','rejected'].includes(row.moderationStatus)) throw new Error('Only pending or rejected listings can be edited');
    if (input.title !== undefined) row.title = String(input.title).trim(); if (input.price !== undefined) row.price = Number(input.price).toFixed(2);
    if (input.city !== undefined) row.city = String(input.city).trim() || null; if (input.locality !== undefined) row.locality = String(input.locality).trim() || null;
    const details: any = { ...(row.details || {}) }; if (input.description !== undefined) details.description = String(input.description); if (input.images) { details.images = input.images.map(String).slice(0,20); details.coverImage = details.images[0] || ''; row.photoCount = details.images.length; } row.details = details; row.moderationStatus = 'pending'; row.submittedAt = new Date();
    return view(await this.repo.save(row));
  }
  async remove(customerId: string, id: string) { const row = await this.repo.findOne({ where: { id, customerId } }); if (!row) throw new Error('Property not found'); await this.repo.remove(row); }
  async inquire(senderId: string, propertyId: string, message: string) {
    const property = await this.repo.findOne({ where: { id: propertyId } }); if (!property || !['approved','verified'].includes(property.moderationStatus)) throw new Error('Property not found');
    const text = message.trim(); if (text.length < 2) throw new Error('Inquiry message is required'); const id = randomUUID();
    await AppDataSource.query('INSERT INTO property_inquiries (id,property_id,sender_id,owner_id,message,status) VALUES (?,?,?,?,?,?)',[id,propertyId,senderId,property.customerId,text,'open']); return { id, propertyId, senderId, ownerId: property.customerId, message: text, status: 'open' };
  }
  async messages(customerId: string) { return AppDataSource.query('SELECT * FROM property_inquiries WHERE owner_id = ? OR sender_id = ? ORDER BY created_at DESC',[customerId,customerId]); }
  async saveSearch(customerId: string, input: any) { const id=randomUUID(); await AppDataSource.query('INSERT INTO property_saved_searches (id,customer_id,name,query_json,notify) VALUES (?,?,?,?,?)',[id,customerId,String(input.name||'Saved search'),JSON.stringify(input.query||input),input.notify?1:0]); return {id,...input}; }
  async savedSearches(customerId: string) { const rows:any[]=await AppDataSource.query('SELECT * FROM property_saved_searches WHERE customer_id=? ORDER BY created_at DESC',[customerId]); return rows.map(r=>({...r,query:typeof r.query_json==='string'?JSON.parse(r.query_json):r.query_json})); }
  async saveRent(customerId:string,input:any){const id=String(input.id||randomUUID());await AppDataSource.query('INSERT INTO property_rent_trackers (id,customer_id,property_name,monthly_rent,paid_months) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE property_name=VALUES(property_name),monthly_rent=VALUES(monthly_rent),paid_months=VALUES(paid_months)',[id,customerId,String(input.property_name||input.propertyName||''),Number(input.monthly_rent||input.monthlyRent||0),JSON.stringify(input.paid_months||[])]);return{id,...input};}
  async rent(customerId:string){return AppDataSource.query('SELECT * FROM property_rent_trackers WHERE customer_id=? ORDER BY updated_at DESC',[customerId]);}
  async estimate(input:{city?:string;propertyType?:string;bhk?:number}){const qb=this.repo.createQueryBuilder('p').where("p.moderationStatus IN ('approved','verified')");if(input.city)qb.andWhere('p.city=:city',{city:input.city});if(input.propertyType)qb.andWhere('p.propertyType=:pt',{pt:input.propertyType});const rows=await qb.getMany();const prices=rows.map(r=>Number(r.price)).filter(n=>n>0).sort((a,b)=>a-b);if(!prices.length)return{low:0,average:0,high:0,sampleSize:0};return{low:prices[0],average:prices.reduce((a,b)=>a+b,0)/prices.length,high:prices[prices.length-1],sampleSize:prices.length};}
}