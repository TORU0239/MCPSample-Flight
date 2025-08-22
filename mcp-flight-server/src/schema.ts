// src/mcp/schema.ts

import { z } from "zod";

export const FlightOfferSchema = z.object({
  id: z.string(),
  price: z.object({
    total: z.string(),
    currency: z.string(),
  }),
  itineraries: z.array(z.any()),
});

export const FlightSearchResultSchema = z.object({
  currency: z.string(),
  items: z.array(FlightOfferSchema),
});

export const SearchFlightParamsSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  departDate: z.string(),
  returnDate: z.string().optional(),
  adults: z.number().int().optional(),
  currency: z.string().optional(),
});

export const MCPRequestSchema = z.object({
  messageId: z.string(),
  sessionId: z.string(),
  service: z.string(),
  action: z.enum(["invoke", "update"]),
  payload: z.record(z.any()),
});

export const MCPResponseSchema = z.object({
  messageId: z.string(),
  sessionId: z.string(),
  service: z.string(),
  action: z.enum(["result", "update"]),
  result: z.record(z.any()),
  metadata: z.record(z.any()).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type MCPRequest = z.infer<typeof MCPRequestSchema>;
export type MCPResponse = z.infer<typeof MCPResponseSchema>;
