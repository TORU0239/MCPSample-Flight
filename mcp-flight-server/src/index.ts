import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";

// 환경 변수 로드
dotenv.config();

// ===== 타입 정의 =====
interface FlightRoute {
  airline: string;
  flight_no: string;
  cityFrom: string;
  cityTo: string;
  local_departure: string;
  local_arrival: string;
}

interface FlightItem {
  id: string;
  cityFrom: string;
  cityTo: string;
  flyFrom: string;
  flyTo: string;
  price: number;
  duration: number;
  deep_link: string;
  route: FlightRoute[];
}

interface FlightSearchResult {
  currency: string;
  items: FlightItem[];
}

interface SearchFlightParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  round?: boolean;
  adults?: number;
  currency?: string;
  maxStopovers?: number;
}

// ===== 설정 =====
const KIWI_BASE = "https://tequila-api.kiwi.com";
const KIWI_KEY = process.env.KIWI_API_KEY || "";
const PORT = process.env.PORT ? Number(process.env.PORT) : 8700;

// 환경 변수 검증
if (!KIWI_KEY) {
  console.error("❌ [ERROR] KIWI_API_KEY가 설정되지 않았습니다.");
  console.error("👉 .env 파일에 KIWI_API_KEY=your_key_here 를 추가하세요.");
  process.exit(1);
}

// ===== 헬퍼 함수들 =====

/**
 * 날짜 형식 변환: YYYY-MM-DD → DD/MM/YYYY
 */
function toKiwiDate(dateString: string): string {
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Kiwi API 응답 정규화
 */
function normalizeKiwiFlights(kiwiResponse: any, currency: string): FlightSearchResult {
  const flights = kiwiResponse?.data ?? [];
  
  const items = flights.slice(0, 20).map((flight: any) => ({
    id: flight.id,
    cityFrom: flight.cityFrom,
    cityTo: flight.cityTo,
    flyFrom: flight.flyFrom,
    flyTo: flight.flyTo,
    price: flight.price,
    duration: flight.duration?.total || 0,
    deep_link: flight.deep_link,
    route: (flight.route || []).map((segment: any) => ({
      airline: segment.airline,
      flight_no: segment.flight_no,
      cityFrom: segment.cityFrom,
      cityTo: segment.cityTo,
      local_departure: segment.local_departure,
      local_arrival: segment.local_arrival
    }))
  }));
  
  return { currency, items };
}

/**
 * Kiwi API 호출 헬퍼
 */
async function callKiwiAPI(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: { apikey: KIWI_KEY }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kiwi API Error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("❌ Kiwi API 호출 실패:", error);
    throw error;
  }
}

// ===== Express 앱 설정 =====
const app = express();

// 미들웨어
app.use(express.json());
app.use(cors({ origin: true }));

// 요청 로깅 미들웨어
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== API 엔드포인트 =====

/**
 * 헬스 체크
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    service: "flight-server",
    timestamp: new Date().toISOString(),
    kiwiApiConfigured: !!KIWI_KEY
  });
});

/**
 * 위치 검색 (도시명 → IATA 코드)
 * GET /api/locations?term=Seoul&limit=5
 */
