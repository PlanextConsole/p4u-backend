import { DataSource } from 'typeorm';
import { HierarchyNode } from '../modules/admin-core/entities/HierarchyNode';
import { AppScreenLayout } from '../modules/admin-core/entities/AppScreenLayout';
import { AdminAuditLog } from '../modules/admin-core/entities/AdminAuditLog';
import { Vendor } from '../modules/vendors/entities/Vendor';
import { VendorRequest } from '../modules/vendors/entities/VendorRequest';
import { VendorEnquiry } from '../modules/vendors/entities/VendorEnquiry';
import { Customer } from '../modules/customers/entities/Customer';
import { CustomerReferral } from '../modules/customers/entities/CustomerReferral';
import { Coupon } from '../modules/customers/entities/Coupon';
import { Occupation } from '../modules/customers/entities/Occupation';
import { ProductCategory } from '../modules/catalog/entities/ProductCategory';
import { ProductSubcategory } from '../modules/catalog/entities/ProductSubcategory';
import { ServiceCategory } from '../modules/catalog/entities/ServiceCategory';
import { ServiceSubcategory } from '../modules/catalog/entities/ServiceSubcategory';
import { CatalogServiceItem } from '../modules/catalog/entities/CatalogServiceItem';
import { VendorService } from '../modules/catalog/entities/VendorService';
import { Product } from '../modules/products/entities/Product';
import { ProductVariation } from '../modules/products/entities/ProductVariation';
import { ProductRequest } from '../modules/products/entities/ProductRequest';
import { CommerceReview } from '../modules/products/entities/CommerceReview';
import { ProductAttributeDefinition } from '../modules/product-attributes/entities/ProductAttributeDefinition';
import { TaxConfiguration } from '../modules/products/entities/TaxConfiguration';
import { Order } from '../modules/orders/entities/Order';
import { Settlement } from '../modules/orders/entities/Settlement';
import { OrganizationOrder } from '../modules/organization-orders/entities/OrganizationOrder';
import { PlatformVariable } from '../modules/platform-config/entities/PlatformVariable';
import { WebsiteQuery } from '../modules/platform-config/entities/WebsiteQuery';
import { Banner } from '../modules/banners/entities/Banner';
import { PopupBanner } from '../modules/banners/entities/PopupBanner';
import { Post } from '../modules/posts/entities/Post';
import { AdvertisementFeedItem } from '../modules/posts/entities/AdvertisementFeedItem';
import { ObjectionableFeedLog } from '../modules/posts/entities/ObjectionableFeedLog';
import { SocialPostComment } from '../modules/posts/entities/SocialPostComment';
import { UserNotification } from '../modules/notifications/entities/UserNotification';
import { VendorReview } from '../modules/vendor-reviews/entities/VendorReview';
import { AvailableCity } from '../modules/classified/entities/AvailableCity';
import { AvailableArea } from '../modules/classified/entities/AvailableArea';
import { ClassifiedCategory } from '../modules/classified/entities/ClassifiedCategory';
import { ClassifiedService } from '../modules/classified/entities/ClassifiedService';
import { ClassifiedVendor } from '../modules/classified/entities/ClassifiedVendor';
import { ClassifiedProduct } from '../modules/classified/entities/ClassifiedProduct';
import { PosVendor } from '../modules/pos/entities/PosVendor';
import { PosProduct } from '../modules/pos/entities/PosProduct';
import { PosCategory } from '../modules/pos/entities/PosCategory';
import { VendorPlan } from '../modules/vendor-plans/entities/VendorPlan';
import { AdminPushNotificationSend } from '../modules/push-notifications/entities/AdminPushNotificationSend';
import { MediaLibraryFolder } from '../modules/media-library/entities/MediaLibraryFolder';
import { MediaLibraryAsset } from '../modules/media-library/entities/MediaLibraryAsset';
import { AdminBulkUploadJob } from '../modules/file-uploads/entities/AdminBulkUploadJob';
import { AdminSocialPost } from '../modules/social/entities/AdminSocialPost';
import { AdminSocialStory } from '../modules/social/entities/AdminSocialStory';
import { AdminSocialUserFollow } from '../modules/social/entities/AdminSocialUserFollow';
import { AdminSocialMedia } from '../modules/social/entities/AdminSocialMedia';
import { HomesAmenity } from '../modules/homes/entities/HomesAmenity';
import { HomesFilterOption } from '../modules/homes/entities/HomesFilterOption';
import { HomesLocality } from '../modules/homes/entities/HomesLocality';
import { HomesPlan } from '../modules/homes/entities/HomesPlan';
import { HomesPropertyListing } from '../modules/homes/entities/HomesPropertyListing';
import { HomesCmsContent } from '../modules/homes/entities/HomesCmsContent';
import { FoodRestaurant } from '../modules/food/entities/FoodRestaurant';
import { FoodRider } from '../modules/food/entities/FoodRider';
import { FoodOrder } from '../modules/food/entities/FoodOrder';
import { FoodCoupon } from '../modules/food/entities/FoodCoupon';
import { FoodRiderSettlement } from '../modules/food/entities/FoodRiderSettlement';

export function isPostgresDbType(value = process.env.DB_TYPE || 'mysql'): boolean {
  const dbType = value.toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
}

const dbType = isPostgresDbType() ? 'postgres' : 'mysql';

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || (dbType === 'postgres' ? '5432' : '3306'), 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root@123',
  database: process.env.DB_NAME || 'p4u_admin_db',
  entities: [
    HierarchyNode,
    AppScreenLayout,
    AdminAuditLog,
    Vendor,
    VendorRequest,
    VendorEnquiry,
    Customer,
    CustomerReferral,
    Coupon,
    Occupation,
    ProductCategory,
    ProductSubcategory,
    ServiceCategory,
    ServiceSubcategory,
    CatalogServiceItem,
    VendorService,
    Product,
    ProductVariation,
    ProductRequest,
    CommerceReview,
    ProductAttributeDefinition,
    TaxConfiguration,
    Order,
    Settlement,
    OrganizationOrder,
    PlatformVariable,
    WebsiteQuery,
    Banner,
    PopupBanner,
    Post,
    AdvertisementFeedItem,
    ObjectionableFeedLog,
    SocialPostComment,
    UserNotification,
    VendorReview,
    AvailableCity,
    AvailableArea,
    ClassifiedCategory,
    ClassifiedService,
    ClassifiedVendor,
    ClassifiedProduct,
    PosVendor,
    PosProduct,
    PosCategory,
    VendorPlan,
    AdminPushNotificationSend,
    MediaLibraryFolder,
    MediaLibraryAsset,
    AdminBulkUploadJob,
    AdminSocialPost,
    AdminSocialStory,
    AdminSocialUserFollow,
    AdminSocialMedia,
    HomesAmenity,
    HomesFilterOption,
    HomesLocality,
    HomesPlan,
    HomesPropertyListing,
    HomesCmsContent,
    FoodRestaurant,
    FoodRider,
    FoodOrder,
    FoodCoupon,
    FoodRiderSettlement,
  ],
  // Prevent accidental DDL races across services; enable only when explicitly requested.
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.NODE_ENV === 'development',
});
