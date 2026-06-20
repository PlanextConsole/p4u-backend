import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { FileUploadsAdminService } from './file-uploads.service';

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const d = path.join(UPLOAD_DIR, 'bulk-uploads');
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${randomUUID()}.csv`);
  },
});

const csvUpload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || '').toLowerCase();
    const m = (file.mimetype || '').toLowerCase();
    const ok =
      n.endsWith('.csv') ||
      m === 'text/csv' ||
      m === 'application/csv' ||
      m === 'application/vnd.ms-excel' ||
      (m === 'application/octet-stream' && n.endsWith('.csv'));
    cb(null, ok);
  },
});

export function createFileUploadsAdminRoutes(): Router {
  const r = Router();
  const svc = new FileUploadsAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('banner.admin.manage'));

  r.get('/file-uploads/jobs', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 100 });
      const data = await svc.listJobs(limit, offset);
      res.json({ ...data, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/file-uploads/sample/:type', (req: Request, res: Response) => {
    try {
      const { filename, body } = svc.getSampleCsv(req.params.type);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(body);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.get('/file-uploads/jobs/:id/source', async (req: Request, res: Response) => {
    try {
      const job = await svc.getJob(req.params.id);
      if (!job) return res.status(404).json({ message: 'Job not found' });
      const abs = svc.resolveStoredPath(job);
      if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found' });
      res.download(abs, job.originalFilename);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/file-uploads/jobs/:id/retry', async (req: Request, res: Response) => {
    try {
      const row = await svc.retryJob(req.params.id, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const st = e.message === 'Job not found' ? 404 : 400;
      res.status(st).json({ message: e.message });
    }
  });

  r.post('/file-uploads', csvUpload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file?.path) return res.status(400).json({ message: 'No CSV file uploaded' });
    const uploadType = String((req.body as any)?.uploadType || 'product').toLowerCase();
    const allowed = ['product', 'products', 'customer', 'customers', 'vendor', 'vendors'];
    if (!allowed.includes(uploadType)) {
      return res.status(400).json({ message: 'Invalid uploadType' });
    }
    try {
      const job = await svc.createJobAndSaveFile(uploadType, file.originalname, file.path, getAuthSub(req));
      const done = await svc.processJob(job.id, getAuthSub(req), clientIp(req));
      res.status(201).json(done);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return r;
}
