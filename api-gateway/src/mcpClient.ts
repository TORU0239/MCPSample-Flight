const FLIGHT_SERVER_URL = process.env.FLIGHT_SERVER_URL || "http://localhost:8700";

export async function searchFlightsViaMCP(params: any): Promise<any> {
  try {
    console.log("🔍 항공편 검색:", params);
    const response = await fetch(`${FLIGHT_SERVER_URL}/api/search-flights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

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
      console.error("❌ 항공편 검색 실패:", error.message);
      throw error;
    } else {
      console.error("❌ 항공편 검색 실패:", error);
      throw new Error("알 수 없는 오류가 발생했습니다.");
    }
  }
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
