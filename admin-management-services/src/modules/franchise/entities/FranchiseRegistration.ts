import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('franchise_registrations')
export class FranchiseRegistration {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) @Index() status!: string;
  @Column({ name: 'plan_id', type: 'varchar', length: 36, nullable: true }) @Index() planId!: string | null;
  @Column({ name: 'applicant_name', type: 'varchar', length: 255 }) applicantName!: string;
  @Column({ name: 'business_name', type: 'varchar', length: 255, nullable: true }) businessName!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) city!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) state!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) pincode!: string | null;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Column({ name: 'preferred_territory', type: 'varchar', length: 255, nullable: true }) preferredTerritory!: string | null;
  @Column({ name: 'investment_budget', type: 'decimal', precision: 14, scale: 2, nullable: true }) investmentBudget!: string | null;
  @Column({ name: 'experience_years', type: 'int', nullable: true }) experienceYears!: number | null;
  @Column({ name: 'documents_json', type: 'json', nullable: true }) documentsJson!: unknown[] | Record<string, unknown> | null;
  @Column({ name: 'admin_notes', type: 'text', nullable: true }) adminNotes!: string | null;
  @Column({ name: 'rejection_reason', type: 'text', nullable: true }) rejectionReason!: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true }) reviewedAt!: Date | null;
  @Column({ name: 'reviewed_by', type: 'varchar', length: 128, nullable: true }) reviewedBy!: string | null;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
