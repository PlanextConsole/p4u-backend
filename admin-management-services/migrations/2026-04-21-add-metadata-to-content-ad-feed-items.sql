-- Adds the metadata JSON column used by AdvertisementFeedItem to persist extras
-- (caption, buttonTitle, postType, bannerUrl) when the admin creates/updates ads.
--
-- Required for production MySQL where TypeORM `synchronize` is disabled.
-- In dev, synchronize auto-applies the entity change; this migration is only
-- needed on environments where synchronize=false.

ALTER TABLE content_ad_feed_items
  ADD COLUMN IF NOT EXISTS metadata JSON NULL;
