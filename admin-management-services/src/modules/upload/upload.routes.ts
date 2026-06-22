import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { jwtAuth, requireRole } from '../../middleware/authMiddleware';

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|jfif)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const mimeOk = mime.startsWith('image/') || mime === 'application/pdf';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = IMAGE_EXT.test(file.originalname || '') || ext === '.pdf';
    cb(null, mimeOk || extOk);
  },
});

export const createUploadRoutes = (): Router => {
  const router = Router();

  router.use(jwtAuth);
  router.use(requireRole('ADMIN'));

  // Single file upload
  router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const url = `/uploads/${file.filename}`;
    res.status(201).json({ url, filename: file.filename, originalName: file.originalname, size: file.size });
  });

  // Multiple files upload (up to 5)
  router.post('/upload/multiple', upload.array('files', 5), (req: Request, res: Response) => {
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
