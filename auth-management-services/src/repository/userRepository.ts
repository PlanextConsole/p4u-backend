import { Repository } from 'typeorm';
import { User } from '../entity/User';
import { AppDataSource } from '../config/database';

export class UserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.repository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    return this.repository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalized })
      .getOne();
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return await this.repository.findOne({ where: { keycloakId } });
  }

  async save(user: User): Promise<User> {
    return await this.repository.save(user);
  }

  async findOne(id: number): Promise<User | null> {
    return await this.repository.findOne({ where: { id } });
  }
}

