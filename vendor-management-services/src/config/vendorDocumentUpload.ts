import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { vendorUploadRoot } from './vendorImageUpload';

const DOC_SUBDIR = 'vendor-documents';

export function vendorDocumentDir(vendorId: string): string {
  return path.join(vendorUploadRoot(), DOC_SUBDIR, vendorId);
}

export function ensureVendorDocumentDir(vendorId: string): string {
  const dir = vendorDocumentDir(vendorId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function vendorDocumentPublicUrl(vendorId: string, filename: string): string {
  return `/vendor-uploads/${DOC_SUBDIR}/${vendorId}/${filename}`;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const vendorId = String((req as any).vendorUploadId || 'unknown');
    try {
      cb(null, ensureVendorDocumentDir(vendorId));
    } catch (e) {
      cb(e as Error, '');
    }
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || '') || '.pdf';
    cb(null, `${unique}${ext}`);
  },
});

/** KYC / compliance document upload (PDF + images). */
export const vendorDocumentUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok =
      mime.startsWith('image/') ||
      mime === 'application/pdf' ||
      ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    if (ok) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed for documents.'));
  },
});
