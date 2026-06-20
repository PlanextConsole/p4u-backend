import { AppDataSource } from '../../config/database';
import { ProductAttributeDefinition } from './entities/ProductAttributeDefinition';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';

function normalizeSelectValues(type: string, values: string[] | undefined | null): string[] | null {
  if (type !== 'select') return null;
  if (!values?.length) return [];
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))];
}

export class ProductAttributesAdminService {
  private repo = AppDataSource.getRepository(ProductAttributeDefinition);

  async list(limit: number, offset: number) {
    const [items, total] = await this.repo.findAndCount({
      order: { name: 'ASC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getById(id: string): Promise<ProductAttributeDefinition | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CreateProductAttributeDto): Promise<ProductAttributeDefinition> {
    const name = dto.name.trim();
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) throw new Error('An attribute with this name already exists');
    const row = this.repo.create({
      name,
      type: dto.type,
      isActive: dto.isActive !== false,
      selectValues: normalizeSelectValues(dto.type, dto.selectValues),
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateProductAttributeDto): Promise<ProductAttributeDefinition> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new Error('Product attribute not found');

    const nextName = dto.name !== undefined ? dto.name.trim() : row.name;
    if (nextName !== row.name) {
      const clash = await this.repo.findOne({ where: { name: nextName } });
      if (clash && clash.id !== id) throw new Error('An attribute with this name already exists');
      row.name = nextName;
    }

    const nextType = dto.type ?? row.type;
    row.type = nextType;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    if (dto.selectValues !== undefined) {
      row.selectValues = normalizeSelectValues(nextType, dto.selectValues);
    } else if (dto.type !== undefined && dto.type !== 'select') {
      row.selectValues = null;
    }

    return this.repo.save(row);
  }

  async delete(id: string): Promise<void> {
    const result = await this.repo.delete({ id });
    if (!result.affected) throw new Error('Product attribute not found');
  }
}
