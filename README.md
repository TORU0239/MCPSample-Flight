# Conversational Flight Search

AI-powered flight search service with natural language processing, built with microservices architecture.

## Overview

A two-tier system that enables users to search flights through natural conversation:
- **API Gateway** - Handles chat interactions, understands natural language using LLM (OpenAI/Anthropic)
- **MCP Flight Server** - Integrates with Amadeus GDS for real-time flight data

## Architecture

```
User → [/chat] → API Gateway (:8787) → [MCP Protocol] → Flight Server (:8700) → Amadeus API
                       ↓                                         
                  OpenAI/Claude                              
```

## Quick Start

### Prerequisites
- Node.js 18+
- Amadeus API credentials ([Register here](https://developers.amadeus.com))
- OpenAI or Anthropic API key

### Installation

1. **Clone and install dependencies**
```bash
# Clone repository
git clone <your-repo-url>
cd <project-root>

# Install Flight Server
cd mcp-flight-server
npm install
cp .env.example .env  # Add Amadeus credentials

# Install API Gateway
cd ../api-gateway
npm install
cp .env.example .env  # Add LLM API keys
```

2. **Configure environment variables**

**mcp-flight-server/.env**
```env
AMADEUS_CLIENT_ID=your_amadeus_client_id
AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
PORT=8700
```

**api-gateway/.env**
```env
# Server
PORT=8787
FLIGHT_SERVER_URL=http://localhost:8700

# LLM Provider (choose one)
LLM_PROVIDER=openai  # or anthropic

# OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# OR Anthropic
ANTHROPIC_API_KEY=your_anthropic_key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

3. **Start services**
```bash
# Terminal 1: Start Flight Server
cd mcp-flight-server
npm run dev

# Terminal 2: Start API Gateway
cd api-gateway
npm run dev
```

## Usage

### Chat with the Assistant

**POST** `http://localhost:8787/chat`

```bash
curl -X POST http://localhost:8787/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find me flights from Seoul to New York next Monday"
      }
    ]
  }'
```

**Response:**
```json
{
  "message": "I found 15 flights from ICN to JFK. The cheapest option is $890 with one stop...",
  "flights": {
    "currency": "USD",
    "items": [...]
  },
  "cards": [
    {"title": "Local Food", "summary": "Must-try NYC dishes..."},
    {"title": "Top Attractions", "summary": "Empire State, Central Park..."},
    {"title": "Travel Tips", "summary": "NYC subway guide..."}
  ]
}
```

### Direct Flight Search

**POST** `http://localhost:8787/search-flights`

```json
{
  "origin": "ICN",
  "destination": "JFK",
  "departDate": "2025-03-15",
  "returnDate": "2025-03-22",
  "adults": 2,
  "currency": "USD"
}
```

## API Endpoints

### API Gateway (Port 8787)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Natural language flight search |
| `/search-flights` | POST | Direct flight search |
| `/locations` | GET | IATA code lookup |
| `/health` | GET | Service health check |

### Flight Server (Port 8700)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol handler |
| `/api/search-flights` | POST | REST API (legacy) |
| `/health` | GET | Service health check |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Fastify 5 |
| Language | TypeScript 5.9 |
| LLM | OpenAI GPT-4 / Anthropic Claude 3.5 |
| GDS | Amadeus Test API |
| Validation | Zod |
| Protocol | MCP (Message Communication Protocol) |

## Project Structure

```
.
├── api-gateway/
│   └── src/
│       ├── index.ts        # Main gateway server
│       ├── llm.ts          # LLM integration
│       ├── mcpClient.ts    # MCP client
│       └── types.ts        # TypeScript types
│
└── mcp-flight-server/
    └── src/
        ├── index.ts        # Flight server with Amadeus
        ├── types.ts        # Type definitions
        └── schema.ts       # Zod schemas
```

## Features

- **Natural Language Processing** - Understands conversational queries
- **Smart Intent Detection** - Extracts flight search parameters from text
- **Travel Recommendations** - Generates destination info cards
- **OAuth Token Management** - Automatic Amadeus token refresh
- **Rate Limiting** - 100 requests/minute per client
- **Type Safety** - Full TypeScript with runtime validation

## Development

```bash
# Build for production
npm run build

# Start production server
npm start

# Type checking
npx tsc --noEmit
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "AMADEUS_CLIENT_ID not set" | Add Amadeus credentials to `.env` |
| "LLM provider not configured" | Set OpenAI or Anthropic API key |
| No flight results | Check IATA codes and date format (YYYY-MM-DD) |
| Connection refused | Ensure both servers are running |

## License

MIT

## Author

Wonyoung Choi