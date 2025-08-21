import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { FlightOffer, FlightSearchResult, SearchFlightParams, AmadeusFlightSearchResponse } from "./types.js";

dotenv.config();

const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID || "";
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET || "";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8700;

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

  const json = await res.json() as { access_token: string; expires_in: number };
  accessToken = json.access_token;
  tokenExpiresAt = now + (json.expires_in - 60) * 1000;
  return accessToken;
}

async function searchFlightsAmadeus(params: SearchFlightParams): Promise<FlightSearchResult> {
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

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Amadeus Flight API 에러: ${res.status} ${errBody}`);
  }

  const json = await res.json() as AmadeusFlightSearchResponse;
  const items: FlightOffer[] = json.data ?? [];
  return { currency: params.currency ?? "USD", items };
}

const app = express();

app.use(express.json());
app.use(cors({ origin: true }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    service: "flight-server-amadeus",
    timestamp: new Date().toISOString(),
    clientIdConfigured: !!AMADEUS_CLIENT_ID,
  }),
);

app.post("/api/search-flights", async (req: Request, res: Response) => {
  try {
    const params: SearchFlightParams = req.body;
    if (!params.origin || !params.destination || !params.departDate) {
      return res.status(400).json({ error: "필수 파라미터 누락" });
    }
    const result = await searchFlightsAmadeus(params);
    res.json(result);
  } catch (error) {
    console.error("❌ 항공편 검색 실패:", error);
    res.status(500).json({ error: "항공편 검색 실패", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

// 위치 검색 별도 구현 권장
app.get("/api/locations", (_req, res) => {
  res.json({ locations: [] });
});

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Amadeus Flight Server 시작됨 - http://localhost:${PORT}`);
  console.log("=".repeat(50));
});
