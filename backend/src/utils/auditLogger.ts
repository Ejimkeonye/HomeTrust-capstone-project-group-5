import { randomUUID } from 'crypto';

export type AuditOutcome = 'success' | 'failure';

export interface AuditEvent {
  eventType: string;
  outcome: AuditOutcome;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  reason?: string;
  details?: Record<string, string | number | boolean>;
}

/**
 * Emit one JSON audit record to stdout. Lambda/container runtimes can forward
 * stdout to CloudWatch Logs. Never pass passwords, JWTs, invite tokens,
 * presigned URLs, or file contents to this function.
 */
export function writeAuditEvent(event: AuditEvent): void {
  console.info(JSON.stringify({
    recordType: 'application_audit',
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...event,
  }));
}
