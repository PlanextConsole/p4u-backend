import { AppDataSource } from '../config/database';
import { VendorRegistrationRequest } from '../entities/VendorRegistrationRequest';
import { CreateVendorRegistrationDto } from '../dto/create-vendor-registration.dto';

export class VendorRegistrationService {
  async submitRegistration(
    customerId: string,
    dto: CreateVendorRegistrationDto
  ): Promise<VendorRegistrationRequest> {
    const repo = AppDataSource.getRepository(VendorRegistrationRequest);

    const existing = await repo.findOne({
      where: { customerId, status: 'pending' },
    });
    if (existing) {
      throw new Error('A pending registration request already exists for this customer');
    }

    const row = repo.create({
      customerId,
      businessName: dto.businessName,
      ownerName: dto.ownerName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      businessType: dto.businessType ?? null,
      addressJson: dto.address ?? null,
      documentsJson: dto.documents ?? null,
      categoriesJson: dto.categories ?? null,
      description: dto.description ?? null,
      status: 'pending',
    });

    return repo.save(row);
  }

  async getRegistrationStatus(customerId: string): Promise<VendorRegistrationRequest | null> {
    const repo = AppDataSource.getRepository(VendorRegistrationRequest);
    return repo.findOne({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }
}
