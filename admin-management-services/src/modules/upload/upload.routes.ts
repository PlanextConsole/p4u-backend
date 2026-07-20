import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { jwtAuth, requireRole } from '../../middleware/authMiddleware';
import { adminUploadRoot, ensureAdminUploadDir } from '../../config/uploadPaths';
import { MediaLibraryAdminService } from '../media-library/media-library.service';

ensureAdminUploadDir();
const UPLOAD_DIR = adminUploadRoot();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || '').toLowerCase() || '';
    cb(null, `${unique}${ext}`);
  },
});

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|heif|jfif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;
const MAX_BYTES = 50 * 1024 * 1024;

function isAllowedAdminUpload(file: Express.Multer.File): boolean {
  const mime = (file.mimetype || '').toLowerCase();
  const name = file.originalname || '';
  const ext = path.extname(name).toLowerCase();
  if (mime.startsWith('image/') || mime.startsWith('video/')) return true;
  if (mime === 'application/pdf') return true;
  if (IMAGE_EXT.test(name) || VIDEO_EXT.test(name)) return true;
  if (['.webp', '.jpg', '.jpeg', '.png', '.gif', '.avif', '.heic', '.heif', '.svg', '.bmp'].includes(ext)) {
    return true;
  }
  if ((mime === 'application/octet-stream' || mime === 'binary/octet-stream') && IMAGE_EXT.test(name)) {
    return true;
  }
  if (ext === '.pdf') return true;
  return false;
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAdminUpload(file)) {
      cb(null, true);
      return;
    }
    cb(new Error(`File type not allowed (${file.mimetype || file.originalname}). Use image, video, or PDF.`));
  },
});

function handleMulterSingle(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(field)(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `File too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB)`
            : err.message;
        res.status(400).json({ message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ message });
    });
  };
}

export const createUploadRoutes = (): Router => {
  const router = Router();
  const mediaLibrary = new MediaLibraryAdminService();

  // Scope auth to upload endpoints only. This router is mounted before the
  // main admin router so a router-wide JWT gate would also block public
  // endpoints such as /api/admin/public/health and published layouts.
  router.use('/upload', jwtAuth, requireRole('ADMIN'));

  router.post('/upload', handleMulterSingle('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    try {
      await mediaLibrary.registerFlatAdminUpload(file);
    } catch {
      /* library indexing must not block form uploads */
    }
    const url = `/uploads/${file.filename}`;
    res.status(201).json({ url, filename: file.filename, originalName: file.originalname, size: file.size });
  });

  router.post('/upload/multiple', (req: Request, res: Response, next: NextFunction) => {
    upload.array('files', 5)(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const message =
            err.code === 'LIMIT_FILE_SIZE'
              ? `File too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB)`
              : err.message;
          return res.status(400).json({ message });
        }
        const message = err instanceof Error ? err.message : 'Upload failed';
        return res.status(400).json({ message });
      }
      next();
    });
  }, (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    const results = files.map((f) => ({
      url: `/uploads/${f.filename}`,
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
    }));
    res.status(201).json({ files: results });
  });

  return router;
};
