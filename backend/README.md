# HomeTrust Backend API

Express and TypeScript API for the HomeTrust move-in/move-out inspection app. DynamoDB stores users, properties, inspections, room items, evidence metadata, and invitations. Evidence files are uploaded directly to a private S3 bucket using a presigned-upload Lambda.

## Local setup

From this `backend` directory:

```powershell
npm install
npm run dev
```

The API listens on port 5000 by default. `npm run build` compiles TypeScript; `npm start` runs `dist/index.js`.

Create a local `.env` file (never commit real secrets):

```dotenv
PORT=5000
AWS_REGION=us-east-1
JWT_SECRET=use-a-strong-random-secret-locally
FRONTEND_URL=http://localhost:3000
PRESIGNED_UPLOAD_URL=https://your-api-gateway-url/presigned-upload
EVIDENCE_BUCKET_NAME=hometrust-evidence-dev
DYNAMODB_USERS_TABLE=hometrust-dev-parties
DYNAMODB_PROPERTIES_TABLE=hometrust-dev-properties
DYNAMODB_INSPECTIONS_TABLE=hometrust-dev-inspections
DYNAMODB_ROOM_ITEMS_TABLE=hometrust-dev-roomItems
DYNAMODB_EVIDENCE_TABLE=hometrust-dev-evidence
DYNAMODB_INVITATIONS_TABLE=hometrust-dev-invitations
```

Use the actual deployed table names and presigned-upload URL for your environment. AWS credentials come from the local AWS profile/environment or the deployed runtime's IAM role. `DYNAMODB_ENDPOINT` is optional for DynamoDB Local. Table auto-creation is skipped in production or when `DYNAMODB_AUTO_CREATE_TABLES=false`; production tables are managed by infrastructure.

## API basics

- API prefix: `/api`; JSON requests use `Content-Type: application/json`.
- Protected endpoints require `Authorization: Bearer <token>`.
- Register and login return a JWT, valid for 30 days, and user profile data.
- User roles: `Landlord`, `Realtor`, `Tenant`, `Property Manager`.
- Errors return JSON with a `message` field and an appropriate HTTP status.

## Endpoints

### Health and authentication

| Method | Path | Auth | Request |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Health check. |
| POST | `/api/auth/register` | No | `{ "name": "Ada Example", "email": "ada@example.com", "password": "...", "role": "Tenant", "phoneNumber": "+234...", "houseAddress": "...", "flatRoomNumber": "2B" }` |
| POST | `/api/auth/login` | No | `{ "email": "ada@example.com", "password": "..." }` |

Registration defaults role to `Landlord`; frontend should send the intended role. Success returns `{ userId, name, email, phoneNumber, houseAddress, flatRoomNumber, role, token }`. Passwords are stored as bcrypt hashes. The backend requires `JWT_SECRET` at runtime.

### Properties

| Method | Path | Auth | Purpose / request |
| --- | --- | --- | --- |
| POST | `/api/properties` | Yes; all roles including Tenant | Create property: `{ "name": "Sunshine Estate", "address": "Ikeja, Lagos", "type": "Apartment", "rooms": [{ "name": "Kitchen" }, { "name": "Bedroom" }] }`. |
| GET | `/api/properties` | Yes | List properties owned by the signed-in user; returns `{ properties, total }`. |
| GET | `/api/properties/:id` | Yes | Get property details by ID. |
| PUT | `/api/properties/:id` | Yes; all roles including Tenant | Update any subset of `name`, `address`, `type`, and `rooms`. `rooms` accepts names or objects with `name` and optional `roomId`/`id`/`category`; the backend preserves known room IDs by ID or matching name. Only the owner may update. |
| DELETE | `/api/properties/:id` | Yes; owner only | Delete the property. Returns `{ "message": "Property deleted", "propertyId": "..." }`. Existing inspection/evidence records are not deleted by this operation. |

Property records include generated `propertyId`, `ownerId`, timestamps, and `rooms` with generated `roomId` values.

### Invitations

| Method | Path | Auth | Purpose / request |
| --- | --- | --- | --- |
| POST | `/api/invitations` | Yes; Landlord/Realtor/Property Manager/Tenant | Create invite: `{ "propertyId": "...", "inspectionId": "...", "email": "other-party@example.com" }`. Returns the invitation and `inviteLink`; link expires in 7 days. |
| POST | `/api/invitations/resolve/:token` | No | Accept invite: `{ "name": "Invitee Name", "password": "at-least-8-characters" }` for a new account. If a matching account exists, its role must match the invitation. Returns user details, JWT, propertyId, and inspectionId. |

