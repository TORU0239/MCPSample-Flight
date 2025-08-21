// api-gateway/src/types.ts

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface TravelCard {
  title: string;
  summary: string;
  url?: string;
}

export interface ChatResponse {
  message: string;
  flights?: {
    currency: string;
    items: any[];
  };
  cards?: TravelCard[];
}

export interface FlightSearchRequest {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  round?: boolean;
  adults?: number;
  currency?: string;
  maxStopovers?: number;
}

export interface FlightIntent {
  intent: "search_flights";
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  round?: boolean;
  adults?: number;
  currency?: string;
}
