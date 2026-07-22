import { randomInt, randomUUID } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { FoodMenuCategory } from '../entities/FoodMenuCategory';
import { FoodMenuItem } from '../entities/FoodMenuItem';
import { FoodOrder } from '../entities/FoodOrder';
import { FoodOrderChat } from '../entities/FoodOrderChat';
import { FoodOrderStatusHistory } from '../entities/FoodOrderStatusHistory';
import { FoodRestaurant } from '../entities/FoodRestaurant';
import { FoodReview } from '../entities/FoodReview';

type JsonRecord = Record<string, unknown>;

export interface FoodOrderRequest {
  restaurantId: string;
  items: Array<{
    menuItemId?: string;
    comboId?: string;
    quantity: number;
    addonIds?: string[];
    customizations?: JsonRecord;
  }>;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  riderTip?: number;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  customerNotes?: string;
  scheduledFor?: string;
  couponCode?: string;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const moneyString = (value: number) => money(value).toFixed(2);

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0' || normalized === '') return false;
  }
  return Boolean(value);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function selectedAddons(item: FoodMenuItem, requestedIds: string[] | undefined) {
  const definitions = Array.isArray(item.addons) ? item.addons : [];
  const wanted = new Set((requestedIds || []).map(String));
  const selected = definitions.filter((entry): entry is JsonRecord => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const record = entry as JsonRecord;
    return wanted.has(String(record.id ?? record.name ?? ''));
  });
  if (selected.length !== wanted.size) throw new Error(`Invalid add-on selected for ${item.name}`);
  return selected.map((entry) => ({
    id: String(entry.id ?? entry.name),
    name: String(entry.name ?? entry.id),
    price: money(finiteNumber(entry.price)),
  }));
}

