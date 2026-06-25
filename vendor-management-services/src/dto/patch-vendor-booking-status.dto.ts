import { IsIn, IsString } from 'class-validator';

const VENDOR_BOOKING_STATUSES = [
  'approved',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
] as const;

export class PatchVendorBookingStatusDto {
  @IsString()
  @IsIn([...VENDOR_BOOKING_STATUSES])
  status!: (typeof VENDOR_BOOKING_STATUSES)[number];
}
