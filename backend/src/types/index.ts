export type UserRole = 'Landlord' | 'Realtor' | 'Tenant' | 'Property Manager';
export interface IUser {
  userId: string;
  name?: string;
  email: string;
  phoneNumber?: string;
  houseAddress?: string;
  flatRoomNumber?: string;
  passwordHash?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface IRoom { roomId: string; name: string; category?: string }
export interface IProperty {
  propertyId: string;
  name: string;
  address: string;
  type: string;
  /** Unit or flat number within the property. */
  flatNo?: string;
  /** Property image URL or S3 object key. */
  image?: string;
  ownerId: string;
  rooms: IRoom[];
  createdAt: string;
  updatedAt: string;
}

export interface IEvidence {
  inspectionId: string;
  evidenceId: string;
  roomItemId: string;
  objectKey: string;
  /** Short-lived signed S3 link in API responses; never save a public bucket URL. */
  url?: string;
  downloadUrl?: string;
  type: 'image' | 'video';
  uploadedBy: string;
  clientMetadata?: Record<string, unknown>;
  createdAt: string;
}
export type InspectionCondition = 'no_issue' | 'stains' | 'cracks' | 'broken';
export interface IItemCondition {
  inspectionId: string;
  roomItemId: string;
  itemId: string;
  roomId: string;
  itemName: string;
  condition: InspectionCondition;
  notes?: string;
  evidence: IEvidence[];
  disputed?: boolean;
  reviewStatus?: 'ACCEPTED' | 'DISPUTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}
export interface IInspectionSignature {
  userId: string;
  role: 'Landlord' | 'Tenant';
  name: string;
  signedAt: string;
  uploadedAt?: string;
  objectKey: string;
  contentType: 'image/png' | 'image/jpeg';
  url?: string;
}
export interface IInspection {
  inspectionId: string;
  propertyId: string;
  landlordId?: string;
  landlordRole?: UserRole;
  landlordSignature?: IInspectionSignature;
  tenantSignature?: IInspectionSignature;
  createdBy?: string;
  tenantId?: string;
  tenantRole?: UserRole;
  participantIds?: string[];
  approvedBy?: string[];
  approvals?: Array<{ userId: string; approvedAt: string }>;
  approvalCount?: number;
  mode: 'Full' | 'Damaged Sections Only';
  state: 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'READ_ONLY';
  items: IItemCondition[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export interface IInvitation {
  token: string;
  propertyId: string;
  inspectionId: string;
  inviterId: string;
  inviterRole?: UserRole;
  inviteeRole?: UserRole;
  acceptedBy?: string;
  acceptedAt?: string;
  email: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
}
