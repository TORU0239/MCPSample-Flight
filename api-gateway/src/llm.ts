import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "./types.js";
import type { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources/messages";

type LLMProvider = "openai" | "anthropic";

const PROVIDER = (process.env.LLM_PROVIDER || "openai").toLowerCase() as LLMProvider;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : undefined;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : undefined;

export async function chat(messages: ChatMessage[]): Promise<string> {
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  console.log(`🤖 LLM 호출 (${PROVIDER})`);

  try {
    if (PROVIDER === "anthropic" && anthropic) {
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        max_tokens: 800,
        system: systemMessage?.content,
        messages: conversationMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      });

      function isTextBlock(block: ContentBlock): block is TextBlock {
        return block.type === "text";
      }

      const text = response.content.filter(isTextBlock).map((c) => c.text).join("");
      console.log(`✅ Claude 응답 받음 (${text.length}자)`);
      return text;
    } else if (openai) {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
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

export function validateLLMConfig(): void {
  console.log(`✅ LLM 프로바이더: ${PROVIDER}, apikey: ${process.env[`${PROVIDER.toUpperCase()}_API_KEY`] ? "설정됨" : "없음"}`);

  if (PROVIDER === "anthropic" && !anthropic) {
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다.");
  }
  if (PROVIDER === "openai" && !openai) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }
  console.log(`✅ LLM 설정 완료: ${PROVIDER}`);
}
