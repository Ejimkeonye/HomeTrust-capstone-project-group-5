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

export interface IRoom { roomId: string; name: string }
export interface IProperty {
  propertyId: string;
  name: string;
  address: string;
  type: string;
  ownerId: string;
  rooms: IRoom[];
  createdAt: string;
  updatedAt: string;
}

export interface IEvidence {
  evidenceId: string;
  url: string;
  type: 'image' | 'video';
  uploadedBy: string;
  clientMetadata?: Record<string, unknown>;
  createdAt: string;
}
export interface IItemCondition {
  itemId: string;
  roomId: string;
  itemName: string;
  condition: 'Good' | 'Fair' | 'Damaged' | 'N/A';
  notes?: string;
  evidence: IEvidence[];
  disputed?: boolean;
}
export interface IInspection {
  inspectionId: string;
  propertyId: string;
  landlordId: string;
  tenantId?: string;
  mode: 'Full' | 'Damaged Sections Only';
  state: 'DRAFT' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'READ_ONLY';
  items: IItemCondition[];
  createdAt: string;
  updatedAt: string;
}

export interface IInvitation {
  token: string;
  propertyId: string;
  inspectionId: string;
  inviterId: string;
  email: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  createdAt: string;
  updatedAt: string;
}
