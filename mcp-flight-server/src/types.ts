// mcp-flight-server/src/types.ts

// Amadeus API 관련 타입
export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
  };
  itineraries: any[]; // 필요시 상세 타입 정의 가능
}

export interface FlightSearchResult {
  currency: string;
  items: FlightOffer[];
}

export interface SearchFlightParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults?: number;
  currency?: string;
}

export interface AmadeusFlightSearchResponse {
  data?: FlightOffer[];
  // 필요하면 다른 필드들도 추가 가능
}

// MCP 프로토콜 관련 타입
export interface MCPRequest {
  messageId: string;
  sessionId: string;
  service: "flight_search" | "llm" | string;
  action: "invoke" | "update";
  payload: Record<string, any>;
}

export interface MCPResponse {
  messageId: string;
  sessionId: string;
  service: string;
  action: "result" | "update";
  result: Record<string, any>;
  metadata?: Record<string, any>;
  error?: { code: string; message: string };
}


