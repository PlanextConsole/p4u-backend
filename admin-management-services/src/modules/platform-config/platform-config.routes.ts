import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { PlatformConfigAdminService } from './platform-config.service';
import { CreatePlatformVariableDto } from './dto/create-platform-variable.dto';
import { UpdatePlatformVariableDto } from './dto/update-platform-variable.dto';
import { UpdateWebsiteQueryDto } from './dto/update-website-query.dto';

export function createPlatformConfigAdminRoutes(): Router {
  const r = Router();
  const svc = new PlatformConfigAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('platform.config.admin.manage'));

  r.get('/platformVariables', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 200 });
    const { items, total } = await svc.listPlatformVariables(limit, offset);
    res.json({ items, total, limit, offset });
  });

  r.get('/platformVariables/by-key/:key', async (req: Request, res: Response) => {
    try {
      const raw = req.params.key ?? '';
      const key = decodeURIComponent(raw);
      const row = await svc.getPlatformVariableByKey(key);
      res.json({ item: row });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.post('/platformVariables', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreatePlatformVariableDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createPlatformVariable(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/platformVariables/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdatePlatformVariableDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updatePlatformVariable(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Platform variable not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/platformVariables/:id', async (req: Request, res: Response) => {
    try {
      await svc.deletePlatformVariable(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Platform variable not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.get('/websiteQueries', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 200 });
    const { items, total } = await svc.listWebsiteQueries(limit, offset);
    res.json({ items, total, limit, offset });
  });

  r.patch('/websiteQueries/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateWebsiteQueryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateWebsiteQuery(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Website query not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
