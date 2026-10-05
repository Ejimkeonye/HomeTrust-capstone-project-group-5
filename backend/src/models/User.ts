import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name?: string;
  email: string;
  password?: string; // Optional because of magic link for tenant
  role: "Landlord" | "Realtor" | "Tenant" | "Property Manager";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema: Schema = new Schema(
  {
    name: { type: String, required: false },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    role: {
      type: String,
      enum: ["Landlord", "Realtor", "Tenant", "Property Manager"],
      required: true,
      default: "Tenant",
    },
  },
  { timestamps: true },
);

export default mongoose.model<IUser>("User", userSchema);