app.get("/api/locations", async (req: Request, res: Response) => {
  try {
    const { term = "Seoul", limit = "5" } = req.query as { term?: string; limit?: string };
    
    const url = `${KIWI_BASE}/locations/query?term=${encodeURIComponent(term)}&limit=${limit}`;
    console.log(`🔍 위치 검색: "${term}"`);
    
    const data = await callKiwiAPI(url);
    console.log(`✅ ${data.locations?.length || 0}개 위치 찾음`);
    
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: "위치 검색 실패",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * 항공편 검색
 * POST /api/search-flights
 */
app.post("/api/search-flights", async (req: Request, res: Response) => {
  try {
    const params: SearchFlightParams = req.body;
    
    // 입력 검증
    if (!params.origin || !params.destination || !params.departDate) {
      return res.status(400).json({ 
        error: "필수 파라미터 누락",
        required: ["origin", "destination", "departDate"]
      });
    }
    
    // Kiwi API URL 구성
    const url = new URL(`${KIWI_BASE}/v2/search`);
    const searchParams = url.searchParams;
    
    searchParams.set("fly_from", params.origin);
    searchParams.set("fly_to", params.destination);
    searchParams.set("date_from", toKiwiDate(params.departDate));
    searchParams.set("date_to", toKiwiDate(params.departDate));
    searchParams.set("adults", String(params.adults || 1));
    searchParams.set("curr", params.currency || "USD");
    searchParams.set("max_stopovers", String(params.maxStopovers ?? 1));
    searchParams.set("limit", "20");
    
    // 왕복/편도 설정
    if (params.round && params.returnDate) {
      searchParams.set("return_from", toKiwiDate(params.returnDate));
      searchParams.set("return_to", toKiwiDate(params.returnDate));
      searchParams.set("flight_type", "round");
      console.log(`🔄 왕복 검색: ${params.origin} ↔ ${params.destination}`);
    } else {
      searchParams.set("flight_type", "oneway");
      console.log(`➡️ 편도 검색: ${params.origin} → ${params.destination}`);
    }
    
    // API 호출
    const data = await callKiwiAPI(url.toString());
    console.log(`✅ ${data.data?.length || 0}개 항공편 찾음`);
    
    // 응답 정규화
    const normalized = normalizeKiwiFlights(data, params.currency || "USD");
    res.json(normalized);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: "항공편 검색 실패",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

/**
 * MCP 호환 엔드포인트 (레거시 지원)
 * POST /mcp
 */
app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;
    
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      if (name === "lookup_locations") {
        const url = `${KIWI_BASE}/locations/query?term=${encodeURIComponent(args.term)}&limit=${args.limit || 5}`;
        const data = await callKiwiAPI(url);
        return res.json({
          content: [{ type: "json", json: data }]
        });
      }
      
      if (name === "search_flights") {
        // MCP 레거시 지원 간소화 (직접 callKiwiAPI 호출)
        const url = new URL(`${KIWI_BASE}/v2/search`);
        const searchParams = url.searchParams;
        
        searchParams.set("fly_from", args.origin);
        searchParams.set("fly_to", args.destination);
        searchParams.set("date_from", toKiwiDate(args.departDate));
        searchParams.set("date_to", toKiwiDate(args.departDate));
        searchParams.set("adults", String(args.adults || 1));
        searchParams.set("curr", args.currency || "USD");
        searchParams.set("max_stopovers", String(args.maxStopovers ?? 1));
        searchParams.set("limit", "20");
        
        if (args.round && args.returnDate) {
          searchParams.set("return_from", toKiwiDate(args.returnDate));
          searchParams.set("return_to", toKiwiDate(args.returnDate));
          searchParams.set("flight_type", "round");
        } else {
          searchParams.set("flight_type", "oneway");
        }
        
        const data = await callKiwiAPI(url.toString());
        const normalized = normalizeKiwiFlights(data, args.currency || "USD");
        return res.json({
          content: [{ type: "json", json: normalized }]
        });
      }
    }
    
    res.status(400).json({ error: "Unknown method or tool" });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      error: "MCP 처리 실패",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// 404 핸들러
app.use((_req: Request, res: Response) => {
  res.status(404).json({ 
    error: "Not Found",
    message: `Cannot ${_req.method} ${_req.path}`
  });
});

// 에러 핸들러
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message
  });
});

// ===== 서버 시작 =====
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Flight Server 시작됨`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔑 Kiwi API Key: ${KIWI_KEY.slice(0, 4)}...${KIWI_KEY.slice(-4)}`);
  console.log("=".repeat(50));
  console.log("\n📝 사용 가능한 엔드포인트:");
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/api/locations?term=Seoul`);
  console.log(`  POST http://localhost:${PORT}/api/search-flights`);
  console.log(`  POST http://localhost:${PORT}/mcp (레거시)`);
  console.log("=".repeat(50));
});
