import { AppDataSource } from '../../config/database';
import { Settlement } from '../orders/entities/Settlement';
import { getPlatformVarNumber, PLATFORM_VAR_KEYS } from '../platform-config/platform-variable.reader';
import { Vendor } from './entities/Vendor';

function generateVendorReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'V4U-';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/**
 * Vendor-to-vendor referral rewards. Referral codes live in vendor `notes` metadata
 * via a JSON side-channel stored in `documents_json.referralCode` when present,
 * otherwise generated on first use into `documents_json`.
 */
export class VendorReferralService {
  async ensureReferralCode(vendor: Vendor): Promise<string> {
    const docs = (vendor.documentsJson || {}) as Record<string, unknown>;
    const existing = docs.referralCode ?? docs.referral_code;
    if (existing && String(existing).trim()) return String(existing).trim();

    const code = generateVendorReferralCode();
    vendor.documentsJson = { ...docs, referralCode: code };
    await AppDataSource.getRepository(Vendor).save(vendor);
    return code;
  }

  /**
   * When a new vendor carries `appliedReferralCode`, credit the referring vendor once.
   */
  async applyVendorReferralReward(newVendor: Vendor): Promise<void> {
    if (newVendor.status !== 'active') return;
    const codeUsed = newVendor.appliedReferralCode?.trim();
    if (!codeUsed) return;

    const docs = (newVendor.documentsJson || {}) as Record<string, unknown>;
    if (docs.vendorReferralRewardApplied === true) return;

    const codeNorm = codeUsed.toUpperCase();
    const vendors = await AppDataSource.getRepository(Vendor).find();
    const referrer = vendors.find((v) => {
      if (v.id === newVendor.id) return false;
      const refDocs = (v.documentsJson || {}) as Record<string, unknown>;
      const code = String(refDocs.referralCode ?? refDocs.referral_code ?? '').trim().toUpperCase();
      return code === codeNorm;
    });
    if (!referrer) return;

    const pts = await getPlatformVarNumber(PLATFORM_VAR_KEYS.VENDOR_REFERRAL_BONUS);
    if (!Number.isFinite(pts) || pts <= 0) return;

    const settlementRepo = AppDataSource.getRepository(Settlement);
    await settlementRepo.save(
      settlementRepo.create({
        vendorId: referrer.id,
        settlementType: 'points',
        status: 'posted',
        amount: String(pts),
        metadata: {
          type: 'vendor_referral',
          referredVendorId: newVendor.id,
          referredBusinessName: newVendor.businessName,
          referralCode: codeUsed,
          description: 'Reward for referring a new vendor',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    );

    const refDocs = (referrer.documentsJson || {}) as Record<string, unknown>;
    const earned = Number(refDocs.referralPointsEarned || 0) + pts;
    referrer.documentsJson = { ...refDocs, referralPointsEarned: earned };
    await AppDataSource.getRepository(Vendor).save(referrer);

    newVendor.documentsJson = { ...docs, vendorReferralRewardApplied: true };
    await AppDataSource.getRepository(Vendor).save(newVendor);
  }
}
