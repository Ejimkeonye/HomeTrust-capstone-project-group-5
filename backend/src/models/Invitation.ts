import mongoose, { Schema, Document } from "mongoose";

export interface IInvitation extends Document {
  propertyId: mongoose.Types.ObjectId;
  inspectionId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  token: string;
  email: string;
  expiresAt: Date;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema: Schema = new Schema(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    inspectionId: {
      type: Schema.Types.ObjectId,
      ref: "Inspection",
      required: true,
    },
    inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REVOKED"],
      default: "PENDING",
    },
  },
  { timestamps: true },
);

export default mongoose.model<IInvitation>("Invitation", invitationSchema);
