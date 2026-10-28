import { db, schema } from "@/db";

export type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

/** Record a sensitive action. Keep `details` small and free of secrets. */
export function audit(input: AuditInput): void {
  db.insert(schema.auditLogs)
    .values({
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ? JSON.stringify(input.details) : null,
    })
    .run();
}
