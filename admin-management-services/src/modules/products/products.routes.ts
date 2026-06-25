import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { jwtAuth, requireRole, requirePermission } from '../../middleware/authMiddleware';
import { getAuthSub, clientIp, parseLimitOffset } from '../../http/adminHttp';
import { ProductsAdminService } from './products.service';
import { ProductVariationsService, type VariationUpsertInput } from './product-variations.service';
import { serializeProductVariation } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';
import { CreateTaxConfigurationDto } from './dto/create-tax-configuration.dto';
import { UpdateTaxConfigurationDto } from './dto/update-tax-configuration.dto';

export function createProductsAdminRoutes(): Router {
  const r = Router();
  const svc = new ProductsAdminService();
  const varSvc = new ProductVariationsService();
  r.use(jwtAuth);
  r.use(requireRole('ADMIN'));
  r.use(requirePermission('product.admin.manage'));

  const listProducts = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listProducts(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/Products/all/null', listProducts);
  r.get('/products', listProducts);

  r.get('/products/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getProduct(req.params.id);
      if (!row) return res.status(404).json({ message: 'Product not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  const createProduct = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateProductDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createProduct(dto, getAuthSub(req), clientIp(req));
      const variations = Array.isArray(req.body?.variations) ? (req.body.variations as VariationUpsertInput[]) : [];
      const productType = String((dto.metadata as Record<string, unknown> | undefined)?.productType || req.body?.metadata?.productType || 'simple');
      if (productType === 'variable' && variations.length) {
        await varSvc.replaceForProduct(row.id, variations);
      }
      const savedVars = await varSvc.listByProductId(row.id);
      res.status(201).json({ ...row, variations: savedVars.map(serializeProductVariation) });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/add_products', createProduct);
  r.post('/products', createProduct);

  const patchProduct = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateProductDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateProduct(req.params.id, dto, getAuthSub(req), clientIp(req));
      const variations = Array.isArray(req.body?.variations) ? (req.body.variations as VariationUpsertInput[]) : undefined;
      const productType = String(
        (dto.metadata as Record<string, unknown> | undefined)?.productType
          ?? req.body?.metadata?.productType
          ?? (row.metadata as Record<string, unknown> | null)?.productType
          ?? 'simple',
      );
      if (variations !== undefined) {
        if (productType === 'variable') await varSvc.replaceForProduct(row.id, variations);
        else await varSvc.deleteForProduct(row.id);
      }
      const savedVars = await varSvc.listByProductId(row.id);
      res.json({ ...row, variations: savedVars.map(serializeProductVariation) });
    } catch (e: any) {
      const status = e.message === 'Product not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/products/individual/:id', patchProduct);
  r.patch('/Products/individual/:id', patchProduct);
  r.patch('/products/:id', patchProduct);

  const deleteProduct = async (req: Request, res: Response) => {
    try {
      await svc.deleteProduct(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Product not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.delete('/product/:id', deleteProduct);
  r.delete('/products/:id', deleteProduct);

  const listTax = async (req: Request, res: Response) => {
    try {
      const all = req.query.purpose === 'all' || req.query.includeInactive === 'true';
      const items = await svc.listTaxConfiguration(all);
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/taxconfiguration', listTax);
  r.get('/taxConfiguration', listTax);

  const createTax = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(CreateTaxConfigurationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.createTaxConfiguration(dto, getAuthSub(req), clientIp(req));
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  };
  r.post('/taxconfiguration', createTax);
  r.post('/taxConfiguration', createTax);

  const patchTax = async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateTaxConfigurationDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateTaxConfiguration(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Tax configuration not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.patch('/taxconfiguration/:id', patchTax);
  r.patch('/taxConfiguration/:id', patchTax);

  const deleteTax = async (req: Request, res: Response) => {
    try {
      await svc.deleteTaxConfiguration(req.params.id, getAuthSub(req), clientIp(req));
      res.status(204).send();
    } catch (e: any) {
      const status = e.message === 'Tax configuration not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  };
  r.delete('/taxConfiguration/:id', deleteTax);
  r.delete('/taxconfiguration/:id', deleteTax);

  r.patch('/product_reviews/batchProducts/:productId', async (req: Request, res: Response) => {
    try {
      const body = await svc.batchProductReviewsCleanup(req.params.productId, getAuthSub(req), clientIp(req));
      res.json(body);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  const listProductRequests = async (req: Request, res: Response) => {
    try {
      const { limit, offset } = parseLimitOffset(req, { limit: 20, maxLimit: 100 });
      const { items, total } = await svc.listProductRequests(limit, offset);
      res.json({ items, total, limit, offset });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  };
  r.get('/products_request', listProductRequests);

  r.get('/products_request/:id', async (req: Request, res: Response) => {
    try {
      const row = await svc.getProductRequest(req.params.id);
      if (!row) return res.status(404).json({ message: 'Product request not found' });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  r.patch('/products_request/individual/:id', async (req: Request, res: Response) => {
    try {
      const dto = plainToClass(UpdateProductRequestDto, req.body);
      const errors = await validate(dto);
      if (errors.length > 0) {
        const msgs = errors.map(e => Object.values(e.constraints || {})).flat();
        return res.status(400).json({ message: msgs.join(', ') });
      }
      const row = await svc.updateProductRequest(req.params.id, dto, getAuthSub(req), clientIp(req));
      res.json(row);
    } catch (e: any) {
      const status = e.message === 'Product request not found' ? 404 : 400;
      res.status(status).json({ message: e.message });
    }
  });

  r.patch('/Products/batchTaxConfiguration/:id', async (req: Request, res: Response) => {
    const body = await svc.batchRelinkProductsForTaxConfiguration(req.params.id, getAuthSub(req), clientIp(req));
    res.json(body);
  });
  r.patch('/products_request/batchTaxConfiguration/:id', async (req: Request, res: Response) => {
    const body = await svc.batchRelinkProductRequestsForTaxConfiguration(req.params.id, getAuthSub(req), clientIp(req));
    res.json(body);
  });

  return r;
}
