import { Request, Response, Router } from 'express';
import {
  sendBadRequest,
  sendCreated,
  sendForbidden,
  sendNotFound,
  sendServerError,
  sendSuccess,
  sendUnauthorized,
} from '../middleware/responseEnvelope';
import { FoodService, FoodOrderRequest } from '../service/food.service';
import { FoodPhase2Service } from '../service/foodPhase2.service';
import { resolveVendorIdFromAuth } from '../service/vendorContext.service';

function auth(req: Request): any {
  return (req as any).auth;
}

function subject(req: Request): string | null {
  const value = auth(req)?.customer_id || auth(req)?.sub;
  return value ? String(value) : null;
}

function hasRole(req: Request, role: string): boolean {
  return (auth(req)?.realm_access?.roles || []).some((value: unknown) => String(value).toUpperCase() === role);
}

function publicRestaurant<T extends Record<string, unknown>>(row: T) {
  const { commissionRate: _commissionRate, ...safe } = row;
  return safe;
}

function paging(req: Request) {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || 20), 10) || 20, 1), 100);
  const offset = Math.max(parseInt(String(req.query.offset || 0), 10) || 0, 0);
  return { limit, offset };
}

function errorResponse(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Food service request failed';
  if (/not found/i.test(message)) return sendNotFound(res, message);
  return sendBadRequest(res, message);
}

