import { DataSource } from 'typeorm';
import { SocialPost } from '../entities/SocialPost';
import { PostLike } from '../entities/PostLike';
import { PostComment } from '../entities/PostComment';
import { PostSave } from '../entities/PostSave';
import { UserFollow } from '../entities/UserFollow';
import { Story } from '../entities/Story';
import { SocialMedia } from '../entities/SocialMedia';
import { CustomerProfile } from '../entities/CustomerProfile';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CommerceSettlement } from '../entities/CommerceSettlement';
import { PlatformVariable } from '../entities/PlatformVariable';
import { SocialConversation } from '../entities/SocialConversation';
import { SocialMessage } from '../entities/SocialMessage';
import { SocialConversationState } from '../entities/SocialConversationState';

const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'postgres' : 'mysql';
const defaultPort = dbType === 'postgres' ? '5432' : '3306';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || defaultPort, 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [SocialPost, PostLike, PostComment, PostSave, UserFollow, Story, SocialMedia, CustomerProfile, RewardPointsLedger, CommerceSettlement, PlatformVariable, SocialConversation, SocialMessage, SocialConversationState],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
