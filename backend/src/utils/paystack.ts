import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const EVIDENCE_ACCESS_FEE_NGN = Number(process.env.PAYSTACK_PAYMENT_AMOUNT_NGN) || 5000;
export const EVIDENCE_ACCESS_FEE_KOBO = EVIDENCE_ACCESS_FEE_NGN * 100;

export function getPaystackSecretKey(): string {
  return (process.env.PAYSTACK_SECRET_KEY || '').trim();
}

export function isPaystackConfigured(): boolean {
  const key = getPaystackSecretKey();
  return Boolean(key && !key.includes('placeholder') && key !== 'your_paystack_secret_key');
}

export interface PaystackInitParams {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  isMock?: boolean;
}

export interface PaystackVerifyResult {
  success: boolean;
  amountKobo: number;
  currency: string;
  reference: string;
  channel?: string;
  paidAt?: string;
  metadata?: Record<string, unknown>;
  gatewayResponse?: string;
}

/**
 * Initializes a transaction with Paystack API.
 * If PAYSTACK_SECRET_KEY is not yet configured, provides a development preview URL
 * so the team can develop and test pending Paystack starter business verification.
 */
export async function initializePaystackTransaction(params: PaystackInitParams): Promise<PaystackInitResult> {
  const secretKey = getPaystackSecretKey();

  if (!isPaystackConfigured()) {
    console.warn('[Paystack] PAYSTACK_SECRET_KEY is not configured. Running in development mode.');
    const fallbackBase = params.callbackUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    const separator = fallbackBase.includes('?') ? '&' : '?';
    return {
      authorizationUrl: `${fallbackBase}${separator}reference=${encodeURIComponent(params.reference)}&status=success&mock=true`,
      accessCode: `mock_code_${params.reference}`,
      reference: params.reference,
      isMock: true,
    };
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
      currency: 'NGN',
    }),
  });

  const body = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  };

  if (!response.ok || !body.status || !body.data?.authorization_url) {
    const errorMsg = body.message || `Paystack initialization failed (HTTP ${response.status})`;
    console.error('[Paystack] Initialize error:', errorMsg);
    throw new Error(errorMsg);
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference,
    isMock: false,
  };
}

/**
 * Verifies a transaction with Paystack API by reference.
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secretKey = getPaystackSecretKey();

  if (!isPaystackConfigured()) {
    console.warn('[Paystack] Verification running in development mode for reference:', reference);
    return {
      success: true,
      amountKobo: EVIDENCE_ACCESS_FEE_KOBO,
      currency: 'NGN',
      reference,
      channel: 'dev_mock',
      paidAt: new Date().toISOString(),
      gatewayResponse: 'Successful mock transaction in development',
    };
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });

  const body = (await response.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      status: string;
      amount: number;
      currency: string;
      reference: string;
      channel?: string;
      paid_at?: string;
      gateway_response?: string;
      metadata?: Record<string, unknown>;
    };
  };

  if (!response.ok || !body.status || !body.data) {
    const errorMsg = body.message || `Paystack verification request failed (HTTP ${response.status})`;
    console.error('[Paystack] Verify error:', errorMsg);
    throw new Error(errorMsg);
  }

  const transaction = body.data;
  const isSuccessful = transaction.status === 'success' && transaction.amount >= EVIDENCE_ACCESS_FEE_KOBO;

  return {
    success: isSuccessful,
    amountKobo: transaction.amount,
    currency: transaction.currency || 'NGN',
    reference: transaction.reference,
    channel: transaction.channel,
    paidAt: transaction.paid_at,
    metadata: transaction.metadata,
    gatewayResponse: transaction.gateway_response,
  };
}

/**
 * Validates the HMAC-SHA512 webhook signature sent in `x-paystack-signature`.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  const secretKey = getPaystackSecretKey();
  if (!secretKey) return false;

  const expectedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(signatureHeader, 'hex');
  const b = Buffer.from(expectedSignature, 'hex');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
