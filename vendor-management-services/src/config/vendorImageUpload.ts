import multer from "multer";
import path from "path";
import fs from "fs";

/** Writable upload root (created on startup in server.ts). Override on VPS via UPLOAD_DIR. */
export function vendorUploadRoot(): string {
  const env = (process.env.UPLOAD_DIR || process.env.VENDOR_UPLOAD_DIR)?.trim();
  if (env) return path.resolve(env);
  return path.resolve(process.cwd(), 'uploads');
}

export function ensureVendorUploadDir(): void {
  const dir = vendorUploadRoot();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|jfif)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, vendorUploadRoot()),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "") || ".jpg";
    cb(null, `${unique}${ext}`);
  },
});

/** Vendor-only image upload (product thumbnails, service icons). */
export const vendorImageUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mimeOk = mime.startsWith("image/");
    const extOk =
      IMAGE_EXT.test(file.originalname || "") ||
      [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"].includes(ext);
    if (mimeOk || extOk) cb(null, true);
    else cb(new Error("Only image files are allowed (JPEG, PNG, WebP, GIF, SVG, etc.)."));
  },
});