Invitations work in both directions: a Tenant inviting someone creates a Landlord invitation; a Landlord, Realtor, or Property Manager inviting someone creates a Tenant invitation. The invited person is linked to the inspection when the token is accepted. The backend creates the invitation and link; email delivery is not wired in, so the frontend/product must deliver or share the link.

### Inspections

| Method | Path | Auth | Purpose / request |
| --- | --- | --- | --- |
| POST | `/api/inspections` | Yes; Landlord/Realtor/Property Manager/Tenant | Create: `{ "propertyId": "...", "mode": "Full", "participantIds": ["user-id"] }`. Modes: `Full`, `Damaged Sections Only`; mode defaults to `Full`. |
| GET | `/api/inspections/property/:propertyId` | Yes | List inspections the caller may access for a property. |
| GET | `/api/inspections/:id` | Yes | Get inspection, room items, evidence metadata, approval summary. |
| PUT | `/api/inspections/:id/state` | Yes | Set `{ "state": "IN_PROGRESS" }`; states: `DRAFT`, `IN_PROGRESS`, `UNDER_REVIEW`, `READ_ONLY`. |
| POST | `/api/inspections/:id/items` | Yes | Add `{ "roomId": "...", "itemName": "Window", "condition": "Cracks", "notes": "Optional" }`. Valid conditions: `No issue`, `Stains`, `Cracks`, `Broken`. |
| PATCH | `/api/inspections/:id/items/:itemId` | Yes | Update an item's `condition` and/or `notes`. |
| POST | `/api/inspections/:id/submit` | Yes; owner | Submit a non-empty inspection for review; state becomes `UNDER_REVIEW`. |
| POST | `/api/inspections/:id/items/:itemId/review` | Yes; inspection participant | Record item decision: `{ "decision": "ACCEPTED", "note": "Optional" }`. Decision is `ACCEPTED` or `DISPUTED`. |
| POST | `/api/inspections/:id/rooms/:roomId/evidence-decision` | Yes; inspection participant | Apply `{ "decision": "ACCEPTED", "note": "Optional" }` to evidence-bearing items in that room. |
| POST | `/api/inspections/:id/approvals` or `/api/inspections/:id/acknowledge` | Yes; inspection participant | Record a separate acknowledgement for an `UNDER_REVIEW` inspection; no request body. Each user can acknowledge once. This does not save a signature or finalize the inspection. |
| POST | `/api/inspections/:id/signatures` | Yes; linked landlord or tenant | Save only the caller’s signature. Body: `{ "signature": "data:image/png;base64,..." }` (PNG or JPEG data URL, max 1 MB decoded). Only available in `UNDER_REVIEW`; role comes from the inspection’s linked `landlordId`/`tenantId`. Returns both saved signature records, temporary `url` values, `signingStatus`, and inspection `state`. Each party can sign once. |
| GET | `/api/inspections/:id/report.pdf` | Yes; inspection participant | Download the inspection PDF summary, including saved landlord and tenant signature images, names, and signing times when available. |

Inspection access is limited to the landlord, tenant, creator, and IDs in `participantIds`. Tenants can create inspections for properties they own; their ID is initially saved as `tenantId`, and the invited landlord is linked as `landlordId` when the invite is accepted. The inspection creator submits it. Both landlord and tenant must be linked before acknowledgement or signing. Acknowledgements are recorded separately and do not finalize the inspection. Signatures can be saved only in `UNDER_REVIEW`; the backend changes the inspection to `READ_ONLY` only after both linked parties have successfully saved their own signatures. The inspection response contains each evidence entry's `downloadUrl` API path, not a public S3 URL.

### Evidence upload and display

The upload is a two-step direct-to-S3 flow. Both endpoints below require a Bearer token and verify inspection/item access.

1. Request a presigned upload URL:

   `POST /api/evidence/presigned-url`

   JSON body:

   ```json
   {
     "file_name": "kitchen-window.jpg",
     "content_type": "image/jpeg",
     "inspection_id": "inspection-id",
     "item_id": "room-item-id"
   }
   ```

   Backend proxies the request to `PRESIGNED_UPLOAD_URL`. Response includes `upload_url`, `object_key`, and `expires_in`.

2. Upload the file bytes directly to `upload_url` with HTTP `PUT`, using the returned URL and the matching content type. Do not send the file to the Express API.

