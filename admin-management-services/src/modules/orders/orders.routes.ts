import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { OrdersAdminService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';

export function createOrdersAdminRoutes(): Router {
  const r = Router();
  const svc = new OrdersAdminService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('order.admin.manage'));

  const listOrders = async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const status = String(req.query.status ?? '').trim() || undefined;
    const fromDate = String(req.query.fromDate ?? req.query.from ?? '').trim() || undefined;
    const toDate = String(req.query.toDate ?? req.query.to ?? '').trim() || undefined;
    const paymentMode = String(req.query.paymentMode ?? '').trim() || undefined;
    const { items, total } = await svc.listOrders(limit, offset, { status, fromDate, toDate, paymentMode });
    res.json({ items, total, limit, offset, status: status ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, paymentMode: paymentMode ?? null });
  };
  r.get('/orders/all/null', listOrders);
  r.get('/orders', listOrders);

  r.get('/orders/stats', async (req: Request, res: Response) => {
    try {
      const status = String(req.query.status ?? '').trim() || undefined;
      const fromDate = String(req.query.fromDate ?? req.query.from ?? '').trim() || undefined;
      const toDate = String(req.query.toDate ?? req.query.to ?? '').trim() || undefined;
      const stats = await svc.getOrderStats({ status, fromDate, toDate });
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/orders/individual/:id', async (req: Request, res: Response) => {
    const row = await svc.getOrder(req.params.id);
    if (!row) return res.status(404).json({ message: 'Order not found' });
    res.json(row);
  });
  r.get('/orders/individualOrder/:id', async (req: Request, res: Response) => {
    const row = await svc.getOrder(req.params.id);
    if (!row) return res.status(404).json({ message: 'Order not found' });
    res.json(row);
  });

  r.patch('/orders/individual/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateOrderDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateOrder(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Order not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });
  r.delete('/orders/individual/:id/permanent', async (req: Request, res: Response) => {
    try {
      const result = await svc.permanentlyDeleteOrders(
        [req.params.id],
        getAuthSub(req),
        clientIp(req),
      );
      res.json(result);
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });
  r.post('/orders/permanent-delete', async (req: Request, res: Response) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const result = await svc.permanentlyDeleteOrders(ids, getAuthSub(req), clientIp(req));
      res.json(result);
    } catch (e: any) {
      const status = e.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });
  r.post('/orders', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateOrderDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createOrder(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  r.get('/orders/vendors/:vendorId', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listOrdersByVendor(req.params.vendorId, limit, offset);
    res.json({ items, total, vendorId: req.params.vendorId, limit, offset });
  });

  r.get('/orders/customer/:customerId', async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listOrdersByCustomer(req.params.customerId, limit, offset);
    res.json({ items, total, customerId: req.params.customerId, limit, offset });
  });

  const listSettlements = (kind: 'all' | 'cash' | 'points') => async (req: Request, res: Response) => {
    const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
    const { items, total } = await svc.listSettlements(kind, limit, offset);
    res.json({ items, total, kind, limit, offset });
  };
  r.get('/Settlements/all/null', listSettlements('all'));
  r.get('/Settlements/allCash/null', listSettlements('cash'));
  r.get('/Settlements/allPoints/null', listSettlements('points'));
  r.get('/settlements/all/null', listSettlements('all'));

  r.get('/Settlements/individual/:id', async (req: Request, res: Response) => {
    const row = await svc.getSettlement(req.params.id);
    if (!row) return res.status(404).json({ message: 'Settlement not found' });
    res.json(row);
  });
  r.get('/Settlements/individualByVendorSingle/:id', async (req: Request, res: Response) => {
    const row = await svc.getSettlementByVendorSingle(req.params.id);
    if (!row) return res.status(404).json({ message: 'Settlement not found' });
    res.json(row);
  });

  const createSettlement = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateSettlementDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createSettlement(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/Settlements', createSettlement);
  r.post('/settlements', createSettlement);

  r.patch('/Settlements/individual/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateSettlementDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateSettlement(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Settlement not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.post('/upload/Settlements/:id', async (req: Request, res: Response) => {
    const fileUrl = (req.body?.fileUrl as string) || null;
    if (!fileUrl) return res.status(400).json({ message: 'fileUrl is required' });
    try {
      const row = await svc.updateSettlement(req.params.id, { documentUrl: fileUrl }, getAuthSub(req), clientIp(req));
      res.json({ message: 'Settlement document linked', settlement: row });
    } catch (e: any) {
      const status = e.message === 'Settlement not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  return r;
}
