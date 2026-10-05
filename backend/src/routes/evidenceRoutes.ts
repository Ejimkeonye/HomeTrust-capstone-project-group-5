import express from "express";
import multer from "multer";
import path from "path";
import { uploadEvidence } from "../controllers/evidenceController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/");
  },
  filename(req, file, cb) {
    cb(
      null,
      `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`,
    );
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|mp4|mov/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Images and Videos only!"));
    }
  },
});

router.post(
  "/:inspectionId/items/:itemId",
  protect,
  upload.single("evidence"),
  uploadEvidence,
);

export default router;