3. Confirm the successful S3 upload and save evidence metadata:

   `POST /api/evidence/:inspectionId/items/:itemId/confirm`

   ```json
   { "object_key": "evidence/...", "content_type": "image/jpeg" }
   ```

   Response returns the created evidence metadata.

4. To display an existing private object, request a short-lived URL:

   `GET /api/evidence/:inspectionId/:evidenceId/download-url`

   Returns `{ "url": "<temporary signed S3 URL>", "expiresIn": 900 }`. Use the signed URL as the image/video source; refresh it after it expires.

Supported uploads are images/videos accepted by the presigned-upload Lambda. The upload endpoint validates the expected key/content type; coordinate allowed content types and size with the cloud configuration.

## Frontend flow suggestion

1. Register or sign in; store the returned JWT using the frontend's secure session approach.
2. Send `Authorization: Bearer <token>` on protected API calls.
3. Fetch/create a property. Use its `roomId` when creating inspection items.
4. Create an inspection, add items, request signed upload URL for each file, PUT bytes to S3, then confirm the upload.
5. Fetch the inspection; for each evidence record call `downloadUrl` to get a temporary S3 URL for rendering.
6. Submit for review, record item/room decisions, collect acknowledgements, and provide the report PDF download.

## Paystack Payment Integration (Move-In Evidence Access)

Users are prompted to pay **₦5,000** at the point of downloading move-in evidence / inspection report.

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/payments/initialize` | Yes; participant | Initialize Paystack checkout. Body: `{ "inspectionId": "...", "callbackUrl": "..." }`. Returns `{ authorizationUrl, reference, accessCode, amount: 5000, currency: "NGN" }`. |
| GET | `/api/payments/verify/:reference` | Yes; participant | Verifies Paystack transaction with Paystack API. On success, unlocks evidence access for the inspection. |
| GET | `/api/payments/status/:inspectionId` | Yes; participant | Checks if evidence access has already been paid and unlocked: `{ isPaid: boolean, amount: 5000, ... }`. |
| POST | `/api/payments/webhook` | Paystack HMAC | Handles `charge.success` webhook events sent by Paystack. |

### Download Gating
When accessing `GET /api/inspections/:id/report.pdf` or `GET /api/evidence/:inspectionId/:evidenceId/download-url` for a move-in inspection:
- If payment has not been made, returns `HTTP 402 Payment Required` with:
  ```json
  {
    "message": "Payment of ₦5,000 is required to download move-in evidence",
    "paymentRequired": true,
    "amount": 5000,
    "currency": "NGN",
    "inspectionId": "..."
  }
  ```
- Once payment is verified, the inspection's `isEvidencePaid` is set to `true`, and downloads are unlocked.
- During local testing before starter business verification is complete on Paystack, the backend provides an automated test fallback URL or can be toggled via `REQUIRE_EVIDENCE_PAYMENT=false`.

## DynamoDB table and index requirements


The application uses these keys/index names (string attributes):

| Environment variable | Primary key | Required GSI |
| --- | --- | --- |
| `DYNAMODB_USERS_TABLE` | `userId` | `emailIndex` partition key `email` |
| `DYNAMODB_PROPERTIES_TABLE` | `propertyId` | `ownerIndex` partition key `ownerId` |
| `DYNAMODB_INSPECTIONS_TABLE` | `inspectionId` | `byProperty` partition key `propertyId` |
| `DYNAMODB_ROOM_ITEMS_TABLE` | `inspectionId` + `roomItemId` | None |
| `DYNAMODB_EVIDENCE_TABLE` | `inspectionId` + `evidenceId` | None |
| `DYNAMODB_INVITATIONS_TABLE` | `token` | None |

The configured AWS role needs the required DynamoDB read/write access and `s3:GetObject` on the signature/evidence object prefix so the API can create temporary signed download URLs. The presigned-upload Lambda role needs `s3:PutObject` on that prefix. The Lambda API URL is configured in the backend as `PRESIGNED_UPLOAD_URL`. Signature objects are stored under `evidence/signatures/`; signature URLs expire after 15 minutes and are refreshed when an inspection is fetched.

## Current integration notes

- Authentication is custom Express/DynamoDB/bcrypt/JWT authentication; this backend does not integrate Cognito.
- The UI's accept/dispute state is stored at item level; the room endpoint applies the decision across room items with evidence.
- Audit events are emitted by backend audit logging; the deployment must configure its log destination/retention and permissions.
- Restrict CORS to the deployed frontend origin before production use.
