import mongoose, { Schema, Document } from "mongoose";

export interface IRoom {
  name: string; // e.g., Living Room, Kitchen
}

export interface IProperty extends Document {
  name: string;
  address: string;
  type: string; // e.g., Apartment, House
  ownerId: mongoose.Types.ObjectId;
  rooms: IRoom[];
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>({
  name: { type: String, required: true },
});

const propertySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    type: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rooms: [roomSchema],
  },
  { timestamps: true },
);

export default mongoose.model<IProperty>("Property", propertySchema);