function selectedCustomizations(item: FoodMenuItem, requested: JsonRecord | undefined) {
  const definitions = Array.isArray(item.customizations) ? item.customizations : [];
  const selections: JsonRecord = {};
  let extra = 0;
  for (const definition of definitions) {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) continue;
    const group = definition as JsonRecord;
    const key = String(group.id ?? group.name ?? '');
    const raw = requested?.[key];
    if ((raw == null || raw === '') && booleanValue(group.required)) throw new Error(`${group.name ?? key} is required for ${item.name}`);
    if (raw == null || raw === '') continue;
    const selected = Array.isArray(raw) ? raw.map(String) : [String(raw)];
    const options = Array.isArray(group.options) ? group.options : [];
    const normalized = options.map(option => typeof option === 'object' && option !== null
      ? { id: String((option as JsonRecord).id ?? (option as JsonRecord).name), price: finiteNumber((option as JsonRecord).price) }
      : { id: String(option), price: 0 });
    for (const value of selected) {
      const match = normalized.find(option => option.id === value);
      if (!match) throw new Error(`Invalid ${group.name ?? key} selection for ${item.name}`);
      extra += match.price;
    }
    selections[key] = Array.isArray(raw) ? selected : selected[0];
  }
  for (const key of Object.keys(requested || {})) {
    const known = definitions.some(definition => definition && typeof definition === 'object'
      && String((definition as JsonRecord).id ?? (definition as JsonRecord).name ?? '') === key);
    if (!known) throw new Error(`Unknown customization ${key} for ${item.name}`);
  }
  return { selections, price: money(extra) };
}
export class FoodService {
  async listRestaurants(options: {
    search?: string;
    cuisine?: string;
    vegOnly?: boolean;
    lat?: number;
    lng?: number;
  }) {
    const repo = AppDataSource.getRepository(FoodRestaurant);
    const rows = await repo.find({ where: { isActive: true }, order: { rating: 'DESC', name: 'ASC' } });
    const search = options.search?.trim().toLowerCase();
    const cuisine = options.cuisine?.trim().toLowerCase();
    return rows
      .filter((row) => !options.vegOnly || row.vegOnly)
      .filter((row) => !search || row.name.toLowerCase().includes(search)
        || (row.cuisine || []).some((value) => value.toLowerCase().includes(search)))
      .filter((row) => !cuisine || (row.cuisine || []).some((value) => value.toLowerCase() === cuisine))
      .map((row) => {
        const distanceKm = options.lat != null && options.lng != null
          && row.latitude != null && row.longitude != null
          ? haversineKm(options.lat, options.lng, Number(row.latitude), Number(row.longitude))
          : null;
        const { commissionRate: _commissionRate, ...publicRow } = row;
        return { ...publicRow, distanceKm: distanceKm == null ? null : money(distanceKm) };
      })
      .filter((row) => row.distanceKm == null || row.distanceKm <= Number(row.deliveryRadiusKm))
      .sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE));
  }

  async getRestaurant(id: string, includeInactive = false): Promise<FoodRestaurant | null> {
    const row = await AppDataSource.getRepository(FoodRestaurant).findOne({ where: { id } });
    return row && (includeInactive || row.isActive) ? row : null;
  }

  async getMenu(restaurantId: string, includeInactive = false) {
    const restaurant = await this.getRestaurant(restaurantId, includeInactive);
    if (!restaurant) throw new Error('Restaurant not found');
    const [categories, items] = await Promise.all([
      AppDataSource.getRepository(FoodMenuCategory).find({
        where: { restaurantId, ...(includeInactive ? {} : { isActive: true }) },
        order: { displayOrder: 'ASC', name: 'ASC' },
      }),
      AppDataSource.getRepository(FoodMenuItem).find({
        where: { restaurantId },
        order: { displayOrder: 'ASC', name: 'ASC' },
      }),
    ]);
    return { restaurant, categories, items: includeInactive ? items : items.filter((item) => item.inStock) };
  }

  async getVendorRestaurant(vendorId: string) {
    return AppDataSource.getRepository(FoodRestaurant).findOne({ where: { vendorId } });
  }

  async saveVendorRestaurant(vendorId: string, input: JsonRecord) {
    const repo = AppDataSource.getRepository(FoodRestaurant);
    const row = (await repo.findOne({ where: { vendorId } })) || repo.create({ vendorId });
    const stringFields: Array<keyof FoodRestaurant> = [
      'name', 'tagline', 'description', 'coverImage', 'logoUrl', 'fssaiLicense', 'address',
      'cityId', 'areaId', 'phone', 'email', 'openingTime', 'closingTime', 'status',
    ];
    for (const field of stringFields) if (input[field] !== undefined) (row as any)[field] = input[field];
    const numberFields: Array<keyof FoodRestaurant> = [
      'latitude', 'longitude', 'avgPrepMinutes', 'deliveryRadiusKm', 'packagingFee', 'minOrderAmount',
    ];
    for (const field of numberFields) {
      if (input[field] !== undefined) (row as any)[field] = String(finiteNumber(input[field]));
    }
    if (input.cuisine !== undefined) row.cuisine = Array.isArray(input.cuisine) ? input.cuisine.map(String) : [];
    if (input.galleryUrls !== undefined) row.galleryUrls = Array.isArray(input.galleryUrls) ? input.galleryUrls.map(String) : [];
    if (input.vegOnly !== undefined) row.vegOnly = booleanValue(input.vegOnly);
    if (input.isActive !== undefined) row.isActive = booleanValue(input.isActive);
    row.status = row.status || 'offline';
    if (!row.name?.trim() || !row.address?.trim()) throw new Error('Restaurant name and address are required');
    if (!['open', 'closed', 'busy', 'offline'].includes(row.status)) throw new Error('Invalid restaurant status');
    if (finiteNumber(row.avgPrepMinutes, 30) < 1 || finiteNumber(row.avgPrepMinutes, 30) > 240) throw new Error('Preparation time must be between 1 and 240 minutes');
    if (finiteNumber(row.deliveryRadiusKm, 10) <= 0 || finiteNumber(row.deliveryRadiusKm, 10) > 100) throw new Error('Delivery radius must be between 0 and 100 km');
    if (finiteNumber(row.packagingFee) < 0 || finiteNumber(row.minOrderAmount) < 0) throw new Error('Restaurant fees cannot be negative');
    return repo.save(row);
  }

  async saveCategory(vendorId: string, input: JsonRecord) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    const repo = AppDataSource.getRepository(FoodMenuCategory);
    const id = input.id ? String(input.id) : '';
    const row = id ? await repo.findOne({ where: { id, restaurantId: restaurant.id } }) : repo.create();
    if (!row) throw new Error('Menu category not found');
    row.restaurantId = restaurant.id;
    row.name = String(input.name ?? row.name ?? '').trim();
    row.displayOrder = Math.max(0, Math.trunc(finiteNumber(input.displayOrder, row.displayOrder || 0)));
    if (input.isActive !== undefined) row.isActive = booleanValue(input.isActive);
    if (!row.name) throw new Error('Category name is required');
    return repo.save(row);
  }

  async deleteCategory(vendorId: string, categoryId: string) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    const repo = AppDataSource.getRepository(FoodMenuCategory);
    const row = await repo.findOne({ where: { id: categoryId, restaurantId: restaurant.id } });
    if (!row) throw new Error('Menu category not found');
    await repo.remove(row);
  }

  async saveMenuItem(vendorId: string, input: JsonRecord) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    const repo = AppDataSource.getRepository(FoodMenuItem);
    const id = input.id ? String(input.id) : '';
    const row = id ? await repo.findOne({ where: { id, restaurantId: restaurant.id } }) : repo.create();
    if (!row) throw new Error('Menu item not found');
    row.restaurantId = restaurant.id;
    if (input.categoryId !== undefined) {
      const categoryId = input.categoryId ? String(input.categoryId) : null;
      if (categoryId) {
        const category = await AppDataSource.getRepository(FoodMenuCategory).findOne({
          where: { id: categoryId, restaurantId: restaurant.id },
        });
        if (!category) throw new Error('Menu category not found');
      }
      row.categoryId = categoryId;
    }
    for (const field of ['name', 'description', 'spiceLevel', 'imageUrl'] as const) {
      if (input[field] !== undefined) (row as any)[field] = input[field];
    }
    for (const field of ['price', 'discountedPrice', 'gstRate'] as const) {
      if (input[field] !== undefined) (row as any)[field] = input[field] == null ? null : moneyString(finiteNumber(input[field]));
    }
    for (const field of ['serves', 'prepMinutes', 'displayOrder', 'calories'] as const) {
      if (input[field] !== undefined) (row as any)[field] = input[field] == null ? null : Math.max(0, Math.trunc(finiteNumber(input[field])));
    }
    for (const field of ['isVeg', 'inStock', 'isBestseller'] as const) {
      if (input[field] !== undefined) (row as any)[field] = booleanValue(input[field]);
    }
    for (const field of ['addons', 'customizations', 'dietaryTags', 'galleryUrls'] as const) {
      if (input[field] !== undefined) (row as any)[field] = Array.isArray(input[field]) ? input[field] : [];
    }
    if (!row.name?.trim()) throw new Error('Menu item name is required');
    if (!(finiteNumber(row.price) > 0)) throw new Error('Menu item price must be greater than zero');
    if (row.discountedPrice != null && (finiteNumber(row.discountedPrice) <= 0 || finiteNumber(row.discountedPrice) >= finiteNumber(row.price))) {
      throw new Error('Discounted price must be greater than zero and less than the regular price');
    }
    return repo.save(row);
  }

  async deleteMenuItem(vendorId: string, itemId: string) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    const repo = AppDataSource.getRepository(FoodMenuItem);
    const row = await repo.findOne({ where: { id: itemId, restaurantId: restaurant.id } });
    if (!row) throw new Error('Menu item not found');
    await repo.remove(row);
  }

  async placeOrder(customerId: string, request: FoodOrderRequest) {
    if (!request.restaurantId || !request.deliveryAddress?.trim() || !request.paymentMethod) {
      throw new Error('restaurantId, deliveryAddress and paymentMethod are required');
    }
    if (!Array.isArray(request.items) || request.items.length === 0) throw new Error('Order must contain items');
    if (!['cod', 'upi', 'card', 'netbanking', 'wallet', 'emi'].includes(request.paymentMethod.toLowerCase())) {
      throw new Error('Unsupported payment method');
    }
    if (request.deliveryLat != null && (!Number.isFinite(request.deliveryLat) || request.deliveryLat < -90 || request.deliveryLat > 90)) {
      throw new Error('deliveryLat must be between -90 and 90');
    }
    if (request.deliveryLng != null && (!Number.isFinite(request.deliveryLng) || request.deliveryLng < -180 || request.deliveryLng > 180)) {
      throw new Error('deliveryLng must be between -180 and 180');
    }
    const scheduledFor = request.scheduledFor ? new Date(request.scheduledFor) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) throw new Error('scheduledFor must be a valid date');
    if (scheduledFor && scheduledFor.getTime() < Date.now() + 30 * 60 * 1000) throw new Error('Scheduled orders require at least 30 minutes notice');
    if (scheduledFor && scheduledFor.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) throw new Error('Scheduled orders can be placed up to 7 days ahead');
    return AppDataSource.transaction(async (manager) => {
      const restaurant = await manager.getRepository(FoodRestaurant).findOne({
        where: { id: request.restaurantId, isActive: true },
      });
      if (!restaurant || !['open', 'busy'].includes(restaurant.status)) throw new Error('Restaurant is not accepting orders');
      for (const line of request.items) {
        if (Boolean(line.menuItemId) === Boolean(line.comboId)) throw new Error('Each order line must contain exactly one menuItemId or comboId');
      }
      const comboIds = [...new Set(request.items.filter(line => line.comboId).map(line => String(line.comboId)))];
      const combos = comboIds.length ? await manager.createQueryBuilder().select('combo.*').from('food_combos', 'combo')
        .where('combo.restaurant_id = :restaurantId AND combo.id IN (:...comboIds)', { restaurantId: restaurant.id, comboIds }).getRawMany() : [];
      if (combos.length !== comboIds.length) throw new Error('One or more combos are invalid');
      const now = Date.now();
      for (const combo of combos) {
        if (!booleanValue(combo.is_active) || !booleanValue(combo.in_stock)
          || (combo.starts_at && new Date(combo.starts_at).getTime() > now)
          || (combo.expires_at && new Date(combo.expires_at).getTime() <= now)) throw new Error(`${combo.name || 'Combo'} is unavailable`);
      }
      const comboItemIds = combos.flatMap(combo => Array.isArray(combo.item_ids) ? combo.item_ids.map(String) : JSON.parse(String(combo.item_ids || '[]')).map(String));
      const requestedItemIds = request.items.filter(line => line.menuItemId).map(line => String(line.menuItemId));
      const ids = [...new Set([...requestedItemIds, ...comboItemIds])];
      const menuItems = ids.length ? await manager.getRepository(FoodMenuItem).find({ where: { id: In(ids), restaurantId: restaurant.id } }) : [];
      const byId = new Map(menuItems.map((item) => [item.id, item]));
      if (requestedItemIds.some(id => !byId.has(id)) || comboItemIds.some(id => !byId.has(id))) throw new Error('One or more menu items are invalid');
      const comboById = new Map(combos.map(combo => [String(combo.id), combo]));
      let subtotal = 0;
      let gst = 0;
      let maxPrep = restaurant.avgPrepMinutes;
      const lines = request.items.map((requestItem) => {
        const quantity = Math.trunc(finiteNumber(requestItem.quantity));
        if (quantity < 1 || quantity > 25) throw new Error('Item quantity must be between 1 and 25');
        if (requestItem.comboId) {
          const combo = comboById.get(String(requestItem.comboId));
          if (!combo) throw new Error('Combo is unavailable');
          const childIds: string[] = Array.isArray(combo.item_ids) ? combo.item_ids.map(String) : JSON.parse(String(combo.item_ids || '[]')).map(String);
          const children = childIds.map(id => byId.get(id));
          if (children.some(item => !item?.inStock)) throw new Error(`${combo.name} contains an unavailable item`);
          const unitPrice = finiteNumber(combo.price); const lineSubtotal = money(unitPrice * quantity);
          const taxRate = Math.max(0, ...children.map(item => finiteNumber(item?.gstRate, 5)));
          const lineGst = money(lineSubtotal * taxRate / 100); subtotal += lineSubtotal; gst += lineGst;
          maxPrep = Math.max(maxPrep, ...children.map(item => item?.prepMinutes || 0));
          return { menuItemId: `combo:${combo.id}`, comboId: combo.id, name: combo.name, imageUrl: combo.image_url || null,
            quantity, unitPrice: money(unitPrice), lineSubtotal, gst: lineGst, addons: [], customizations: {},
            isVeg: children.every(item => item?.isVeg), comboItemIds: childIds };
        }
        const item = byId.get(String(requestItem.menuItemId));
        if (!item || !item.inStock) throw new Error(`${item?.name || 'Menu item'} is unavailable`);
        const addons = selectedAddons(item, requestItem.addonIds);
        const customization = selectedCustomizations(item, requestItem.customizations);
        const unitPrice = finiteNumber(item.discountedPrice ?? item.price) + addons.reduce((sum, addon) => sum + addon.price, 0) + customization.price;
        const lineSubtotal = money(unitPrice * quantity); const lineGst = money(lineSubtotal * finiteNumber(item.gstRate) / 100);
        subtotal += lineSubtotal; gst += lineGst; maxPrep = Math.max(maxPrep, item.prepMinutes);
        return { menuItemId: item.id, name: item.name, imageUrl: item.imageUrl, quantity,
          unitPrice: money(unitPrice), lineSubtotal, gst: lineGst, addons, customizations: customization.selections, isVeg: item.isVeg };
      });
      subtotal = money(subtotal);
      if (subtotal < finiteNumber(restaurant.minOrderAmount)) throw new Error(`Minimum order amount is ${restaurant.minOrderAmount}`);
      const canMeasure = request.deliveryLat != null && request.deliveryLng != null
        && restaurant.latitude != null && restaurant.longitude != null;
      const distanceKm = canMeasure
        ? haversineKm(Number(restaurant.latitude), Number(restaurant.longitude), request.deliveryLat!, request.deliveryLng!)
        : null;
      if (distanceKm != null && distanceKm > finiteNumber(restaurant.deliveryRadiusKm)) throw new Error('Delivery address is outside the delivery area');
      const deliveryFee = distanceKm == null ? 25 : money(25 + Math.max(0, distanceKm - 1) * 8);
      const riderPayout = distanceKm == null ? 20 : money(20 + distanceKm * 6);
      const packagingFee = finiteNumber(restaurant.packagingFee);
      const riderTip = Math.max(0, finiteNumber(request.riderTip));
      const platformFee = 5;
      let coupon: { id: string; code: string; discount: number } | null = null;
      if (request.couponCode?.trim()) {
        const row = await manager.createQueryBuilder().select('coupon.*').from('food_coupons', 'coupon')
          .where('UPPER(coupon.code) = UPPER(:code)', { code: request.couponCode.trim() }).setLock('pessimistic_write').getRawOne();
        if (!row || !booleanValue(row.is_active)) throw new Error('Invalid coupon code');
        const now = Date.now();
        if (new Date(row.starts_at).getTime() > now || (row.expires_at && new Date(row.expires_at).getTime() <= now)) throw new Error('Coupon is not currently active');
        if (!booleanValue(row.is_platform_wide) && row.restaurant_id && row.restaurant_id !== restaurant.id) throw new Error('Coupon is not valid for this restaurant');
        if (subtotal < finiteNumber(row.min_order_amount)) throw new Error(`Minimum order amount is ${row.min_order_amount}`);
        if (row.total_usage_limit != null && finiteNumber(row.usage_count) >= finiteNumber(row.total_usage_limit)) throw new Error('Coupon usage limit reached');
        const used = await manager.createQueryBuilder().select('COUNT(*)', 'count').from('food_coupon_redemptions', 'r')
          .where('r.coupon_id = :couponId AND r.customer_id = :customerId', { couponId: row.id, customerId }).setLock('pessimistic_write').getRawOne();
        if (finiteNumber(used?.count) >= finiteNumber(row.per_customer_limit, 1)) throw new Error('Coupon customer usage limit reached');
        let discountValue = row.discount_type === 'percent' ? subtotal * finiteNumber(row.discount_value) / 100 : finiteNumber(row.discount_value);
        if (row.max_discount != null) discountValue = Math.min(discountValue, finiteNumber(row.max_discount));
        coupon = { id: row.id, code: row.code, discount: money(Math.min(subtotal, discountValue)) };
      }
      const discount = coupon?.discount || 0;
      const total = money(Math.max(0, subtotal + gst + packagingFee + deliveryFee + riderTip + platformFee - discount));
      const platformCut = money(subtotal * finiteNumber(restaurant.commissionRate) / 100 + platformFee);
      const order = manager.getRepository(FoodOrder).create({
        orderRef: `FOOD-${Date.now()}-${randomInt(100, 1000)}`,
        customerId, customerName: request.customerName?.trim() || null,
        customerPhone: request.customerPhone?.trim() || null,
        restaurantId: restaurant.id, restaurantName: restaurant.name, items: lines,
        subtotal: moneyString(subtotal), packagingFee: moneyString(packagingFee),
        deliveryFee: moneyString(deliveryFee), riderTip: moneyString(riderTip), gst: moneyString(gst),
        platformFee: moneyString(platformFee), discount: moneyString(discount), pointsUsed: 0, total: moneyString(total),
        riderPayout: moneyString(riderPayout), restaurantPayout: moneyString(Math.max(0, subtotal - platformCut)),
        platformCut: moneyString(platformCut), deliveryAddress: request.deliveryAddress.trim(),
        deliveryLat: request.deliveryLat == null ? null : String(request.deliveryLat),
        deliveryLng: request.deliveryLng == null ? null : String(request.deliveryLng),
        distanceKm: distanceKm == null ? null : moneyString(distanceKm),
        etaMinutes: maxPrep + (distanceKm == null ? 15 : Math.ceil(distanceKm * 2)) + 5,
        handoverOtp: String(randomInt(1000, 10000)), paymentMethod: request.paymentMethod,
        paymentStatus: request.paymentMethod.toLowerCase() === 'cod' ? 'pending' : 'pending',
        status: 'placed', customerNotes: request.customerNotes?.trim() || null,
        cancellationReason: null, scheduledFor, metadata: coupon ? { couponCode: coupon.code } : null,
        placedAt: new Date(), acceptedAt: null, readyAt: null, pickedUpAt: null,
        deliveredAt: null, cancelledAt: null,
      });
      const saved = await manager.getRepository(FoodOrder).save(order);
      await manager.getRepository(FoodOrderStatusHistory).save({ id: randomUUID(), orderId: saved.id, status: 'placed', changedBy: customerId, note: null });
      for (const item of menuItems) {
        const direct = request.items.filter(line => line.menuItemId === item.id).reduce((sum, line) => sum + Math.trunc(line.quantity), 0);
        const bundled = request.items.filter(line => line.comboId && (comboById.get(String(line.comboId))?.item_ids || []).map(String).includes(item.id))
          .reduce((sum, line) => sum + Math.trunc(line.quantity), 0);
        if (direct + bundled > 0) await manager.getRepository(FoodMenuItem).increment({ id: item.id }, 'orderCount', direct + bundled);
      }
      await manager.getRepository(FoodRestaurant).increment({ id: restaurant.id }, 'totalOrders', 1);
      if (coupon) {
        await manager.createQueryBuilder().insert().into('food_coupon_redemptions').values({ id: randomUUID(), coupon_id: coupon.id,
          coupon_code: coupon.code, customer_id: customerId, order_id: saved.id, discount_applied: coupon.discount }).execute();
        await manager.createQueryBuilder().update('food_coupons').set({ usage_count: () => 'usage_count + 1' }).where('id = :id', { id: coupon.id }).execute();
        await manager.createQueryBuilder().update('food_orders').set({ couponCode: coupon.code }).where('id = :id', { id: saved.id }).execute();
      }
      return saved;
    });
  }

  async listCustomerOrders(customerId: string, limit: number, offset: number) {
    const [items, total] = await AppDataSource.getRepository(FoodOrder).findAndCount({
      where: { customerId }, order: { createdAt: 'DESC' }, take: limit, skip: offset,
    });
    return { items, total, limit, offset };
  }

  async listVendorOrders(vendorId: string, status: string | undefined, limit: number, offset: number) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    const where: { restaurantId: string; status?: string } = { restaurantId: restaurant.id };
    if (status) where.status = status;
    const [items, total] = await AppDataSource.getRepository(FoodOrder).findAndCount({
      where, order: { createdAt: 'DESC' }, take: limit, skip: offset,
    });
    return { items, total, limit, offset };
  }

  async listRestaurantReviews(restaurantId: string, limit: number, offset: number) {
    const [items, total] = await AppDataSource.getRepository(FoodReview).findAndCount({
      where: { restaurantId, isActive: true }, order: { createdAt: 'DESC' }, take: limit, skip: offset,
    });
    return { items, total, limit, offset };
  }

  async listOrderHistory(order: FoodOrder) {
    return AppDataSource.getRepository(FoodOrderStatusHistory).find({
      where: { orderId: order.id }, order: { createdAt: 'ASC' },
    });
  }

  async getCustomerOrder(customerId: string, orderId: string) {
    return AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId, customerId } });
  }

  async getVendorOrder(vendorId: string, orderId: string) {
    const restaurant = await this.requireVendorRestaurant(vendorId);
    return AppDataSource.getRepository(FoodOrder).findOne({ where: { id: orderId, restaurantId: restaurant.id } });
  }

  async cancelCustomerOrder(customerId: string, orderId: string, reason: string) {
    const order = await this.getCustomerOrder(customerId, orderId);
    if (!order) throw new Error('Food order not found');
    if (!['placed', 'accepted'].includes(order.status)) throw new Error('This order can no longer be cancelled');
    return this.changeOrderStatus(order, 'cancelled', customerId, reason || 'Cancelled by customer');
  }

  async changeVendorOrderStatus(vendorId: string, orderId: string, nextStatus: string, note?: string) {
    const order = await this.getVendorOrder(vendorId, orderId);
    if (!order) throw new Error('Food order not found');
    const transitions: Record<string, string[]> = {
      placed: ['accepted', 'rejected', 'cancelled'],
      accepted: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: [],
      picked_up: [],
      out_for_delivery: [],
    };
    if (!(transitions[order.status] || []).includes(nextStatus)) throw new Error(`Cannot change ${order.status} order to ${nextStatus}`);
    return this.changeOrderStatus(order, nextStatus, vendorId, note);
  }

  async listChat(order: FoodOrder) {
    return AppDataSource.getRepository(FoodOrderChat).find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } });
  }

  async sendChat(order: FoodOrder, senderId: string, senderRole: 'customer' | 'vendor', message: string) {
    const clean = message.trim();
    if (!clean || clean.length > 2000) throw new Error('Message must contain 1 to 2000 characters');
    return AppDataSource.getRepository(FoodOrderChat).save({
      id: randomUUID(), orderId: order.id, senderId, senderRole, message: clean, readAt: null,
    });
  }

  async createReview(customerId: string, orderId: string, input: JsonRecord) {
    const order = await this.getCustomerOrder(customerId, orderId);
    if (!order) throw new Error('Food order not found');
    if (order.status !== 'delivered') throw new Error('Only delivered orders can be reviewed');
    const foodRating = Math.trunc(finiteNumber(input.foodRating));
    const deliveryRating = input.deliveryRating == null ? null : Math.trunc(finiteNumber(input.deliveryRating));
    if (foodRating < 1 || foodRating > 5 || (deliveryRating != null && (deliveryRating < 1 || deliveryRating > 5))) {
      throw new Error('Ratings must be between 1 and 5');
    }
    const repo = AppDataSource.getRepository(FoodReview);
    if (await repo.findOne({ where: { orderId } })) throw new Error('This order has already been reviewed');
    const review = await repo.save({
      id: randomUUID(), orderId, customerId, restaurantId: order.restaurantId, foodRating, deliveryRating,
      comment: input.comment ? String(input.comment).trim().slice(0, 2000) : null,
      imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls.map(String).slice(0, 5) : null,
      isActive: true,
    });
    const summary = await repo.createQueryBuilder('review')
      .select('AVG(review.food_rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.restaurant_id = :restaurantId', { restaurantId: order.restaurantId })
      .andWhere('review.is_active = :active', { active: true })
      .getRawOne<{ average: string; count: string }>();
    await AppDataSource.getRepository(FoodRestaurant).update(order.restaurantId, {
      rating: moneyString(finiteNumber(summary?.average)), reviewsCount: finiteNumber(summary?.count),
    });
    return review;
  }

  private async requireVendorRestaurant(vendorId: string): Promise<FoodRestaurant> {
    const row = await this.getVendorRestaurant(vendorId);
    if (!row) throw new Error('Create your restaurant profile first');
    return row;
  }

  private async changeOrderStatus(order: FoodOrder, status: string, changedBy: string, note?: string) {
    return AppDataSource.transaction(async (manager) => {
      order.status = status;
      if (status === 'accepted') order.acceptedAt = new Date();
      if (status === 'ready') order.readyAt = new Date();
      if (status === 'picked_up' || status === 'out_for_delivery') order.pickedUpAt = new Date();
      if (status === 'delivered') order.deliveredAt = new Date();
      if (status === 'cancelled' || status === 'rejected') {
        order.cancelledAt = new Date();
        order.cancellationReason = note || status;
      }
      const saved = await manager.getRepository(FoodOrder).save(order);
      await manager.getRepository(FoodOrderStatusHistory).save({ id: randomUUID(), orderId: order.id, status, changedBy, note: note || null });
      return saved;
    });
  }
}
