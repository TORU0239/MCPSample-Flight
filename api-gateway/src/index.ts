import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import dotenv from "dotenv";
import { chat, validateLLMConfig } from "./llm.js";
import { searchFlightsViaMCP, lookupLocationsViaMCP } from "./mcpClient.js";
import type {
  ChatRequest,
  ChatResponse,
  FlightSearchRequest,
  FlightIntent,
  TravelCard,
} from "./types.js";

// 환경 변수 로드
dotenv.config();

// LLM 설정 검증
validateLLMConfig();

async function main() {
  // Fastify 인스턴스 생성
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          colorize: true,
        },
      },
    },
  });

  // ===== 미들웨어 설정 =====

  // CORS
  await fastify.register(cors, {
    origin: true, // 프로덕션에서는 특정 도메인만 허용하세요
    credentials: true,
  });

  // Rate Limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    hook: "onRequest", // Fastify 5에서 추천하는 방식
  });

  // ===== 라우트 정의 =====

  /**
   * 헬스 체크
   */
  fastify.get("/health", async () => ({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    providers: {
      llm: process.env.LLM_PROVIDER,
      flightServer: process.env.FLIGHT_SERVER_URL || "http://localhost:8700",
    },
  }));

  /**
   * 위치 검색 (IATA 코드 찾기)
   * GET /locations?term=Seoul&limit=5
   */
  fastify.get<{
    Querystring: { term?: string; limit?: string };
  }>("/locations", async (request, reply) => {
    const { term = "Seoul", limit = "5" } = request.query;

    try {
      const result = await lookupLocationsViaMCP({
        term,
        limit: Number(limit),
      });

      return result || { locations: [] };
    } catch (error) {
      request.log.error(error, "위치 검색 실패");
      return reply.code(500).send({ error: "위치 검색 중 오류가 발생했습니다" });
    }
  });

  /**
   * 직접 항공편 검색 (LLM 없이)
   * POST /search-flights
   */
  fastify.post<{
    Body: FlightSearchRequest;
  }>("/search-flights", async (request, reply) => {
    // 입력 검증
    const schema = z.object({
      origin: z.string().min(3).max(10),
      destination: z.string().min(3).max(10),
      departDate: z.string().regex(/\d{4}-\d{2}-\d{2}/),
      returnDate: z.string().regex(/\d{4}-\d{2}-\d{2}/).optional(),
      round: z.boolean().optional(),
      adults: z.number().int().min(1).max(9).optional(),
      currency: z.string().optional(),
      maxStopovers: z.number().int().min(0).max(2).optional(),
    });

    try {
      const params = schema.parse(request.body);

      const result = await searchFlightsViaMCP(params);

      if (!result) {
        return reply.code(404).send({ error: "항공편을 찾을 수 없습니다" });
      }

      return result;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "잘못된 요청", details: error.errors });
      }

      request.log.error(error, "항공편 검색 실패");
      return reply.code(500).send({ error: "항공편 검색 중 오류가 발생했습니다" });
    }
  });

  /**
   * 대화형 채팅 엔드포인트
   * POST /chat
   */
  fastify.post<{
    Body: ChatRequest;
  }>("/chat", async (request, reply) => {
    const { messages } = request.body;

    if (!messages || messages.length === 0) {
      return reply.code(400).send({ error: "메시지가 필요합니다" });
    }

    try {
      // Step 1: 의도 파악
      const intentPrompt = `
You are a travel assistant. Analyze the user's message and determine their intent.

If they want to search for flights, extract the following information and return ONLY a JSON object:
{
  "intent": "search_flights",
  "origin": "IATA code or city name",
  "destination": "IATA code or city name",
  "departDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD" (optional for round trips),
  "round": true/false,
  "adults": number (default 1),
  "currency": "USD/KRW/EUR/etc" (optional)
}

If it's not a flight search, just respond naturally with helpful travel advice.
Do NOT include any text outside the JSON when intent is search_flights.`;

      const intentResponse = await chat([{ role: "system", content: intentPrompt }, ...messages]);

      request.log.info({ intentResponse }, "LLM 의도 분석 결과");

      let assistantMessage = intentResponse;
      let flights = null;
      let cards: TravelCard[] = [];

      // Step 2: 항공편 검색 의도인 경우
      try {
        const parsed = JSON.parse(intentResponse) as FlightIntent;

        if (parsed?.intent === "search_flights") {
          request.log.info({ parsed }, "항공편 검색 요청 감지");

          // MCP를 통한 항공편 검색
          flights = await searchFlightsViaMCP({
            origin: parsed.origin,
            destination: parsed.destination,
            departDate: parsed.departDate,
            returnDate: parsed.returnDate,
            round: !!parsed.round,
            adults: parsed.adults || 1,
            currency: parsed.currency || "USD",
          });

          // Step 3: 검색 결과 요약
          if (flights && flights.items?.length > 0) {
            const summaryPrompt = `
Summarize these flight search results in a friendly, concise way for a mobile chat interface.
Keep it under 3 sentences. Mention the cheapest option and flight duration range.
Be conversational and helpful.`;

            assistantMessage = await chat([
              { role: "system", content: summaryPrompt },
              { role: "user", content: JSON.stringify(flights) },
            ]);

            // Step 4: 여행 정보 카드 생성
            const cardsPrompt = `
Create 3 travel info cards for ${parsed.destination}.
Return ONLY a JSON array with this structure:
[
  {"title": "Local Food", "summary": "Must-try dishes and restaurants", "url": "optional"},
  {"title": "Top Attractions", "summary": "Popular sights and activities", "url": "optional"},
  {"title": "Travel Tips", "summary": "Useful local information", "url": "optional"}
]`;

            const cardsResponse = await chat([
              { role: "system", content: cardsPrompt },
              { role: "user", content: `Destination: ${parsed.destination}` },
            ]);

            try {
              cards = JSON.parse(cardsResponse);
            } catch {
              request.log.warn("카드 생성 실패, 기본 카드 사용");
              cards = [
                { title: "Explore", summary: `Discover ${parsed.destination}` },
                { title: "Local Tips", summary: "Check local guides for recommendations" },
                { title: "Weather", summary: "Check forecast before your trip" },
              ];
            }
          } else {
            assistantMessage = "죄송합니다, 해당 조건의 항공편을 찾을 수 없습니다. 날짜나 목적지를 조정해보시겠어요?";
          }
        }
      } catch (parseError) {
        // JSON 파싱 실패 = 일반 대화
        request.log.debug("일반 대화 모드");
      }

      // 응답 생성
      const response: ChatResponse = {
        message: assistantMessage,
        flights,
        cards,
      };

      return response;
    } catch (error) {
      request.log.error(error, "채팅 처리 실패");
      return reply.code(500).send({
        message: "죄송합니다, 요청을 처리하는 중 오류가 발생했습니다.",
        error: true,
      });
    }
  });

  // ===== 서버 시작 =====
  const PORT = Number(process.env.PORT || 8787);
  const HOST = "0.0.0.0";

  try {
    await fastify.listen({ port: PORT, host: HOST });

    console.log("=".repeat(50));
    console.log(`🚀 API Gateway 시작됨`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🤖 LLM: ${process.env.LLM_PROVIDER}`);
    console.log(`🛫 Flight Server: ${process.env.FLIGHT_SERVER_URL || "http://localhost:8700"}`);
    console.log("=".repeat(50));
    console.log("\n📝 사용 가능한 엔드포인트:");
    console.log("  GET  /health");
    console.log("  GET  /locations?term=Seoul");
    console.log("  POST /search-flights");
    console.log("  POST /chat");
    console.log("=".repeat(50));
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
