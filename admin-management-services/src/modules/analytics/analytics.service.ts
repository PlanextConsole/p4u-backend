import { AppDataSource } from '../../config/database';
import { Customer } from '../customers/entities/Customer';
import { Vendor } from '../vendors/entities/Vendor';
import { Order } from '../orders/entities/Order';
import { Settlement } from '../orders/entities/Settlement';
import { Product } from '../products/entities/Product';

function parseDate(dateValue?: string): Date | null {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isServiceVendorRow(v: Pick<Vendor, 'vendorKind' | 'vendorType'>): boolean {
  const kind = String(v.vendorKind || '').trim().toLowerCase();
  const type = String(v.vendorType || '').trim().toUpperCase();
  return kind === 'service' || type === 'SERVICE';
}

export class AnalyticsAdminService {
  async metadataBundle(): Promise<Record<string, unknown>> {
    const customerRepo = AppDataSource.getRepository(Customer);
    const vendorRepo = AppDataSource.getRepository(Vendor);
    const orderRepo = AppDataSource.getRepository(Order);
    const settlementRepo = AppDataSource.getRepository(Settlement);
    const productRepo = AppDataSource.getRepository(Product);

    const [
      totalCustomers,
      vendorRows,
      totalOrders,
      completedOrders,
      totalSettlements,
      totalProducts,
    ] = await Promise.all([
      customerRepo.count(),
      vendorRepo.find({ select: ['id', 'status', 'vendorKind', 'vendorType'] }),
      orderRepo.count(),
      orderRepo.count({ where: { status: 'completed' } }),
      settlementRepo.count(),
      productRepo.count(),
    ]);

    let productVendors = 0;
    let serviceVendors = 0;
    let activeVendors = 0;
    let pendingVendors = 0;
    for (const v of vendorRows) {
      if (isServiceVendorRow(v)) serviceVendors += 1;
      else productVendors += 1;
      const st = String(v.status || '').trim().toLowerCase();
      if (st === 'active') activeVendors += 1;
      if (!st || st === 'pending' || st === 'not_verified') pendingVendors += 1;
    }
    const totalVendors = vendorRows.length;

    // Some legacy DBs may still miss `customer_profiles.status`.
    // Keep dashboard functional instead of failing the whole request.
    let activeCustomers = totalCustomers;
    try {
      activeCustomers = await customerRepo.count({ where: { status: 'active' } });
    } catch {
      activeCustomers = totalCustomers;
    }

    return {
      users: {
        customers: { total: totalCustomers, active: activeCustomers },
        vendors: {
          total: totalVendors,
          active: activeVendors,
          pending: pendingVendors,
          product: productVendors,
          service: serviceVendors,
        },
      },
      commerce: {
        orders: { total: totalOrders, completed: completedOrders },
        settlements: { total: totalSettlements },
        products: { total: totalProducts },
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async usersJoined(type: 'customers' | 'vendors', dateFrom?: string, dateTo?: string): Promise<{ total: number }> {
    const from = parseDate(dateFrom);
    const to = parseDate(dateTo);
    const repo = type === 'customers' ? AppDataSource.getRepository(Customer) : AppDataSource.getRepository(Vendor);
    const qb = repo.createQueryBuilder('u');
    if (from) qb.andWhere('u.createdAt >= :from', { from });
    if (to) qb.andWhere('u.createdAt <= :to', { to });
    const total = await qb.getCount();
    return { total };
  }
}
