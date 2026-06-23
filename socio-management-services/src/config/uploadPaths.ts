import fs from 'fs';
import path from 'path';

/** Writable upload root for socio post/story media. Override on VPS via UPLOAD_DIR. */
export function socioUploadRoot(): string {
  const env = process.env.UPLOAD_DIR?.trim();
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), 'uploads');
}

export function ensureSocioUploadDir(): void {
  const dir = socioUploadRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function ensureSocioMediaDir(): void {
  const dir = path.join(socioUploadRoot(), 'media');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Gateway-relative public URL (unchanged contract for frontends). */
export function socioMediaPublicUrl(id: string): string {
  return `/socio-uploads/media/${id}`;
}
