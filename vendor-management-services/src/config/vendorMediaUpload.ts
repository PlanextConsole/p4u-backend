import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { vendorUploadRoot } from './vendorImageUpload';

const MEDIA_SUBDIR = 'vendor-media';

export function vendorMediaDir(vendorId: string, folderId?: string | null): string {
  const base = path.join(vendorUploadRoot(), MEDIA_SUBDIR, vendorId);
  return folderId ? path.join(base, folderId) : base;
}

export function ensureVendorMediaDir(vendorId: string, folderId?: string | null): string {
  const dir = vendorMediaDir(vendorId, folderId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function vendorMediaPublicUrl(vendorId: string, folderId: string | null, filename: string): string {
  const parts = [MEDIA_SUBDIR, vendorId];
  if (folderId) parts.push(folderId);
  parts.push(filename);
  return `/vendor-uploads/${parts.join('/')}`;
}

const DOC_EXT = /\.(pdf|docx?|txt|csv|xlsx?)$/i;

function mediaStorage(vendorId: string, folderId: string | null) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        cb(null, ensureVendorMediaDir(vendorId, folderId));
      } catch (e) {
        cb(e as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname || '') || '';
      cb(null, `${unique}${ext}`);
    },
  });
}

export function createVendorMediaUpload(vendorId: string, folderId: string | null) {
  return multer({
    storage: mediaStorage(vendorId, folderId),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const mime = (file.mimetype || '').toLowerCase();
      const extOk = DOC_EXT.test(file.originalname || '') || /\.(jpe?g|png|gif|webp|svg|bmp|avif)$/i.test(file.originalname || '');
      const mimeOk =
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        mime.includes('document') ||
        mime.includes('sheet') ||
        mime === 'text/plain' ||
        mime === 'text/csv';
      if (mimeOk || extOk) cb(null, true);
      else cb(new Error('Only images and documents (PDF, Word, text, CSV) are allowed.'));
    },
  });
}
