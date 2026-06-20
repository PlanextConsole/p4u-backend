import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { VendorAdminService } from './vendor.service';
import { VendorCascadeService } from './vendor.cascade.service';
import { OrdersAdminService } from '../orders/orders.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorEnquiryDto } from './dto/update-vendor-enquiry.dto';
import { ApproveVendorRequestDto } from './dto/approve-vendor-request.dto';
import {
  normalizeVendorWriteBody,
  parseVendorKindFilter,
  serializeVendorRow,
} from './vendor.http.helpers';

/**
 * Canonical REST paths (preferred for new clients):
 *   /vendors, /vendor-requests, /vendor-enquiries
 *
 * Legacy aliases mirror older UI paths (same handlers).
 */
export function createVendorAdminRoutes(): Router {
  const r = Router();
  const svc = new VendorAdminService();
  const cascade = new VendorCascadeService();
  const ordersSvc = new OrdersAdminService();

  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('vendor.admin.manage'));

  const listVendors = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 100, maxLimit: 500 });
      const status = req.query.status ? String(req.query.status) : undefined;
      const vendorKind = parseVendorKindFilter(req);
      const { items, total } = await svc.listVendors(limit, offset, { status, vendorKind });
      res.json({
        items: items.map(v => serializeVendorRow(v)),
        total,
        limit,
        offset,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  const getVendor = async (req: Request, res: Response) => {
    try {
      const row = await svc.getVendor(req.params.id);
      if (!row) return res.status(404).json({ message: 'Vendor not found' });
      res.json(serializeVendorRow(row));
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  const createVendor = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateVendorDto, normalizeVendorWriteBody((req.body || {}) as Record<string, unknown>));
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createVendor(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(serializeVendorRow(row));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };

  const patchVendor = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateVendorDto, normalizeVendorWriteBody((req.body || {}) as Record<string, unknown>));
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateVendor(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(serializeVendorRow(row));
    } catch (e: any) {
      const status = e.message === 'Vendor not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  const deleteVendor = async (req: Request, res: Response) => {
    try {
      await svc.deleteVendor(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Vendor not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  /* --- canonical vendors --- */
  r.get('/vendors', listVendors);
  r.post('/vendors', createVendor);
  r.get('/vendors/:id', getVendor);
  r.patch('/vendors/:id', patchVendor);
  r.delete('/vendors/:id', deleteVendor);

  /* --- legacy vendor paths --- */
  r.post('/add_vendors', createVendor);
  r.get('/vendor/:id', getVendor);
  r.patch('/vendor/:id', patchVendor);
  r.delete('/vendor/:id', deleteVendor);

  /* --- vendor requests --- */
  const listVendorRequests = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listVendorRequests(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  const deleteVendorRequest = async (req: Request, res: Response) => {
    try {
      await svc.deleteVendorRequest(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Vendor request not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  const approveVendorRequest = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(ApproveVendorRequestDto, req.body ?? {});
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const result = await svc.approveVendorRequest(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(result);
    } catch (e: any) {
      const status = e.message === 'Vendor request not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  r.get('/vendor-requests', listVendorRequests);
  r.patch('/vendor-requests/:id/approve', approveVendorRequest);
  r.delete('/vendor-requests/:id', deleteVendorRequest);
  r.get('/vendors_request', listVendorRequests);
  r.delete('/vendors_request/:id', deleteVendorRequest);

  /* --- vendor enquiries --- */
  const listEnquiries = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listVendorEnquiries(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  const getEnquiry = async (req: Request, res: Response) => {
    try {
      const row = await svc.getVendorEnquiry(req.params.id);
      if (!row) return res.status(404).json({ message: 'Vendor enquiry not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };

  const patchEnquiry = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateVendorEnquiryDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateVendorEnquiry(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Vendor enquiry not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };

  r.get('/vendor-enquiries', listEnquiries);
  r.get('/vendor-enquiries/:id', getEnquiry);
  r.patch('/vendor-enquiries/:id', patchEnquiry);
  r.get('/vendorEnquiry', listEnquiries);
  r.get('/vendorEnquiry/:id', getEnquiry);
  r.patch('/vendorEnquiry/:id', patchEnquiry);

  /* --- batch / cascade (shared DB) --- */
  const stubBatch =
    (resource: Parameters<VendorCascadeService['acknowledgeBatch']>[1]) =>
    async (req: Request, res: Response) => {
      try {
        const body = await cascade.acknowledgeBatch(
          req.params.vendorId,
          resource,
          getAuthSub(req),
          clientIp(req),
        );
        res.json(body);
      } catch (e: any) {
        res.status(500).json({ message: e.message });
      }
    };

  r.patch('/products/batchVendor/:vendorId', stubBatch('products'));
  r.patch('/orders/batchVendors/:vendorId', stubBatch('orders'));
  r.patch('/Settlements/batch/:vendorId', stubBatch('settlements'));
  r.patch('/settlements/batch/:vendorId', stubBatch('settlements'));
  r.patch('/products_Request/batch/:vendorId', stubBatch('product_requests'));
  r.patch('/products_request/batch/:vendorId', stubBatch('product_requests'));
  r.patch('/coupons/batch/:vendorId', stubBatch('coupons'));
  r.patch('/vendorReviews/batchVendors/:vendorId', stubBatch('vendor_reviews'));
  r.patch('/organizationOrders/batchVendors/:vendorId', stubBatch('organization_orders'));

  r.delete('/serviceNotifications/vendors/:vendorId', async (req: Request, res: Response) => {
    try {
      const body = await cascade.deleteServiceNotificationsForVendor(
        req.params.vendorId,
        getAuthSub(req),
        clientIp(req),
      );
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.get('/orders/vendors/:vendorId', async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await ordersSvc.listOrdersByVendor(req.params.vendorId, limit, offset);
      res.json({ vendorId: req.params.vendorId, items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return r;
}
