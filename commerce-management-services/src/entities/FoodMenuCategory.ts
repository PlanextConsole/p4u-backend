import { randomUUID } from 'crypto';
import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('food_menu_categories')
export class FoodMenuCategory {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'restaurant_id', type: 'varchar', length: 36 })
  @Index()
  restaurantId!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
