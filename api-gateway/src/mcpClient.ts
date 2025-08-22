import { time } from "console";
import { v4 as uuidv4 } from "uuid";

export interface FlightSearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
  currency?: string;
  maxStopovers?: number;
  round?: boolean;
}

export interface MCPResponse<T = any> {
  messageId: string;
  sessionId: string;
  service: string;
  action: "result" | "update";
  result: T;
  metadata?: Record<string, any>;
  error?: { code: string; message: string };
}

const FLIGHT_SERVER_URL = process.env.FLIGHT_SERVER_URL || "http://localhost:8700";

// export async function searchFlightsViaMCP(params: any): Promise<any> {
//   try {
//     console.log("🔍 항공편 검색:", params);
//     const response = await fetch(`${FLIGHT_SERVER_URL}/api/search-flights`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(params),
//     });

//     if (!response.ok) {
//       let errorMessage = `HTTP ${response.status}`;
//       try {
//         const errorBody = await response.json();
//         if (errorBody && typeof errorBody === "object" && "message" in errorBody && typeof (errorBody as any).message === "string") {
//           errorMessage = (errorBody as any).message;
//         }
//       } catch {}
//       throw new Error(errorMessage);
//     }

//     const rawData = await response.json();
//     if (!rawData || typeof rawData !== "object") {
//       throw new Error("서버에서 예상하지 못한 응답이 왔습니다.");
//     }

//     return rawData;
//   } catch (error: unknown) {
//     if (error instanceof Error) {
//       console.error("❌ 항공편 검색 실패:", error.message);
//       throw error;
//     } else {
//       console.error("❌ 항공편 검색 실패:", error);
//       throw new Error("알 수 없는 오류가 발생했습니다.");
//     }
//   }
// }


/**
 * MCP 프로토콜에 맞춰 MCP Flight Server /mcp 엔드포인트 호출
 */
export async function searchFlightsViaMCP(params: FlightSearchParams): Promise<MCPResponse["result"]> {
  console.log("searchFlightsViaMCP, 🔍 MCP 항공편 검색 요청:", params, new Date().toISOString());

  const body = {
    messageId: uuidv4(),
    sessionId: uuidv4(),
    service: "flight_search",
    action: "invoke",
    payload: {
      origin: params.origin,
      destination: params.destination,
      departDate: params.departDate,
      returnDate: params.returnDate,
      adults: params.adults ?? 1,
      currency: params.currency ?? "USD",
      maxStopovers: params.maxStopovers ?? 0,
    },
  };

  const response = await fetch(`${FLIGHT_SERVER_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`MCP 서버 호출 실패 (${response.status}): ${errorBody}`);
  }


  const dataRaw = await response.json();
  if (typeof dataRaw !== "object" || dataRaw === null) {
    throw new Error("잘못된 MCP 응답");
  }

  const data = dataRaw as MCPResponse;

  if (data.error) {
    throw new Error(`MCP 서버 에러: ${data.error.message}`);
  }

  return data.result;
}


export async function lookupLocationsViaMCP(params: { term: string; limit?: number }): Promise<any> {
  try {
    console.log("📍 위치 검색:", params.term);
    const url = new URL(`${FLIGHT_SERVER_URL}/api/locations`);
    url.searchParams.set("term", params.term);
    url.searchParams.set("limit", String(params.limit || 5));

    const response = await fetch(url.toString());

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody === "object" && "message" in errorBody && typeof (errorBody as any).message === "string") {
          errorMessage = (errorBody as any).message;
        }
      } catch {}
      throw new Error(errorMessage);
    }

    const rawData = await response.json();
    if (!rawData || typeof rawData !== "object") {
      throw new Error("서버에서 예상하지 못한 응답이 왔습니다.");
    }

    return rawData;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ 위치 검색 실패:", error.message);
      throw error;
    } else {
      console.error("❌ 위치 검색 실패:", error);
      throw new Error("알 수 없는 오류가 발생했습니다.");
    }
  }
}