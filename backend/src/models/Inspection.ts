import mongoose, { Schema, Document } from "mongoose";

export interface IEvidence {
  url: string;
  type: string; // image, video
  uploadedBy: mongoose.Types.ObjectId;
  clientMetadata?: any;
  createdAt: Date;
}

export interface IItemCondition {
  roomId: mongoose.Types.ObjectId; // Reference to the room in Property
  itemName: string;
  condition: "Good" | "Fair" | "Damaged" | "N/A";
  notes?: string;
  evidence: IEvidence[];
  disputed?: boolean; // For Sprint 2
}

export interface IInspection extends Document {
  propertyId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  mode: "Full" | "Damaged Sections Only";
  state: "DRAFT" | "IN_PROGRESS" | "UNDER_REVIEW" | "READ_ONLY";
  items: IItemCondition[];
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<IEvidence>(
  {
    url: { type: String, required: true },
    type: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clientMetadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const itemConditionSchema = new Schema<IItemCondition>({
  roomId: { type: Schema.Types.ObjectId, required: true },
  itemName: { type: String, required: true },
  condition: {
    type: String,
    enum: ["Good", "Fair", "Damaged", "N/A"],
    required: true,
  },
  notes: { type: String },
  evidence: [evidenceSchema],
  disputed: { type: Boolean, default: false },
});

const inspectionSchema: Schema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    landlordId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "User" },
    mode: {
      type: String,
      enum: ["Full", "Damaged Sections Only"],
      required: true,
    },
    state: {
      type: String,
      enum: ["DRAFT", "IN_PROGRESS", "UNDER_REVIEW", "READ_ONLY"],
      default: "DRAFT",
    },
    items: [itemConditionSchema],
  },
  { timestamps: true },
);

export default mongoose.model<IInspection>("Inspection", inspectionSchema);
