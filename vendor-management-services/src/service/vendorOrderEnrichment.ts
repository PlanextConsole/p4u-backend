import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Order } from '../entities/Order';
import { Product } from '../entities/Product';

type LineRow = Record<string, unknown>;

function metaRecord(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

function orderLines(meta: Record<string, unknown>): LineRow[] {
  const raw = meta.items ?? meta.lines;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === 'object') as LineRow[];
}

function lineProductId(line: LineRow): string {
  return String(line.productId || line.product_id || '').trim();
}

async function loadProductMap(productIds: string[]): Promise<Map<string, Product>> {
  const uniq = [...new Set(productIds.filter(Boolean))];
  if (!uniq.length) return new Map();
  const rows = await AppDataSource.getRepository(Product).find({ where: { id: In(uniq) } });
  const map = new Map<string, Product>();
  for (const p of rows) map.set(p.id, p);
  return map;
}

function enrichLine(line: LineRow, product?: Product): LineRow {
  const name =
    (typeof line.name === 'string' && line.name) ||
    (typeof line.productName === 'string' && line.productName) ||
    product?.name ||
    'Product';
  const thumb =
    (typeof line.thumbnailUrl === 'string' && line.thumbnailUrl) ||
    (typeof line.thumbnail_url === 'string' && line.thumbnail_url) ||
    product?.thumbnailUrl ||
    '';
  const qty =
    typeof line.quantity === 'number'
      ? line.quantity
      : typeof line.qty === 'number'
        ? line.qty
        : 1;
  return {
    ...line,
    name,
    productName: name,
    thumbnailUrl: thumb,
    quantity: qty,
  };
}

/** Enrich order metadata for vendor portal (line names/thumbs + displayId). */
export async function enrichOrderForVendorPortal(order: Order): Promise<Order> {
  const meta = metaRecord(order.metadata);
  const lines = orderLines(meta);
  const productIds = lines.map(lineProductId).filter(Boolean);
  const products = await loadProductMap(productIds);
  const enrichedLines = lines.map((line) => enrichLine(line, products.get(lineProductId(line))));

  const displayId =
    (typeof meta.displayId === 'string' && meta.displayId.trim()) ||
    (order.orderRef && String(order.orderRef).trim()) ||
    order.id;

  order.metadata = {
    ...meta,
    displayId,
    lines: enrichedLines,
    items: enrichedLines,
  };
  return order;
}

export async function enrichOrdersForVendorPortal(orders: Order[]): Promise<Order[]> {
  const allIds = new Set<string>();
  for (const o of orders) {
    for (const line of orderLines(metaRecord(o.metadata))) {
      const pid = lineProductId(line);
      if (pid) allIds.add(pid);
    }
  }
  const products = await loadProductMap([...allIds]);
  return orders.map((order) => {
    const meta = metaRecord(order.metadata);
    const lines = orderLines(meta);
    const enrichedLines = lines.map((line) => enrichLine(line, products.get(lineProductId(line))));
    const displayId =
      (typeof meta.displayId === 'string' && meta.displayId.trim()) ||
      (order.orderRef && String(order.orderRef).trim()) ||
      order.id;
    order.metadata = {
      ...meta,
      displayId,
      lines: enrichedLines,
      items: enrichedLines,
    };
    return order;
  });
}

const COUNTABLE_STATUSES = new Set(['completed', 'delivered', 'paid', 'shipped']);

/** Sum units sold per product for a vendor (from order metadata lines). */
export async function countUnitsSoldByProduct(
  vendorId: string,
  productIds: string[],
): Promise<Record<string, number>> {
  const want = new Set(productIds.filter(Boolean));
  if (!want.size) return {};
  const orders = await AppDataSource.getRepository(Order).find({
    where: { vendorId },
    select: ['status', 'metadata'],
  });
  const out: Record<string, number> = {};
  for (const o of orders) {
    if (!COUNTABLE_STATUSES.has(String(o.status || '').toLowerCase())) continue;
    for (const line of orderLines(metaRecord(o.metadata))) {
      const pid = lineProductId(line);
      if (!want.has(pid)) continue;
      const qty =
        typeof line.quantity === 'number'
          ? line.quantity
          : typeof line.qty === 'number'
            ? line.qty
            : 1;
      out[pid] = (out[pid] || 0) + Math.max(0, Number(qty) || 0);
    }
  }
  return out;
}
