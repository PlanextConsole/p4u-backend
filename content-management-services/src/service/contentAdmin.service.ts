import { AppDataSource } from '../config/database';
import { Brand } from '../entities/Brand';
import { FeaturedProduct } from '../entities/FeaturedProduct';
import { ServiceHighlight } from '../entities/ServiceHighlight';
import {
  CreateBrandDto,
  CreateFeaturedProductDto,
  CreateServiceHighlightDto,
  UpdateBrandDto,
  UpdateFeaturedProductDto,
  UpdateServiceHighlightDto,
} from '../dto/contentAdmin.dto';

export class ContentAdminService {
  // --- Brands ---
  async getBrandById(id: string): Promise<Brand | null> {
    return AppDataSource.getRepository(Brand).findOne({ where: { id } });
  }

  async createBrand(dto: CreateBrandDto): Promise<Brand> {
    const repo = AppDataSource.getRepository(Brand);
    const row = repo.create({
      name: dto.name,
      imageUrl: dto.imageUrl,
      redirectUrl: dto.redirectUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return repo.save(row);
  }

  async updateBrand(id: string, dto: UpdateBrandDto): Promise<Brand | null> {
    const repo = AppDataSource.getRepository(Brand);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return repo.save(row);
  }

  async deleteBrand(id: string): Promise<boolean> {
    const r = await AppDataSource.getRepository(Brand).delete({ id });
    return (r.affected ?? 0) > 0;
  }

  // --- Featured products ---
  async getFeaturedProductById(id: string): Promise<FeaturedProduct | null> {
    return AppDataSource.getRepository(FeaturedProduct).findOne({ where: { id } });
  }

  async createFeaturedProduct(dto: CreateFeaturedProductDto): Promise<FeaturedProduct> {
    const repo = AppDataSource.getRepository(FeaturedProduct);
    const row = repo.create({
      name: dto.name,
      imageUrl: dto.imageUrl,
      section: dto.section ?? null,
      price: dto.price ?? null,
      redirectUrl: dto.redirectUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return repo.save(row);
  }

  async updateFeaturedProduct(
    id: string,
    dto: UpdateFeaturedProductDto
  ): Promise<FeaturedProduct | null> {
    const repo = AppDataSource.getRepository(FeaturedProduct);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.section !== undefined) row.section = dto.section;
    if (dto.price !== undefined) row.price = dto.price;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return repo.save(row);
  }

  async deleteFeaturedProduct(id: string): Promise<boolean> {
    const r = await AppDataSource.getRepository(FeaturedProduct).delete({ id });
    return (r.affected ?? 0) > 0;
  }

  // --- Service highlights ---
  async getServiceHighlightById(id: string): Promise<ServiceHighlight | null> {
    return AppDataSource.getRepository(ServiceHighlight).findOne({ where: { id } });
  }

  async createServiceHighlight(dto: CreateServiceHighlightDto): Promise<ServiceHighlight> {
    const repo = AppDataSource.getRepository(ServiceHighlight);
    const row = repo.create({
      title: dto.title,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      iconUrl: dto.iconUrl ?? null,
      redirectUrl: dto.redirectUrl ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return repo.save(row);
  }

  async updateServiceHighlight(
    id: string,
    dto: UpdateServiceHighlightDto
  ): Promise<ServiceHighlight | null> {
    const repo = AppDataSource.getRepository(ServiceHighlight);
    const row = await repo.findOne({ where: { id } });
    if (!row) return null;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.imageUrl !== undefined) row.imageUrl = dto.imageUrl;
    if (dto.iconUrl !== undefined) row.iconUrl = dto.iconUrl;
    if (dto.redirectUrl !== undefined) row.redirectUrl = dto.redirectUrl;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return repo.save(row);
  }

  async deleteServiceHighlight(id: string): Promise<boolean> {
    const r = await AppDataSource.getRepository(ServiceHighlight).delete({ id });
    return (r.affected ?? 0) > 0;
  }
}
