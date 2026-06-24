import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';
import { normalizeMediaUrl } from '../util/normalizeMediaUrl';

/**
 * Resolves social author identities (Keycloak `sub`) to a display name + avatar.
 *
 * Social rows only store the author's Keycloak user id; without this join the
 * feed/comments/stories render as "unknown" with no avatar. We look the ids up
 * in `customer_profiles` (the socio mirror) in a single `IN (...)` query and
 * pull the avatar out of `metadata` (no dedicated column in this schema).
 */
export interface AuthorInfo {
  userName: string;
  userAvatar: string | null;
}

const FALLBACK_NAME = 'P4U User';

const AVATAR_KEYS = [
  'avatarUrl',
  'avatar',
  'profileImage',
  'profileImageUrl',
  'photoUrl',
  'photo',
  'imageUrl',
  'image',
  'picture',
];

function avatarFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  for (const key of AVATAR_KEYS) {
    const value = (meta as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return normalizeMediaUrl(value) ?? value;
    }
  }
  return null;
}

/** Map of Keycloak user id → { userName, userAvatar } for the given ids. */
export async function resolveAuthorMap(ids: Array<string | null | undefined>): Promise<Map<string, AuthorInfo>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const map = new Map<string, AuthorInfo>();
  if (unique.length === 0) return map;

  const profiles = await AppDataSource.getRepository(CustomerProfile)
    .createQueryBuilder('c')
    .where('c.keycloak_user_id IN (:...ids)', { ids: unique })
    .getMany();

  for (const p of profiles) {
    if (!p.keycloakUserId) continue;
    map.set(p.keycloakUserId, {
      userName: (p.fullName || '').trim() || FALLBACK_NAME,
      userAvatar: avatarFromMetadata(p.metadata),
    });
  }
  return map;
}

/** Look up a single author (used when returning a freshly created row). */
export async function resolveAuthor(id: string | null | undefined): Promise<AuthorInfo> {
  const map = await resolveAuthorMap([id]);
  return (id && map.get(id)) || { userName: FALLBACK_NAME, userAvatar: null };
}

/** Attach userName/userAvatar to a row keyed by the given id field value. */
export function withAuthor<T>(row: T, authorId: string | null | undefined, map: Map<string, AuthorInfo>): T & AuthorInfo {
  const info = (authorId && map.get(authorId)) || { userName: FALLBACK_NAME, userAvatar: null };
  return { ...row, userName: info.userName, userAvatar: info.userAvatar };
}
