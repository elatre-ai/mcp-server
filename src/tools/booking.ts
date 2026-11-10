import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../config.js";
import { bookSlotSchema, listBookingSlotsSchema, toolFailure, toolJson } from "../utils/validation.js";

async function bookingRequest(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const baseUrl = loadConfig().bookingApiBaseUrl;
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({ error_message: "Booking API returned a non-JSON response" }));
  return { status: response.status, body };
}

export function registerBookingTools(server: McpServer): void {
  server.registerTool(
    "list_booking_slots",
    {
      title: "List booking slots",
      description:
        "List open booking slots. startTime and endTime are wall-clock times in timezone (for example 2026-12-10T00:00:00 through 2026-12-11T00:00:00). timezone is a Calendly label or IANA name such as India Standard Time or Asia/Calcutta. When omitted, UTC is used. Each slot includes startTime in UTC and startTimeLocal in 12-hour form. Pass the same timezone to book_slot.",
      inputSchema: listBookingSlotsSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      const parsed = listBookingSlotsSchema.safeParse(args ?? {});
      if (!parsed.success) return toolFailure("invalid_input", { issues: parsed.error.issues.map((issue) => issue.message) });
      const params = new URLSearchParams({ startTime: parsed.data.startTime, endTime: parsed.data.endTime });
      if (parsed.data.timezone) params.set("timezone", parsed.data.timezone);
      try {
        const result = await bookingRequest(`/bookings/slots?${params.toString()}`, { method: "GET" });
        if (result.status >= 400) return toolFailure("booking_api_error", { status: result.status, body: result.body });
        return toolJson(result.body);
      } catch (error) {
        return toolFailure("booking_api_unreachable", { message: error instanceof Error ? error.message : "unknown error" });
      }
    },
  );

  server.registerTool(
    "book_slot",
    {
      title: "Book a slot",
      description:
        "Book a Calendly slot. startTime is the UTC value from list_booking_slots (for example 2026-12-10T09:30:00.000Z). timezone must match the list call so the invite uses the user's timezone, such as Asia/Calcutta or India Standard Time. firstName, lastName, phoneNumber, conversationId, and source are optional. phoneNumber must include the country code, such as +14155550123. conversationId is the ElevenLabs conversation id.",
      inputSchema: bookSlotSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (args) => {
      const parsed = bookSlotSchema.safeParse(args ?? {});
      if (!parsed.success) return toolFailure("invalid_input", { issues: parsed.error.issues.map((issue) => issue.message) });
      try {
        const { conversationId, ...rest } = parsed.data;
        const body = conversationId ? { ...rest, conversationId } : rest;
        const result = await bookingRequest("/bookings/slots", { method: "POST", body: JSON.stringify(body) });
        if (result.status >= 400) return toolFailure("booking_api_error", { status: result.status, body: result.body });
        return toolJson(result.body);
      } catch (error) {
        return toolFailure("booking_api_unreachable", { message: error instanceof Error ? error.message : "unknown error" });
      }
    },
  );
}
