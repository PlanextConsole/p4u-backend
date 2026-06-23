import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { MediaLibraryAdminService } from './media-library.service';
import { CreateMediaFolderDto } from './dto/create-media-folder.dto';
import { B2ImportDto } from './dto/b2-import.dto';
import { adminUploadRoot, ensureAdminUploadDir } from '../../config/uploadPaths';

ensureAdminUploadDir();
const UPLOAD_DIR = adminUploadRoot();

function safeFileBase(name: string): string {
  return path.basename(name || 'file').replace(/[^\w.\-()+@ ]/g, '_').slice(0, 180) || 'file';
}

const mediaStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const fid = (req.params as { folderId: string }).folderId;
    const d = path.join(UPLOAD_DIR, 'media-library', fid);
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeFileBase(file.originalname)}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 62 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

const zipTmpStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const d = path.join(UPLOAD_DIR, 'tmp');
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (_req, _file, cb) => {
    cb(null, `ml-zip-${Date.now()}-${Math.round(Math.random() * 1e9)}.zip`);
  },
});

const zipUpload = multer({
  storage: zipTmpStorage,
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = (file.originalname || '').toLowerCase();
    const m = (file.mimetype || '').toLowerCase();
    const ok =
      n.endsWith('.zip') ||
      m === 'application/zip' ||
      m === 'application/x-zip-compressed' ||
      m === 'multipart/x-zip';
    cb(null, ok);
  },
});

export function createMediaLibraryAdminRoutes(): Router {
  const r = Router();
  const svc = new MediaLibraryAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('banner.admin.manage'));

  r.get('/media-library/folders', async (req: Request, res: Response) => {
    try {
      const kind = typeof req.query.kind === 'string' ? req.query.kind : 'all';
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const items = await svc.listFolders({ kind, q });
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/media-library/folders', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateMediaFolderDto, req.body);
      const errors = await validate(dto);
      if (errors.length) {
        const msgs = errors.map(er => Object.values(er.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createFolder(dto.name, dto.kind || 'general', getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.get('/media-library/folders/:folderId/assets', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const data = await svc.listAssets(req.params.folderId, limit, offset);
      res.json({ ...data, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post(
    '/media-library/folders/:folderId/upload',
    mediaUpload.array('files', 40),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files?.length) return res.status(400).json({ message: 'No files uploaded' });
        const out = [];
        for (const f of files) {
          out.push(await svc.recordUploadedDiskFile(req.params.folderId, f));
        }
        res.status(201).json({ items: out });
      } catch (e: any) {
        res.status(400).json({ message: e.message });
      }
    }
  );

  r.post(
    '/media-library/folders/:folderId/upload-zip',
    zipUpload.single('zip'),
    async (req: Request, res: Response) => {
      const z = req.file;
      if (!z?.path) return res.status(400).json({ message: 'No ZIP uploaded' });
      try {
        const { created } = await svc.ingestZipToFolder(req.params.folderId, z.path);
        res.status(201).json({ created });
      } catch (e: any) {
        res.status(400).json({ message: e.message });
      } finally {
        try {
          fs.unlinkSync(z.path);
        } catch {
          /* ignore */
        }
      }
    }
  );

  r.delete('/media-library/assets/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteAsset(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const st = e.message === 'Asset not found' ? 404 : 400;
      res.status(st).json({ message: e.message });
    }
  });

  r.get('/media-library/b2/status', (_req: Request, res: Response) => {
    res.json({ configured: svc.isB2Ready() });
  });

  r.get('/media-library/b2/browse', async (req: Request, res: Response) => {
    try {
      const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
      const data = await svc.browseB2(prefix);
      res.json(data);
    } catch (e: any) {
      res.status(svc.isB2Ready() ? 500 : 503).json({ message: e.message });
    }
  });

  r.post('/media-library/b2/import', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(B2ImportDto, req.body);
      const errors = await validate(dto);
      if (errors.length) {
        const msgs = errors.map(er => Object.values(er.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const { imported } = await svc.importB2Keys(dto.keys, dto.folderId);
      res.status(201).json({ imported });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.get('/media-library/migrate/candidates', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 50, maxLimit: 200 });
      const data = await svc.listMigrateCandidates(limit, offset);
      res.json({ ...data, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/media-library/assets/:id/migrate-to-b2', async (req: Request, res: Response) => {
    try {
      const row = await svc.migrateAssetToB2(req.params.id);
      res.json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  return r;
}
