// src/mcp/index.ts

import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import type { SearchFlightParams, FlightSearchResult } from "./types.js";

dotenv.config();

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || "";
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || "";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
  console.error("❌ [ERROR] AMADEUS_CLIENT_ID 또는 AMADEUS_CLIENT_SECRET이 설정되지 않았습니다.");
  process.exit(1);
}

let accessToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessToken && now < tokenExpiresAt) {
    return accessToken;
  }

  const tokenUrl = "https://test.api.amadeus.com/v1/security/oauth2/token";
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", AMADEUS_CLIENT_ID);
  params.append("client_secret", AMADEUS_CLIENT_SECRET);

  const res = await fetch(tokenUrl, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Amadeus OAuth 에러: ${res.status} ${errBody}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  accessToken = json.access_token;
  tokenExpiresAt = now + (json.expires_in - 60) * 1000;
  return accessToken;
}

async function searchFlightsAmadeus(params: SearchFlightParams): Promise<FlightSearchResult> {
  console.log("🔍 Amadeus 항공편 검색 요청:", params, new Date().toISOString());

  const token = await getAccessToken();

  const url = new URL("https://test.api.amadeus.com/v2/shopping/flight-offers");
  url.searchParams.set("originLocationCode", params.origin);
  url.searchParams.set("destinationLocationCode", params.destination);
  url.searchParams.set("departureDate", params.departDate);
  if (params.returnDate) {
    url.searchParams.set("returnDate", params.returnDate);
  }
  url.searchParams.set("adults", String(params.adults ?? 1));
  url.searchParams.set("currencyCode", params.currency ?? "USD");
  url.searchParams.set("max", "20");

  console.log("🔍 Amadeus API parameters: ", url.searchParams);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.log("🔴 Amadeus API 호출 실패:", new Date().toISOString());
    throw new Error(`Amadeus Flight API 에러: ${res.status} ${errBody}`);
  }

  const json = (await res.json()) as { data?: any[] };
  const items = json.data ?? [];

  console.log("🔍 Amadeus 항공편 검색 결과:", items.length, "개 항공편");

  return { currency: params.currency ?? "USD", items };
}

const app = Fastify();

app.register(cors, { origin: true });

// MCP 서버 기본 경로 (이전 마이그레이션한 MCP 메시지 방식)
app.post("/mcp", async (request, reply) => {
  console.log("🔧 /mcp, MCP Flight Server 요청 수신:", request.body, new Date().toISOString());

  const mcpReq = request.body as any;

  console.log("🔧 MCP 요청 내용:", mcpReq); 

  if (mcpReq?.service === "flight_search" && mcpReq?.action === "invoke") {
    try {
      console.log("🔧 MCP Flight Search 요청 처리 중:", mcpReq.payload), new Date().toISOString();
      const flightResult = await searchFlightsAmadeus(mcpReq.payload);
      return reply.send({
        messageId: mcpReq.messageId,
        sessionId: mcpReq.sessionId,
        service: "flight_search",
        action: "result",
        result: flightResult,
        metadata: { source: "amadeus", queriedAt: new Date().toISOString() },
      });
    } catch (err) {
      return reply.status(500).send({
        messageId: mcpReq.messageId,
        sessionId: mcpReq.sessionId,
        service: "flight_search",
        action: "result",
        result: {},
        error: { code: "SEARCH_FAILED", message: err instanceof Error ? err.message : String(err) },
      });
    }
  } else {
    reply.status(400).send({ error: "Unsupported MCP service or action" });
  }
});

// 기존 Express 스타일 `/api/search-flights` 경로 복원
app.post("/api/search-flights", async (request, reply) => {
  console.log("🔧 /api/search-flights, 항공편 검색 요청 수신:", request.body, new Date().toISOString());
  
  const params = request.body as SearchFlightParams;

  if (!params.origin || !params.destination || !params.departDate) {
    return reply.status(400).send({ error: "필수 파라미터 누락" });
  }

  try {
    const result = await searchFlightsAmadeus(params);
    reply.send(result);
  } catch (err) {
    reply.status(500).send({ error: "항공편 검색 실패", message: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/health", (_request, reply) => {
  reply.send({
    status: "ok",
    service: "mcp-flight-server",
    timestamp: new Date().toISOString(),
    clientIdConfigured: !!AMADEUS_CLIENT_ID,
  });
});

app.listen({ port: PORT }).then(() => {
  console.log(`🚀 MCP Flight Server listening on http://localhost:${PORT}`);
});
