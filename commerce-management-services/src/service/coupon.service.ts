import { AppDataSource } from '../config/database';
import { Coupon } from '../entities/Coupon';
import { CouponUsage } from '../entities/CouponUsage';

export class CouponService {
  private couponRepo = AppDataSource.getRepository(Coupon);
  private usageRepo = AppDataSource.getRepository(CouponUsage);

  async validateCoupon(
    code: string,
    customerId: string,
    cartTotal: number,
    vendorId?: string
  ): Promise<{ valid: boolean; discount: number; message: string; couponId?: string }> {
    const coupon = await this.couponRepo.findOne({ where: { code, status: 'active' } });
    if (!coupon) return { valid: false, discount: 0, message: 'Coupon not found or inactive' };

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return { valid: false, discount: 0, message: 'Coupon is not yet valid' };
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return { valid: false, discount: 0, message: 'Coupon has expired' };
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, discount: 0, message: 'Coupon usage limit reached' };
    }

    const userUsageCount = await this.usageRepo.count({ where: { couponId: coupon.id, customerId } });
    if (userUsageCount >= coupon.perUserLimit) {
      return { valid: false, discount: 0, message: 'You have already used this coupon' };
    }

    const minAmount = Number(coupon.minOrderAmount);
    if (cartTotal < minAmount) {
      return { valid: false, discount: 0, message: `Minimum order amount is ${minAmount}` };
    }

    if (vendorId && coupon.applicableVendorIds && coupon.applicableVendorIds.length > 0) {
      if (!coupon.applicableVendorIds.includes(vendorId)) {
        return { valid: false, discount: 0, message: 'Coupon not applicable for this vendor' };
      }
    }

    let discount = 0;
    const couponValue = Number(coupon.value);
    if (coupon.type === 'percentage') {
      discount = (cartTotal * couponValue) / 100;
      const maxDiscount = coupon.maxDiscount ? Number(coupon.maxDiscount) : null;
      if (maxDiscount !== null && discount > maxDiscount) discount = maxDiscount;
    } else if (coupon.type === 'flat') {
      discount = couponValue;
    }

    discount = Math.min(discount, cartTotal);

    return {
      valid: true,
      discount: Math.round(discount * 100) / 100,
      message: 'Coupon applied successfully',
      couponId: coupon.id,
    };
  }
}
