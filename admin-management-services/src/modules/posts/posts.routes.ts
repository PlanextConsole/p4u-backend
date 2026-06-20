import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { PostsAdminService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateObjectionableLogDto } from './dto/update-objectionable-log.dto';

export function createPostsAdminRoutes(): Router {
  const r = Router();
  const svc = new PostsAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('post.admin.manage'));

  r.get('/advertisementFeed', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listAdvertisementFeed(limit, offset);
    res.json({ items, total, limit, offset });
  });

  r.get('/posts', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listPosts(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/posts/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getPost(req.params.id);
      if (!row) return res.status(404).json({ message: 'Post not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.post('/advertisementFeed', async (req: Request, res: Response) => {
    try {
      const row = await svc.createAdvertisementFeedItem(req.body, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.patch('/advertisementFeed/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.updateAdvertisementFeedItem(req.params.id, req.body, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Advertisement feed item not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.delete('/advertisementFeed/:id', async (req: Request, res: Response) => {
    try {
      await svc.deleteAdvertisementFeedItem(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Advertisement feed item not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.post('/add_posts', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreatePostDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createPost(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  const patchPost = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdatePostDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updatePost(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Post not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/posts/individual/:id', patchPost);
  r.patch('/posts/:id', patchPost);

  r.get('/objectionableFeedLog', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const purpose = (req.query.purpose as string | undefined) || 'all';
    const { items, total } = await svc.listObjectionableLogs(limit, offset, purpose);
    res.json({ items, total, limit, offset, purpose });
  });

  r.patch('/objectionableFeedLog/batchFeed/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateObjectionableLogDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.batchUpdateObjectionableLog(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Objectionable feed log not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.patch('/comments/batchCustomersFor/:id', async (req: Request, res: Response) => {
    try {
      const body = await svc.commentsBatchCustomersFor(req.params.id, getAuthSub(req), clientIp(req));
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.delete('/posts/:id', async (req: Request, res: Response) => {
    try {
      await svc.deletePost(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Post not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
