import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./types.js";
import type { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages";

// LLM 프로바이더 타입
type LLMProvider = "openai" | "anthropic";

// 환경 변수에서 설정 읽기
const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase() as LLMProvider;

// API 클라이언트 초기화
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : undefined;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : undefined;

/**
 * LLM과 대화하기
 * @param messages 대화 내역
 * @returns AI 응답 텍스트
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  // 시스템 메시지와 대화 메시지 분리
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  console.log(`🤖 LLM 호출 (${PROVIDER})`);

  try {
    if (PROVIDER === "anthropic" && anthropic) {
      // Claude 사용
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        system: systemMessage?.content,
        messages: conversationMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      });

      // Claude 응답 추출 - 타입 가드 이용
      function isTextBlock(block: ContentBlock): block is TextBlock {
        return block.type === "text";
      }

      const text = response.content.filter(isTextBlock).map((c) => c.text).join("");

      console.log(`✅ Claude 응답 받음 (${text.length}자)`);
      return text;
    } else if (openai) {
      // OpenAI GPT 사용
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        temperature: 0.2,
        max_tokens: 800,
      });

      const text = response.choices[0]?.message?.content || "";
      console.log(`✅ GPT 응답 받음 (${text.length}자)`);
      return text;
    } else {
      throw new Error(`LLM 프로바이더가 설정되지 않았습니다. (현재: ${PROVIDER})`);
    }
  } catch (error) {
    console.error("❌ LLM 호출 실패:", error);
    throw error;
  }
}

// 시작 시 설정 확인
export function validateLLMConfig(): void {
  if (PROVIDER === "anthropic" && !anthropic) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }
  if (PROVIDER === "openai" && !openai) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  console.log(`✅ LLM 설정 완료: ${PROVIDER}`);
}
