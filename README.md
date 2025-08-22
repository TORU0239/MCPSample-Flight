# MCP Flight Server

---

## 🚀 Project Overview

MCP Flight Server is a message-based communication protocol (MCP) driven flight search server.  
It accepts client requests via natural language or API calls, converts them into MCP protocol messages, and integrates with the Amadeus flight search API to provide real-time flight information.  
Built with Fastify and TypeScript, it emphasizes performance, type safety, and maintainability.

---

## 🏗️ Architecture & Main Flow

| Component        | Role                                                      |
|------------------|-----------------------------------------------------------|
| Client / Frontend| Sends requests via REST or natural language               |
| API Gateway      | Handles client requests and converts them into MCP format |
| MCP Server       | Fastify-based server processing MCP messages              |
| FlightSearchAdapter | Wraps Amadeus API calls for flight offer retrieval       |
| Amadeus API      | External flight offers search API                          |

Requests flow from Client → API Gateway → MCP Server → Amadeus API  
Responses return in reverse order.

---

## 🧰 Tech Stack

| Category           | Technologies & Libraries                 | Description                      |
|--------------------|----------------------------------------|---------------------------------|
| Language           | TypeScript                             | Strong typing and modern JS      |
| Server Framework   | Fastify                               | High-performance Node.js server  |
| API Gateway        | Express.js                           | Client-facing API routing        |
| Communication      | HTTP, REST, MCP Protocol              | Async message-based communication|
| Authentication     | OAuth 2.0 (Amadeus API)               | Secure API token management      |
| Validation         | Zod                                  | Runtime data & type validation   |
| Build & Dev Tools  | tsup, tsx                            | TypeScript bundling and watch    |
| Environment Vars   | dotenv                               | Secure environment variable management |
| Testing & Debug    | Node.js built-in, Fastify logging     | Monitoring and debugging support |

---

## 🔧 Key Features & Components

- **MCP Message Input/Output**: Defined with TypeScript types and Zod schemas for validation  
- **Amadeus API Integration**: Handles OAuth token management and flight search API calls  
- **Adapter Pattern**: Encapsulates service-specific external API interactions  
- **Fastify-based MCP Server**: Efficient HTTP server for MCP messaging  
- **Legacy Express `/api/search-flights` Endpoint**: Maintained for API Gateway compatibility  
- **Health Check Endpoint**: `/health` for server status monitoring  

---

## ⚙️ Setup & Run Instructions

1. Clone the repo:

    ```
    git clone https://github.com/yourusername/yourrepo.git
    cd yourrepo
    ```

2. Install dependencies:

    ```
    npm install
    ```

3. Create `.env` file in root and add:

    ```
    AMADEUS_CLIENT_ID=your_amadeus_client_id
    AMADEUS_CLIENT_SECRET=your_amadeus_client_secret
    PORT=8787
    ```

4. Start development server with hot reload:

    ```
    npm run dev
    ```

5. Build and run production server:

    ```
    npm run build
    npm start
    ```

---

## 📡 API Usage Examples

| API Type                     | Command Example                                           |
|------------------------------|----------------------------------------------------------|
| MCP Server `/mcp` POST call   | ```
|                              | curl -X POST http://localhost:8787/mcp \\                |
|                              | -H "Content-Type: application/json" \\                   |
|                              | -d '{                                                    |
|                              |   "messageId":"uuid-1234",                               |
|                              |   "sessionId":"session-abc",                             |
|                              |   "service":"flight_search",                             |
|                              |   "action":"invoke",                                     |
|                              |   "payload": {                                          |
|                              |     "origin": "ICN",                                    |
|                              |     "destination": "JFK",                               |
|                              |     "departDate": "2025-09-01",                         |
|                              |     "returnDate": "2025-09-10",                         |
|                              |     "adults": 1,                                        |
|                              |     "currency": "USD"                                   |
|                              |   }                                                     |
|                              | }'                                                      |
|                              | ```                                                     |
| Express API Gateway `/api/search-flights` | ```
|                              | curl -X POST http://localhost:8700/api/search-flights \\ |
|                              | -H "Content-Type: application/json" \\                   |
|                              | -d '{                                                    |
|                              |   "origin": "ICN",                                      |
|                              |   "destination": "JFK",                                 |
|                              |   "departDate": "2025-09-01",                           |
|                              |   "returnDate": "2025-09-10",                           |
|                              |   "adults": 1,                                          |
|                              |   "currency": "USD"                                     |
|                              | }'                                                      |
|                              | ```                                                     |

---

## 📁 Project Structure

| Folder                | Description                           |
|-----------------------|-------------------------------------|
| `src/mcp/`            | MCP server logic and adapters        |
| `src/mcp/adapters/`   | External API adapters (e.g. Amadeus) |
| `src/mcp/types.ts`    | TypeScript types for MCP & Amadeus   |
| `src/mcp/schema.ts`   | Zod schemas for runtime validation   |
| `src/api-gateway/`    | Express-based API Gateway             |
| `src/config/`         | Configuration files and env management|

---

## 🔗 Useful Links

- [Amadeus Flight Offers API](https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search)  
- [Fastify Documentation](https://www.fastify.io/docs/latest/)  
- [Zod Validation Library](https://zod.dev/)  
- [OAuth 2.0 Overview](https://oauth.net/2/)  

---

## ⚠️ Important Notes

- Amadeus API keys may have rate limits and usage policies; verify your quota  
- Keep `.env` and secrets secure to avoid leaks  
- If MCP protocol changes, update MCP server and API Gateway accordingly  

---

## 📝 License

MIT © Wonyoung Choi

---

*This project implements a scalable MCP protocol based real-time flight search service with clean architecture for extensibility and maintainability.*
