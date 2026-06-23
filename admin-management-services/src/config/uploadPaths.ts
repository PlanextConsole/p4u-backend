import fs from 'fs';
import path from 'path';

/**
 * Writable upload root for admin images, media library, and bulk CSV jobs.
 * On production VPS set UPLOAD_DIR or symlink `uploads/` → `/opt/p4u/storage/admin-uploads`.
 */
export function adminUploadRoot(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), 'uploads');
}

export function ensureAdminUploadDir(): void {
  const dir = adminUploadRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Gateway-relative public URL for a path under the upload root (e.g. `media-library/...`). */
export function adminUploadPublicUrl(relativePath: string): string {
  const rel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `/uploads/${rel}`;
}
