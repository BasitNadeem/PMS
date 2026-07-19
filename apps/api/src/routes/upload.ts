import { Router } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { AppError } from "../utils/AppError";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new AppError(400, "Only JPEG, PNG, WebP, or GIF images are allowed") as unknown as Error);
  },
});

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

router.post(
  "/",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") return next(new AppError(400, "File too large — maximum is 8 MB"));
        return next(new AppError(400, err.message));
      }
      if (err) return next(err);
      next();
    });
  },
  (req, res) => {
    if (!req.file) throw new AppError(400, "No file uploaded");
    res.json({ data: { url: `/uploads/${req.file.filename}` } });
  },
);

export default router;
