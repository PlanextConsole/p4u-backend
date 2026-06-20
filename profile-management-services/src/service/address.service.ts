import { Not } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomerAddress } from '../entities/CustomerAddress';

export class AddressService {
  private repo = AppDataSource.getRepository(CustomerAddress);

  async listAddresses(customerId: string): Promise<CustomerAddress[]> {
    return this.repo.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }

  async getAddress(customerId: string, addressId: string): Promise<CustomerAddress | null> {
    return this.repo.findOne({ where: { id: addressId, customerId } });
  }

  async createAddress(customerId: string, data: Partial<CustomerAddress>): Promise<CustomerAddress> {
    if (data.isDefault) {
      await this.repo.update({ customerId, isDefault: true }, { isDefault: false });
    }
    const row = this.repo.create({ ...data, customerId });
    return this.repo.save(row);
  }

  async updateAddress(customerId: string, addressId: string, patch: Partial<CustomerAddress>): Promise<CustomerAddress> {
    const row = await this.repo.findOne({ where: { id: addressId, customerId } });
    if (!row) throw new Error('Address not found');
    if (patch.isDefault) {
      await this.repo.update({ customerId, isDefault: true, id: Not(addressId) }, { isDefault: false });
    }
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.fullName !== undefined) row.fullName = patch.fullName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    if (patch.addressLine1 !== undefined) row.addressLine1 = patch.addressLine1;
    if (patch.addressLine2 !== undefined) row.addressLine2 = patch.addressLine2;
    if (patch.city !== undefined) row.city = patch.city;
    if (patch.state !== undefined) row.state = patch.state;
    if (patch.postalCode !== undefined) row.postalCode = patch.postalCode;
    if (patch.country !== undefined) row.country = patch.country;
    if (patch.isDefault !== undefined) row.isDefault = patch.isDefault;
    if (patch.latitude !== undefined) row.latitude = patch.latitude;
    if (patch.longitude !== undefined) row.longitude = patch.longitude;
    if (patch.metadata !== undefined) row.metadata = patch.metadata;
    return this.repo.save(row);
  }

  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id: addressId, customerId } });
    if (!row) throw new Error('Address not found');
    await this.repo.remove(row);
  }
}