export function createFoodPublicRoutes(): Router {
  const router = Router();
  const service = new FoodService();
  const phase2 = new FoodPhase2Service();

  router.get('/coupons', async (req: Request, res: Response) => {
    try { sendSuccess(res, await phase2.listCoupons(req.query.restaurantId ? String(req.query.restaurantId) : undefined)); } catch (error) { errorResponse(res, error); }
  });

  router.post('/payments/webhook', async (req: Request, res: Response) => {
    try { sendSuccess(res, await phase2.processPaymentWebhook(req.body || {}, req.header('x-food-signature'), (req as any).rawBody)); } catch (error) { errorResponse(res, error); }
  });
  router.post('/payments/refund-webhook', async (req: Request, res: Response) => {
    try { sendSuccess(res, await phase2.processRefundWebhook(req.body || {}, req.header('x-food-signature'), (req as any).rawBody)); } catch (error) { errorResponse(res, error); }
  });

  router.get('/restaurants', async (req: Request, res: Response) => {
    try {
      const lat = req.query.lat == null ? undefined : Number(req.query.lat);
      const lng = req.query.lng == null ? undefined : Number(req.query.lng);
      if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) {
        return sendBadRequest(res, 'lat and lng must be valid numbers');
      }
      const data = await service.listRestaurants({
        search: req.query.search ? String(req.query.search) : undefined,
        cuisine: req.query.cuisine ? String(req.query.cuisine) : undefined,
        vegOnly: String(req.query.vegOnly || '').toLowerCase() === 'true',
        lat,
        lng,
      });
      sendSuccess(res, data);
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.get('/restaurants/:restaurantId/combos', async (req: Request, res: Response) => {
    try { sendSuccess(res, await phase2.listCombos(req.params.restaurantId)); } catch (error) { errorResponse(res, error); }
  });

  router.get('/restaurants/:restaurantId', async (req: Request, res: Response) => {
    try {
      const row = await service.getRestaurant(req.params.restaurantId);
      if (!row) return sendNotFound(res, 'Restaurant not found');
      sendSuccess(res, publicRestaurant(row as unknown as Record<string, unknown>));
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.get('/restaurants/:restaurantId/menu', async (req: Request, res: Response) => {
    try {
      const data = await service.getMenu(req.params.restaurantId);
      sendSuccess(res, { ...data, restaurant: publicRestaurant(data.restaurant as unknown as Record<string, unknown>) });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.get('/restaurants/:restaurantId/reviews', async (req: Request, res: Response) => {
    try {
      const restaurant = await service.getRestaurant(req.params.restaurantId);
      if (!restaurant) return sendNotFound(res, 'Restaurant not found');
      const { limit, offset } = paging(req);
      const result = await service.listRestaurantReviews(restaurant.id, limit, offset);
      sendSuccess(res, result.items, 200, { total: result.total, limit, offset });
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  return router;
}

export function createFoodProtectedRoutes(): Router {
  const router = Router();
  const service = new FoodService();
  const phase2 = new FoodPhase2Service();

  router.post('/orders', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    if (!hasRole(req, 'CUSTOMER') && !hasRole(req, 'VENDOR') && !hasRole(req, 'ADMIN')) return sendForbidden(res);
    try {
      sendCreated(res, await service.placeOrder(customerId, req.body as FoodOrderRequest));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.get('/orders', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      const { limit, offset } = paging(req);
      const result = await service.listCustomerOrders(customerId, limit, offset);
      sendSuccess(res, result.items, 200, { total: result.total, limit, offset });
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.get('/orders/:orderId', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      const order = await service.getCustomerOrder(customerId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, order);
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.post('/orders/:orderId/cancel', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      sendSuccess(res, await service.cancelCustomerOrder(customerId, req.params.orderId, String(req.body?.reason || '')));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.get('/orders/:orderId/chat', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      const order = await service.getCustomerOrder(customerId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, await service.listChat(order));
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.get('/orders/:orderId/history', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      const order = await service.getCustomerOrder(customerId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, await service.listOrderHistory(order));
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.post('/orders/:orderId/chat', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      const order = await service.getCustomerOrder(customerId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendCreated(res, await service.sendChat(order, customerId, 'customer', String(req.body?.message || '')));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.post('/orders/:orderId/review', async (req: Request, res: Response) => {
    const customerId = subject(req);
    if (!customerId) return sendUnauthorized(res);
    try {
      sendCreated(res, await service.createReview(customerId, req.params.orderId, req.body || {}));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.get('/vendor/restaurant', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      sendSuccess(res, await service.getVendorRestaurant(vendorId));
    } catch (error) {
      sendServerError(res, error instanceof Error ? error.message : undefined);
    }
  });

  router.put('/vendor/restaurant', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      sendSuccess(res, await service.saveVendorRestaurant(vendorId, req.body || {}));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.get('/vendor/menu', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const restaurant = await service.getVendorRestaurant(vendorId);
      if (!restaurant) return sendNotFound(res, 'Restaurant not found');
      sendSuccess(res, await service.getMenu(restaurant.id, true));
    } catch (error) {
      errorResponse(res, error);
    }
  });

  router.post('/vendor/menu/categories', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { sendCreated(res, await service.saveCategory(vendorId, req.body || {})); } catch (error) { errorResponse(res, error); }
  });

  router.patch('/vendor/menu/categories/:categoryId', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { sendSuccess(res, await service.saveCategory(vendorId, { ...req.body, id: req.params.categoryId })); } catch (error) { errorResponse(res, error); }
  });

  router.delete('/vendor/menu/categories/:categoryId', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { await service.deleteCategory(vendorId, req.params.categoryId); sendSuccess(res, { deleted: true }); } catch (error) { errorResponse(res, error); }
  });

  router.post('/vendor/menu/items', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { sendCreated(res, await service.saveMenuItem(vendorId, req.body || {})); } catch (error) { errorResponse(res, error); }
  });

  router.patch('/vendor/menu/items/:itemId', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { sendSuccess(res, await service.saveMenuItem(vendorId, { ...req.body, id: req.params.itemId })); } catch (error) { errorResponse(res, error); }
  });

  router.delete('/vendor/menu/items/:itemId', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try { await service.deleteMenuItem(vendorId, req.params.itemId); sendSuccess(res, { deleted: true }); } catch (error) { errorResponse(res, error); }
  });

  router.get('/vendor/orders', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const { limit, offset } = paging(req);
      const result = await service.listVendorOrders(vendorId, req.query.status ? String(req.query.status) : undefined, limit, offset);
      sendSuccess(res, result);
    } catch (error) { errorResponse(res, error); }
  });

  router.get('/vendor/orders/:orderId', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const order = await service.getVendorOrder(vendorId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, order);
    } catch (error) { errorResponse(res, error); }
  });

  router.patch('/vendor/orders/:orderId/status', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      sendSuccess(res, await service.changeVendorOrderStatus(
        vendorId, req.params.orderId, String(req.body?.status || ''), req.body?.note ? String(req.body.note) : undefined,
      ));
    } catch (error) { errorResponse(res, error); }
  });

  router.get('/vendor/orders/:orderId/chat', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const order = await service.getVendorOrder(vendorId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, await service.listChat(order));
    } catch (error) { errorResponse(res, error); }
  });

  router.get('/vendor/orders/:orderId/history', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const order = await service.getVendorOrder(vendorId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendSuccess(res, await service.listOrderHistory(order));
    } catch (error) { errorResponse(res, error); }
  });

  router.post('/vendor/orders/:orderId/chat', async (req: Request, res: Response) => {
    const vendorId = await vendorIdForRequest(req, res);
    if (!vendorId) return;
    try {
      const order = await service.getVendorOrder(vendorId, req.params.orderId);
      if (!order) return sendNotFound(res, 'Food order not found');
      sendCreated(res, await service.sendChat(order, vendorId, 'vendor', String(req.body?.message || '')));
    } catch (error) { errorResponse(res, error); }
  });

  return router;
}

async function vendorIdForRequest(req: Request, res: Response): Promise<string | null> {
  if (!hasRole(req, 'VENDOR') && !hasRole(req, 'ADMIN')) {
    sendForbidden(res, 'Vendor access required');
    return null;
  }
  try {
    const vendorId = await resolveVendorIdFromAuth(auth(req));
    if (!vendorId) sendForbidden(res, 'Vendor profile not found');
    return vendorId;
  } catch (error) {
    sendServerError(res, error instanceof Error ? error.message : undefined);
    return null;
  }
}
