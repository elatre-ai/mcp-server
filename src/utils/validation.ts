import { z } from "zod/v4";

export const FRAMEWORKS = ["nist_ai_rmf", "iso_42001", "eu_ai_act", "hipaa", "soc2"] as const;
export type FrameworkId = (typeof FRAMEWORKS)[number];

export const CONTROL_STATUSES = ["implemented", "partial", "missing", "unknown"] as const;
export type ControlStatus = (typeof CONTROL_STATUSES)[number];

export const securityControlSchema = z
  .object({
    control_id: z.string().trim().min(1).max(64),
    status: z.enum(CONTROL_STATUSES),
    evidence: z.string().trim().max(500).optional(),
  })
  .strict();

export type SecurityControlInput = z.infer<typeof securityControlSchema>;

export const frameworkSchema = z.enum(FRAMEWORKS);

export const architectureAuditSchema = z
  .object({
    stack: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
    compliance_framework: frameworkSchema,
    employee_count: z.number().int().nonnegative().max(10_000_000),
    vector_database: z.string().trim().min(1).max(80),
    identity_provider: z.string().trim().min(1).max(80),
    llm_provider: z.string().trim().min(1).max(80),
    existing_security_controls: z.array(securityControlSchema).max(80),
  })
  .strict();

export const rbacAssessmentSchema = z
  .object({
    identity_provider: z.string().trim().min(1).max(80),
    vector_database: z.string().trim().min(1).max(80),
    tenant_model: z.enum(["single_tenant", "multi_tenant", "unknown"]),
    existing_security_controls: z.array(securityControlSchema).max(80),
  })
  .strict();

export const readinessSchema = z
  .object({
    existing_security_controls: z.array(securityControlSchema).max(80),
    compliance_framework: frameworkSchema.optional(),
  })
  .strict();

export const stackAnalysisSchema = z
  .object({
    platforms: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  })
  .strict();

export const checklistSchema = z
  .object({
    framework: frameworkSchema,
  })
  .strict();

export const listBookingSlotsSchema = z
  .object({
    startTime: z.string().trim().min(1).max(40),
    endTime: z.string().trim().min(1).max(40),
    timezone: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const bookSlotSchema = z
  .object({
    startTime: z.string().trim().min(1).max(40),
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(320),
    message: z.string().trim().min(1).max(4000),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phoneNumber: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Phone number must include a country code, such as +14155550123").optional(),
    conversationId: z.string().trim().min(1).max(200).nullish(),
    timezone: z.string().trim().min(1).max(80).optional(),
    source: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const companyInfoSchema = z
  .object({
    section: z.enum(["all", "profile", "contact", "services", "notices"]).optional(),
  })
  .strict();

export function toolJson(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function toolFailure(error: string, details?: Record<string, unknown>): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error, ...details }) }],
  };
}

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}
