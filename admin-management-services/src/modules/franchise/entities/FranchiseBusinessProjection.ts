import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('franchise_business_projections')
export class FranchiseBusinessProjection {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }
  @Column({ name: 'registration_id', type: 'varchar', length: 36, nullable: true }) @Index() registrationId!: string | null;
  @Column({ name: 'franchise_id', type: 'varchar', length: 36, nullable: true }) @Index() franchiseId!: string | null;
  @Column({ name: 'plan_id', type: 'varchar', length: 36, nullable: true }) @Index() planId!: string | null;
  @Column({ name: 'territory_name', type: 'varchar', length: 255 }) territoryName!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) city!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) state!: string | null;
  @Column({ name: 'initial_investment', type: 'decimal', precision: 16, scale: 2, default: 0 }) initialInvestment!: string;
  @Column({ name: 'franchise_fee', type: 'decimal', precision: 16, scale: 2, default: 0 }) franchiseFee!: string;
  @Column({ name: 'setup_cost', type: 'decimal', precision: 16, scale: 2, nullable: true }) setupCost!: string | null;
  @Column({ name: 'monthly_opex', type: 'decimal', precision: 16, scale: 2, nullable: true }) monthlyOpex!: string | null;
  @Column({ name: 'projected_monthly_revenue', type: 'decimal', precision: 16, scale: 2, default: 0 }) projectedMonthlyRevenue!: string;
  @Column({ name: 'projected_annual_revenue', type: 'decimal', precision: 16, scale: 2, default: 0 }) projectedAnnualRevenue!: string;
  @Column({ name: 'projected_break_even_months', type: 'int', nullable: true }) projectedBreakEvenMonths!: number | null;
  @Column({ name: 'projected_roi_percent', type: 'decimal', precision: 7, scale: 2, nullable: true }) projectedRoiPercent!: string | null;
  @Column({ name: 'population_estimate', type: 'int', nullable: true }) populationEstimate!: number | null;
  @Column({ name: 'market_notes', type: 'text', nullable: true }) marketNotes!: string | null;
  @Column({ name: 'prepared_by', type: 'varchar', length: 128, nullable: true }) preparedBy!: string | null;
  @Column({ type: 'varchar', length: 24, default: 'draft' }) @Index() status!: 'draft' | 'submitted' | 'approved' | 'rejected';
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
