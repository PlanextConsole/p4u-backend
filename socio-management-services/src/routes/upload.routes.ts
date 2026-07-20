import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { jwtAuth, requireAnyRole } from '../middleware/authMiddleware';
import { sendBadRequest, sendNotFound, sendForbidden } from '../middleware/responseEnvelope';
import { AppDataSource } from '../config/database';
import { SocialMedia } from '../entities/SocialMedia';
import { socioMediaPublicUrl } from '../config/uploadPaths';
import {
  absolutePathForRow,
  deleteMediaByIds,
  unlinkMediaFile,
  writeMediaToDisk,
} from '../service/socialMediaStorage.service';

const ALLOWED_IMAGE = /\.(jpe?g|png|gif|webp|bmp|avif|heic|jfif)$/i;
const ALLOWED_VIDEO = /\.(mp4|mov|webm|m4v|avi)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
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

async function persistUploadedFile(
  file: Express.Multer.File,
  ownerId: string,
): Promise<SocialMedia> {
  const id = randomUUID();
  const mimeType = file.mimetype || fallbackMimeFromExt(file.originalname || '');
  const storagePath = writeMediaToDisk(id, file.buffer, file.originalname || '', mimeType);
  const repo = AppDataSource.getRepository(SocialMedia);
  return repo.save(
    repo.create({
      id,
      kind: detectKind(file),
      mimeType,
      originalName: file.originalname || null,
      sizeBytes: file.size || file.buffer.length,
      storagePath,
      data: null,
      ownerId,
    }),
  );
}

/**
 * Auth-gated write endpoints. Files persist on disk; DB holds metadata + storage_path.
 */
export function createSocioUploadRoutes(): Router {
  const router = Router();

  // This router is mounted before the main Socio router to preserve multipart
  // streams. Keep auth limited to its own write paths so public health and
  // media/feed routes can continue into the next router.
  router.use(
    ['/upload', '/media'],
    jwtAuth,
    requireAnyRole(['CUSTOMER', 'VENDOR', 'ADMIN']),
  );

  router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return sendBadRequest(res, 'No file uploaded');
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');

    const row = await persistUploadedFile(file, userId);
    res.status(201).json({
      id: row.id,
      url: socioMediaPublicUrl(row.id),
      filename: row.id,
      originalName: row.originalName,
      size: row.sizeBytes,
      mediaType: row.kind,
    });
  });

  router.post('/upload/multiple', upload.array('files', 8), async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) return sendBadRequest(res, 'No files uploaded');
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');

    const rows: SocialMedia[] = [];
    for (const f of files) {
      rows.push(await persistUploadedFile(f, userId));
    }

    res.status(201).json({
      files: rows.map((row) => ({
        id: row.id,
        url: socioMediaPublicUrl(row.id),
        filename: row.id,
        originalName: row.originalName,
        size: row.sizeBytes,
        mediaType: row.kind,
      })),
    });
  });

  router.delete('/media/:id', async (req: Request, res: Response) => {
    const userId = userIdFromAuth(req);
    if (!userId) return sendBadRequest(res, 'user id missing in token');
    const repo = AppDataSource.getRepository(SocialMedia);
    const row = await repo.findOne({ where: { id: req.params.id } });
    if (!row) return sendNotFound(res, 'Media not found');
    if (row.ownerId !== userId) return sendForbidden(res, 'Not the owner of this media');
    unlinkMediaFile(row);
    await repo.remove(row);
    res.status(200).json({ success: true, data: { id: req.params.id, deleted: true } });
  });

  return router;
}

function streamMediaRow(row: SocialMedia, req: Request, res: Response): boolean {
  const mime = row.mimeType || 'application/octet-stream';
  const abs = absolutePathForRow(row);

  const pipeStream = (stream: fs.ReadStream, status: number, start: number, end: number, total: number) => {
    res.status(status);
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (status === 206) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(end - start + 1));
    } else {
      res.setHeader('Content-Length', String(total));
    }
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    stream.pipe(res);
  };

  if (abs && fs.existsSync(abs)) {
    const stat = fs.statSync(abs);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return true;
      }
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return true;
      }
      pipeStream(fs.createReadStream(abs, { start, end }), 206, start, end, fileSize);
      return true;
    }
    pipeStream(fs.createReadStream(abs), 200, 0, fileSize - 1, fileSize);
    return true;
  }

  if (row.data?.length) {
    const total = row.sizeBytes || row.data.length;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(total));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(row.data);
    return true;
  }
  return false;
}

/**
 * Public read — mounted on `/socio-uploads`. No auth required for GET.
 */
export function createSocioMediaPublicRoutes(): Router {
  const router = Router();

  router.get('/media/:id', async (req: Request, res: Response) => {
    const repo = AppDataSource.getRepository(SocialMedia);
    const row = await repo.findOne({ where: { id: req.params.id } });
    if (!row) return sendNotFound(res, 'Media not found');
    if (!streamMediaRow(row, req, res)) return sendNotFound(res, 'Media file not found');
  });

  return router;
}
