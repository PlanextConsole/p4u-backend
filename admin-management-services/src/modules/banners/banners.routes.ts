import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp } from '../../http/adminHttp';
import { BannersAdminService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

export function createBannersAdminRoutes(): Router {
  const r = Router();
  const svc = new BannersAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('banner.admin.manage'));

  r.get('/allBanners', async (_req: Request, res: Response) => {
    const items = await svc.listBanners();
    res.json({ items });
  });

  r.get('/banners/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getBanner(req.params.id);
      if (!row) return res.status(404).json({ message: 'Banner not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/banners/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteBanner(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Banner not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  const createBanner = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateBannerDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createBanner(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/add_banner', createBanner);
  r.post('/banners', createBanner);

  const patchBanner = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateBannerDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateBanner(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Banner not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/Banners/:id', patchBanner);
  r.patch('/banners/:id', patchBanner);

  r.get('/popupBanner', async (_req: Request, res: Response) => {
    const items = await svc.listPopupBanners();
    res.json({ items });
  });

  r.post('/addPopupBanner', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateBannerDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createPopupBanner(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.get('/popupBanner/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getPopupBanner(req.params.id);
      if (!row) return res.status(404).json({ message: 'Popup banner not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/popupBanner/:id', async (req: Request, res: Response) => {
    try {
      await svc.deletePopupBanner(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Popup banner not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.patch('/popupBanner/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateBannerDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updatePopupBanner(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Popup banner not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
