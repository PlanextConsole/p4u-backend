import { Request, Response, Router } from 'express';
import { jwtAuth, requirePermission, requireRole } from '../../middleware/authMiddleware';
import { clientIp, getAuthSub, parseLimitOffset } from '../../http/adminHttp';
import { FranchiseService } from './franchise.service';

type Handler = (req: Request, res: Response) => Promise<unknown>;

export function createFranchiseAdminRoutes(): Router {
  const router = Router();
  const service = new FranchiseService();
  router.use(jwtAuth);
  router.use(requireRole('ADMIN'));
  router.use(requirePermission('franchise.admin.manage'));

  const handle = (handler: Handler) => async (req: Request, res: Response) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      const message = error?.message || 'Franchise operation failed';
      const status = message.toLowerCase().includes('not found') ? 404
        : message.toLowerCase().includes('cannot delete') ? 409 : 400;
      res.status(status).json({ message });
    }
  };
  const page = (req: Request) => parseLimitOffset(req, { limit: 20, maxLimit: 100 });
  const query = (req: Request, key: string) => typeof req.query[key] === 'string' ? String(req.query[key]) : undefined;
  const actor = (req: Request) => getAuthSub(req);
  const ip = (req: Request) => clientIp(req);

  router.get('/franchise/plans', handle(async (req, res) => {
    const { limit, offset } = page(req);
    const result = await service.listPlans(limit, offset, {
      planType: query(req, 'planType'),
      q: query(req, 'q'),
      includeInactive: req.query.includeInactive === 'true',
    });
    res.json({ ...result, limit, offset });
  }));
  router.get('/franchise/plans/:id', handle(async (req, res) => {
    const item = await service.getPlan(req.params.id);
    if (!item) return res.status(404).json({ message: 'Franchise plan not found' });
    res.json(item);
  }));
  router.post('/franchise/plans', handle(async (req, res) => {
    res.status(201).json(await service.createPlan(req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/plans/:id', handle(async (req, res) => {
    res.json(await service.updatePlan(req.params.id, req.body || {}, actor(req), ip(req)));
  }));
  router.delete('/franchise/plans/:id', handle(async (req, res) => {
    await service.deletePlan(req.params.id, actor(req), ip(req));
    res.status(204).send();
  }));

  router.get('/franchise/registrations', handle(async (req, res) => {
    const { limit, offset } = page(req);
    const result = await service.listRegistrations(limit, offset, {
      status: query(req, 'status'), planId: query(req, 'planId'), q: query(req, 'q'), state: query(req, 'state'), city: query(req, 'city'),
    });
    res.json({ ...result, limit, offset });
  }));
  router.get('/franchise/registrations/:id', handle(async (req, res) => {
    const item = await service.getRegistration(req.params.id);
    if (!item) return res.status(404).json({ message: 'Franchise registration not found' });
    res.json(item);
  }));
  router.post('/franchise/registrations', handle(async (req, res) => {
    res.status(201).json(await service.createRegistration(req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/registrations/:id', handle(async (req, res) => {
    res.json(await service.updateRegistration(req.params.id, req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/registrations/:id/approve', handle(async (req, res) => {
    res.json(await service.approveRegistration(req.params.id, actor(req), ip(req)));
  }));
  router.patch('/franchise/registrations/:id/reject', handle(async (req, res) => {
    res.json(await service.rejectRegistration(req.params.id, req.body?.rejectionReason, actor(req), ip(req)));
  }));
  router.delete('/franchise/registrations/:id', handle(async (req, res) => {
    await service.deleteRegistration(req.params.id, actor(req), ip(req));
    res.status(204).send();
  }));

  router.get('/franchise/active', handle(async (req, res) => {
    const { limit, offset } = page(req);
    const result = await service.listActive(limit, offset, {
      status: query(req, 'status'), planId: query(req, 'planId'), q: query(req, 'q'), paymentStatus: query(req, 'paymentStatus'),
      state: query(req, 'state'), city: query(req, 'city'),
    });
    res.json({ ...result, limit, offset });
  }));
  router.get('/franchise/active/:id', handle(async (req, res) => {
    const item = await service.getActive(req.params.id);
    if (!item) return res.status(404).json({ message: 'Franchise not found' });
    res.json(item);
  }));
  router.patch('/franchise/active/:id', handle(async (req, res) => {
    res.json(await service.updateActive(req.params.id, req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/active/:id/suspend', handle(async (req, res) => {
    res.json(await service.setActiveStatus(req.params.id, 'suspended', actor(req), ip(req)));
  }));
  router.patch('/franchise/active/:id/terminate', handle(async (req, res) => {
    res.json(await service.setActiveStatus(req.params.id, 'terminated', actor(req), ip(req)));
  }));

  router.get('/franchise/registration-payments', handle(async (req, res) => {
    const { limit, offset } = page(req);
    const result = await service.listPayments(limit, offset, {
      status: query(req, 'status'), q: query(req, 'q'), dateFrom: query(req, 'dateFrom'), dateTo: query(req, 'dateTo'),
    });
    res.json({ ...result, limit, offset });
  }));
  router.get('/franchise/registration-payments/:id', handle(async (req, res) => {
    const item = await service.getPayment(req.params.id);
    if (!item) return res.status(404).json({ message: 'Franchise payment not found' });
    res.json(item);
  }));
  router.post('/franchise/registration-payments', handle(async (req, res) => {
    res.status(201).json(await service.createPayment(req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/registration-payments/:id', handle(async (req, res) => {
    res.json(await service.updatePayment(req.params.id, req.body || {}, actor(req), ip(req)));
  }));

  router.get('/franchise/business-projections', handle(async (req, res) => {
    const { limit, offset } = page(req);
    const result = await service.listProjections(limit, offset, { status: query(req, 'status'), q: query(req, 'q') });
    res.json({ ...result, limit, offset });
  }));
  router.get('/franchise/business-projections/:id', handle(async (req, res) => {
    const item = await service.getProjection(req.params.id);
    if (!item) return res.status(404).json({ message: 'Franchise projection not found' });
    res.json(item);
  }));
  router.post('/franchise/business-projections', handle(async (req, res) => {
    res.status(201).json(await service.createProjection(req.body || {}, actor(req), ip(req)));
  }));
  router.patch('/franchise/business-projections/:id', handle(async (req, res) => {
    res.json(await service.updateProjection(req.params.id, req.body || {}, actor(req), ip(req)));
  }));
  router.delete('/franchise/business-projections/:id', handle(async (req, res) => {
    await service.deleteProjection(req.params.id, actor(req), ip(req));
    res.status(204).send();
  }));

  return router;
}
