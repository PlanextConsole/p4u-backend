import { DeepPartial, Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { HomesAmenity } from './entities/HomesAmenity';
import { HomesFilterOption } from './entities/HomesFilterOption';
import { HomesLocality } from './entities/HomesLocality';
import { HomesPlan } from './entities/HomesPlan';
import { HomesPropertyListing } from './entities/HomesPropertyListing';
import { HomesCmsContent } from './entities/HomesCmsContent';

type Kind = 'amenities' | 'filterOptions' | 'localities' | 'plans' | 'properties';

type ListFilters = { q?: string; type?: string; status?: string; includeInactive?: boolean; limit: number; offset: number };

export class HomesService {
  private audit = new AuditService();
  private seeded = false;

  private repo(kind: Kind): Repository<any> {
    if (kind === 'amenities') return AppDataSource.getRepository(HomesAmenity);
    if (kind === 'filterOptions') return AppDataSource.getRepository(HomesFilterOption);
    if (kind === 'localities') return AppDataSource.getRepository(HomesLocality);
    if (kind === 'plans') return AppDataSource.getRepository(HomesPlan);
    return AppDataSource.getRepository(HomesPropertyListing);
  }

  private cmsRepo(): Repository<HomesCmsContent> {
    return AppDataSource.getRepository(HomesCmsContent);
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    await this.ensureSchema();
    await this.cleanupDemoRows();
    this.seeded = true;
  }


  private async ensureSchema(): Promise<void> {
    if ((process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres') return;
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_amenities (
      id varchar(36) NOT NULL PRIMARY KEY,
      name varchar(120) NOT NULL,
      icon varchar(80) NULL,
      category varchar(80) NOT NULL DEFAULT 'General',
      sort_order int NOT NULL DEFAULT 0,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_amenities_name (name),
      INDEX IDX_homes_amenities_category (category),
      INDEX IDX_homes_amenities_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_filter_options (
      id varchar(36) NOT NULL PRIMARY KEY,
      filter_type varchar(80) NOT NULL,
      label varchar(120) NOT NULL,
      value varchar(120) NOT NULL,
      sort_order int NOT NULL DEFAULT 0,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_filter_type (filter_type),
      INDEX IDX_homes_filter_value (value),
      INDEX IDX_homes_filter_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_localities (
      id varchar(36) NOT NULL PRIMARY KEY,
      name varchar(140) NOT NULL,
      city varchar(120) NOT NULL,
      is_popular tinyint(1) NOT NULL DEFAULT 0,
      avg_rent decimal(12,2) NOT NULL DEFAULT 0,
      avg_sale_price decimal(14,2) NOT NULL DEFAULT 0,
      life_score decimal(4,1) NOT NULL DEFAULT 0,
      score_breakdown json NULL,
      seo_title varchar(255) NULL,
      seo_description text NULL,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_localities_name (name),
      INDEX IDX_homes_localities_city (city),
      INDEX IDX_homes_localities_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_plans (
      id varchar(36) NOT NULL PRIMARY KEY,
      plan_type varchar(32) NOT NULL DEFAULT 'owner',
      name varchar(120) NOT NULL,
      description text NULL,
      price decimal(12,2) NOT NULL DEFAULT 0,
      duration_days int NOT NULL DEFAULT 30,
      listing_limit int NOT NULL DEFAULT 0,
      contact_reveals int NOT NULL DEFAULT 0,
      visibility_boost tinyint(1) NOT NULL DEFAULT 0,
      features json NULL,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_plans_type (plan_type),
      INDEX IDX_homes_plans_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_property_listings (
      id varchar(36) NOT NULL PRIMARY KEY,
      title varchar(180) NOT NULL,
      locality varchar(140) NULL,
      city varchar(120) NULL,
      listing_type varchar(32) NOT NULL DEFAULT 'rent',
      property_type varchar(80) NOT NULL DEFAULT 'Apartment',
      price decimal(14,2) NOT NULL DEFAULT 0,
      posted_by varchar(120) NULL,
      photo_count int NOT NULL DEFAULT 0,
      moderation_status varchar(32) NOT NULL DEFAULT 'pending',
      is_reported tinyint(1) NOT NULL DEFAULT 0,
      is_auto_flagged tinyint(1) NOT NULL DEFAULT 0,
      submitted_at datetime NULL,
      details json NULL,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_properties_status (moderation_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS homes_cms_content (
      id varchar(36) NOT NULL PRIMARY KEY,
      content_type varchar(40) NOT NULL,
      title varchar(180) NOT NULL,
      content text NULL,
      image_url varchar(500) NULL,
      link_url varchar(500) NULL,
      start_date date NULL,
      end_date date NULL,
      sort_order int NOT NULL DEFAULT 0,
      is_active tinyint(1) NOT NULL DEFAULT 1,
      metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX IDX_homes_cms_type (content_type),
      INDEX IDX_homes_cms_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await this.ensureColumn('homes_amenities', 'sort_order', 'int NOT NULL DEFAULT 0');
    await this.ensureColumn('homes_filter_options', 'sort_order', 'int NOT NULL DEFAULT 0');
    await this.ensureColumn('homes_cms_content', 'sort_order', 'int NOT NULL DEFAULT 0');
    await this.ensureColumn('homes_cms_content', 'start_date', 'date NULL');
    await this.ensureColumn('homes_cms_content', 'end_date', 'date NULL');
  }

  private async ensureColumn(table: string, column: string, definition: string): Promise<void> {
    const rows = await AppDataSource.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, column]
    );
    if (Array.isArray(rows) && rows.length > 0) return;
    await AppDataSource.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  }

  private async cleanupDemoRows(): Promise<void> {
    await AppDataSource.query("DELETE FROM homes_plans WHERE (name = 'Free' AND description = 'Basic listing plan') OR (name = 'Standard' AND description = 'Standard listing plan with more features') OR (name = 'Premium' AND description = 'Premium plan with unlimited features')");
    await AppDataSource.query("DELETE FROM homes_property_listings WHERE posted_by LIKE 'Rahul Sharma%' OR title IN ('2 BHK Apartment in Beach Road Nagercoil','Luxurious 4 BHK Villa with Garden in Saibaba Colony','1 BHK Semi-Furnished near Gandhipuram Bus Stand','PG for Working Women in Peelamedu','2 BHK Fully Furnished Apartment in RS Puram','Furnished Office Space in Gandhipuram - 1500 sq.ft','3 BHK Independent House in Singanallur','Commercial Shop near T Nagar Main Road','Residential Plot in Vadavalli')");
    await AppDataSource.query("DELETE FROM homes_localities WHERE (city = 'Coimbatore' AND name IN ('RS Puram','Gandhipuram','Peelamedu','Saibaba Colony','Singanalur','Singanallur','Ganapathy','Vadavalli','Thudiyalur')) OR (city = 'Chennai' AND name IN ('Anna Nagar','T Nagar'))");
    await AppDataSource.query("DELETE FROM homes_amenities WHERE name IN ('Security Guard','CCTV','Gated Community','Swimming Pool','Gym','Clubhouse','Children Play Area')");
    await AppDataSource.query("DELETE FROM homes_filter_options WHERE (filter_type = 'Furnishing' AND label = 'Unfurnished') OR (filter_type = 'Bhk' AND label = 'Studio') OR (filter_type = 'Tenant Preference' AND label = 'Family') OR (filter_type = 'Age' AND label = 'Under Construction') OR (filter_type = 'Property Type' AND label IN ('Apartment','Independent House')) OR (filter_type = 'Facing' AND label IN ('North','South'))");
  }
  async listPropertyUsers(filters: ListFilters): Promise<{ items: any[]; total: number }> {
    await this.ensureSeeded();
    const properties = await this.repo('properties').find({ order: { createdAt: 'DESC' } });
    const owners = new Map<string, any>();

    for (const property of properties) {
      const rawName = String(property.postedBy || 'Unknown Owner');
      const name = rawName.replace(/\s*\(owner\)\s*$/i, '').trim() || 'Unknown Owner';
      const key = name.toLowerCase();
      if (!owners.has(key)) {
        owners.set(key, {
          id: `USR-${String(owners.size + 1).padStart(3, '0')}`,
          name,
          role: 'owner',
          listingCount: 0,
          listings: [],
        });
      }
      const owner = owners.get(key);
      owner.listingCount += 1;
      owner.listings.push({
        id: property.id,
        title: property.title,
        locality: property.locality,
        city: property.city,
        price: property.price,
        listingType: property.listingType,
        propertyType: property.propertyType,
        status: property.moderationStatus,
        verified: Boolean((property.details as any)?.verified || property.moderationStatus === 'verified'),
      });
    }

    let items = Array.from(owners.values());
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((owner) => owner.name.toLowerCase().includes(q) || owner.id.toLowerCase().includes(q));
    }
    const total = items.length;
    return { items: items.slice(filters.offset, filters.offset + filters.limit), total };
  }

  async listCmsContent(filters: ListFilters): Promise<{ items: HomesCmsContent[]; total: number }> {
    await this.ensureSeeded();
    const qb = this.cmsRepo().createQueryBuilder('x').take(filters.limit).skip(filters.offset);
    if (!filters.includeInactive) qb.andWhere('x.isActive = :active', { active: true });
    if (filters.type) qb.andWhere('x.contentType = :type', { type: filters.type });
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      qb.andWhere('(x.title LIKE :q OR x.content LIKE :q)', { q });
    }
    qb.orderBy('x.sortOrder', 'ASC').addOrderBy('x.createdAt', 'DESC');
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async createCmsContent(body: any, actorSub: string, ip?: string): Promise<HomesCmsContent> {
    await this.ensureSeeded();
    const repo = this.cmsRepo();
    const row = repo.create(this.normalizeCms(body) as DeepPartial<HomesCmsContent>);
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Homes:cms', entityId: row.id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async updateCmsContent(id: string, body: any, actorSub: string, ip?: string): Promise<HomesCmsContent> {
    await this.ensureSeeded();
    const row = await this.cmsRepo().findOne({ where: { id } });
    if (!row) throw new Error('Homes CMS content not found');
    Object.assign(row, this.normalizeCms(body));
    await this.cmsRepo().save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Homes:cms', entityId: id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async removeCmsContent(id: string, actorSub: string, ip?: string): Promise<void> {
    await this.ensureSeeded();
    const row = await this.cmsRepo().findOne({ where: { id } });
    if (!row) throw new Error('Homes CMS content not found');
    await this.cmsRepo().remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'Homes:cms', entityId: id, metadata: null, ipAddress: ip ?? null });
  }

  private normalizeCms(body: any): any {
    return {
      contentType: String(body.contentType || body.type || 'banners').trim(),
      title: String(body.title || '').trim(),
      content: body.content ?? null,
      imageUrl: body.imageUrl || null,
      linkUrl: body.linkUrl || null,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      sortOrder: Number(body.sortOrder || 0),
      isActive: body.isActive !== false,
      metadata: body.metadata ?? null,
    };
  }

  async getPropertyAnalytics(_range = '90d'): Promise<any> {
    await this.ensureSeeded();
    const properties = await this.repo('properties').find({ order: { createdAt: 'DESC' } });
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const countBy = (field: string) => {
      const map = new Map<string, number>();
      for (const property of properties) {
        const value = String((property as any)[field] || 'Unknown');
        map.set(value, (map.get(value) || 0) + 1);
      }
      return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    };
    const sumDetail = (key: string) => properties.reduce((sum, property) => sum + Number((property.details as any)?.[key] || 0), 0);

    const listingsByStatus = properties.reduce((items, property) => {
      const status = property.moderationStatus === 'pending' ? 'Submitted' : 'Active';
      items.set(status, (items.get(status) || 0) + 1);
      return items;
    }, new Map<string, number>());

    const monthly = properties.reduce((items, property) => {
      const date = property.submittedAt || property.createdAt;
      const key = date ? new Date(date).toISOString().slice(0, 7) : todayKey.slice(0, 7);
      items.set(key, (items.get(key) || 0) + 1);
      return items;
    }, new Map<string, number>());

    const topListings = properties
      .map((property) => ({
        id: property.id,
        title: property.title,
        locality: property.locality,
        city: property.city,
        price: property.price,
        views: Number((property.details as any)?.views || 0),
        enquiries: Number((property.details as any)?.enquiries || 0),
        contacts: Number((property.details as any)?.contacts || 0),
      }))
      .sort((a, b) => (b.views + b.enquiries + b.contacts) - (a.views + a.enquiries + a.contacts));

    return {
      metrics: {
        totalProperties: properties.length,
        activeListings: properties.filter((p) => ['approved', 'verified'].includes(p.moderationStatus)).length,
        addedToday: properties.filter((p) => new Date(p.createdAt).toISOString().slice(0, 10) === todayKey).length,
        totalViews: sumDetail('views'),
        contactsRevealed: sumDetail('contacts'),
        enquiries: sumDetail('enquiries'),
        visitRequests: sumDetail('visitRequests'),
        shortlisted: sumDetail('shortlisted'),
      },
      charts: {
        listingsByStatus: (Array.from(listingsByStatus.entries()) as [string, number][]).map(([label, value]) => ({ label, value })),
        transactionTypes: countBy('listingType'),
        topCities: countBy('city').sort((a, b) => b.value - a.value),
        monthlyNewListings: (Array.from(monthly.entries()) as [string, number][]).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })),
        dailyEnquiries: [{ label: '30 days', value: sumDetail('enquiries') }],
        propertyTypes: countBy('propertyType'),
      },
      topListings,
    };
  }

  async list(kind: Kind, filters: ListFilters): Promise<{ items: any[]; total: number }> {
    await this.ensureSeeded();
    const repo = this.repo(kind);
    const qb = repo.createQueryBuilder('x').take(filters.limit).skip(filters.offset);

    if (!filters.includeInactive && kind !== 'properties') qb.andWhere('x.isActive = :active', { active: true });
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      if (kind === 'amenities') qb.andWhere('(x.name LIKE :q OR x.icon LIKE :q OR x.category LIKE :q)', { q });
      else if (kind === 'filterOptions') qb.andWhere('(x.filterType LIKE :q OR x.label LIKE :q OR x.value LIKE :q)', { q });
      else if (kind === 'localities') qb.andWhere('(x.name LIKE :q OR x.city LIKE :q)', { q });
      else if (kind === 'plans') qb.andWhere('(x.name LIKE :q OR x.description LIKE :q)', { q });
      else qb.andWhere('(x.title LIKE :q OR x.locality LIKE :q OR x.city LIKE :q OR x.postedBy LIKE :q)', { q });
    }
    if (filters.type) {
      if (kind === 'filterOptions') qb.andWhere('x.filterType = :type', { type: filters.type });
      if (kind === 'plans') qb.andWhere('x.planType = :type', { type: filters.type });
    }
    if (filters.status && kind === 'properties') qb.andWhere('x.moderationStatus = :status', { status: filters.status });

    if (kind === 'filterOptions') qb.orderBy('x.filterType', 'ASC').addOrderBy('x.sortOrder', 'ASC');
    else if (kind === 'plans') qb.orderBy('x.planType', 'ASC').addOrderBy('x.price', 'ASC');
    else if (kind === 'properties') qb.orderBy('x.createdAt', 'DESC');
    else if (kind === 'localities') qb.orderBy('x.city', 'ASC').addOrderBy('x.name', 'ASC');
    else qb.orderBy('x.sortOrder', 'ASC').addOrderBy('x.createdAt', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async get(kind: Kind, id: string): Promise<any | null> {
    await this.ensureSeeded();
    return this.repo(kind).findOne({ where: { id } });
  }

  async create(kind: Kind, body: any, actorSub: string, ip?: string): Promise<any> {
    const repo = this.repo(kind);
    const row = repo.create(this.normalize(kind, body));
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: `Homes:${kind}`, entityId: row.id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async update(kind: Kind, id: string, body: any, actorSub: string, ip?: string): Promise<any> {
    const repo = this.repo(kind);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Homes record not found');
    Object.assign(row, this.normalize(kind, body));
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: `Homes:${kind}`, entityId: id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async remove(kind: Kind, id: string, actorSub: string, ip?: string): Promise<void> {
    const repo = this.repo(kind);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Homes record not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: `Homes:${kind}`, entityId: id, metadata: null, ipAddress: ip ?? null });
  }

  async moderateProperty(id: string, status: string, actorSub: string, ip?: string): Promise<HomesPropertyListing> {
    const row = await this.update('properties', id, { moderationStatus: status }, actorSub, ip);
    return row;
  }

  private normalize(kind: Kind, body: any): any {
    if (kind === 'amenities') return { name: String(body.name || '').trim(), icon: body.icon || null, category: body.category || 'General', sortOrder: Number(body.sortOrder || 0), isActive: body.isActive !== false, metadata: body.metadata ?? null };
    if (kind === 'filterOptions') return { filterType: body.filterType || body.type || 'General', label: String(body.label || '').trim(), value: String(body.value || '').trim(), sortOrder: Number(body.sortOrder || 0), isActive: body.isActive !== false, metadata: body.metadata ?? null };
    if (kind === 'localities') return { name: String(body.name || '').trim(), city: String(body.city || '').trim(), isPopular: !!(body.isPopular ?? body.popular), avgRent: String(body.avgRent ?? 0), avgSalePrice: String(body.avgSalePrice ?? body.avgSale ?? 0), lifeScore: String(body.lifeScore ?? 0), scoreBreakdown: body.scoreBreakdown ?? body.scores ?? null, seoTitle: body.seoTitle ?? null, seoDescription: body.seoDescription ?? null, isActive: body.isActive !== false, metadata: body.metadata ?? null };
    if (kind === 'plans') return { planType: body.planType || body.type || 'owner', name: String(body.name || '').trim(), description: body.description ?? null, price: String(body.price ?? 0), durationDays: Number(body.durationDays ?? body.duration ?? 30), listingLimit: Number(body.listingLimit ?? body.listings ?? 0), contactReveals: Number(body.contactReveals ?? body.contacts ?? 0), visibilityBoost: !!(body.visibilityBoost ?? body.boost), features: body.features ?? [], isActive: body.isActive !== false, metadata: body.metadata ?? null };
    return body;
  }
}