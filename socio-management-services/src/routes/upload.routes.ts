import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { jwtAuth, requireAnyRole } from '../middleware/authMiddleware';
import { sendBadRequest, sendNotFound, sendForbidden } from '../middleware/responseEnvelope';
import { AppDataSource } from '../config/database';
import { SocialMedia } from '../entities/SocialMedia';

const ALLOWED_IMAGE = /\.(jpe?g|png|gif|webp|bmp|avif|heic|jfif)$/i;
const ALLOWED_VIDEO = /\.(mp4|mov|webm|m4v|avi)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — videos
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const name = file.originalname || '';
    const isImage = mime.startsWith('image/') || ALLOWED_IMAGE.test(name);
    const isVideo = mime.startsWith('video/') || ALLOWED_VIDEO.test(name);
    cb(null, isImage || isVideo);
  },
});

function detectKind(file: Express.Multer.File): 'image' | 'video' {
  const mime = (file.mimetype || '').toLowerCase();
  if (mime.startsWith('video/') || ALLOWED_VIDEO.test(file.originalname || '')) return 'video';
  return 'image';
}

function mediaPathUrl(id: string): string {
  // Path-only URL — frontend's resolveMediaUrl prefixes with the gateway origin.
  return `/socio-uploads/media/${id}`;
}

function fallbackMimeFromExt(name: string): string {
  const ext = path.extname(name || '').toLowerCase();
  switch (ext) {
    case '.jpg': case '.jpeg': case '.jfif': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.bmp': return 'image/bmp';
    case '.avif': return 'image/avif';
    case '.heic': return 'image/heic';
    case '.mp4': return 'video/mp4';
    case '.mov': return 'video/quicktime';
    case '.webm': return 'video/webm';
    case '.m4v': return 'video/x-m4v';
    case '.avi': return 'video/x-msvideo';
    default: return 'application/octet-stream';
  }
}

function userIdFromAuth(req: Request): string | null {
  const auth = (req as any).auth;
  return String(auth?.sub || '').trim() || null;
}

/**
 * Write endpoints — auth-gated. Multipart upload accepted from CUSTOMER/VENDOR/ADMIN.
 * Media bytes are persisted directly in the `social_media` table; the response URL
 * points to the public GET below (no disk involved).
 */
export function createSocioUploadRoutes(): Router {
  const router = Router();

  router.use(jwtAuth);
  router.use(requireAnyRole(['CUSTOMER', 'VENDOR', 'ADMIN']));

  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return sendBadRequest(res, 'No file uploaded');
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');

    const repo = AppDataSource.getRepository(SocialMedia);
    const kind = detectKind(file);
    const row = await repo.save(
      repo.create({
        kind,
        mimeType: file.mimetype || fallbackMimeFromExt(file.originalname || ''),
        originalName: file.originalname || null,
        sizeBytes: file.size || file.buffer.length,
        data: file.buffer,
        ownerId: userId,
      }),
    );

    res.status(201).json({
      id: row.id,
      url: mediaPathUrl(row.id),
      filename: row.id, // legacy field name kept for client compatibility
      originalName: row.originalName,
      size: row.sizeBytes,
      mediaType: row.kind,
    });
  });

  router.post('/upload/multiple', upload.array('files', 8), async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return sendBadRequest(res, 'No files uploaded');
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');

    const repo = AppDataSource.getRepository(SocialMedia);
    const rows = await repo.save(
      files.map((f) =>
        repo.create({
          kind: detectKind(f),
          mimeType: f.mimetype || fallbackMimeFromExt(f.originalname || ''),
          originalName: f.originalname || null,
          sizeBytes: f.size || f.buffer.length,
          data: f.buffer,
          ownerId: userId,
        }),
      ),
    );

    res.status(201).json({
      files: rows.map((row) => ({
        id: row.id,
        url: mediaPathUrl(row.id),
        filename: row.id,
        originalName: row.originalName,
        size: row.sizeBytes,
        mediaType: row.kind,
      })),
    });
  });

  // Owner-only delete. Note: the GET route lives on the public `/socio-uploads` mount.
  router.delete('/media/:id', async (req: Request, res: Response) => {
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');
    const repo = AppDataSource.getRepository(SocialMedia);
    const row = await repo.findOne({ where: { id: req.params.id } });
    if (!row) return sendNotFound(res, 'Media not found');
    if (row.ownerId !== userId) return sendForbidden(res, 'Not the owner of this media');
    await repo.remove(row);
    res.status(200).json({ success: true, data: { id: req.params.id, deleted: true } });
  });

  return router;
}

/**
 * Public-read route — mounted on `/socio-uploads` so existing frontend URL contracts
 * (`/socio-uploads/...`) still resolve. Streams raw bytes with the stored mime type.
 * Kept unauthenticated to match the prior static-file behaviour and to allow
 * images to be embedded directly via <img src=…>.
 */
export function createSocioMediaPublicRoutes(): Router {
  const router = Router();

  router.get('/media/:id', async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(SocialMedia);
    const row = await repo.findOne({ where: { id: req.params.id } });
    if (!row) return sendNotFound(res, 'Media not found');
    res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(row.sizeBytes || row.data.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(row.data);
  });

  return router;
}
