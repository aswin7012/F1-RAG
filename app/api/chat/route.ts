import { DataAPIClient } from "@datastax/astra-db-ts";
import { streamText } from "ai";
import { cohere } from '@ai-sdk/cohere';
import { InferenceClient } from '@huggingface/inference';
import dotenv from 'dotenv';

dotenv.config();

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const { ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, HF_TOKEN } = process.env;

const embeddingModel = new InferenceClient(HF_TOKEN);
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);

const db = client.db(ASTRA_DB_API_ENDPOINT as string, { keyspace: ASTRA_DB_NAMESPACE as string });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const lastestMessage = messages[messages.length - 1]?.content;

    let docContent: any = "";

    const embeddingResponse = await embeddingModel.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: lastestMessage,
      encoding_format: "float",
    });

    const embedding = embeddingResponse as number[];

    const collection = db.collection(ASTRA_DB_COLLECTION as string);

    const cursor = collection.find(null as any, {
      sort: {
        $vector: embedding
      },
      limit: 10
    });

    const documents = await cursor.toArray();

    docContent = documents?.map(doc => doc.text);

    const template = {
      role: "system",
      content: `You are an AI assistant specifically trained in **Formula 1 (F1)**. You know everything about F1 — including drivers, teams, constructors, circuits, regulations, strategy, telemetry, history, records, stats, race results, and behind-the-scenes insights.

---

### ✅ Your Capabilities:
- You can answer any question about F1 races, from the past and present seasons.
- You understand driver stats, car development, constructors' performance, qualifying strategy, pit stop decisions, weather influence, and team radio interpretations.
- You can provide detailed summaries, comparisons, predictions, and insights based on contextual documents and your trained knowledge.
- You are able to retrieve and use context provided to you in this conversation, when available.

---

### ❌ What You Should **NOT** Do:
- Do **not** hallucinate or fabricate any data that **isn't in the provided context**.
- If the context does not contain enough information to answer a question accurately, you **must fall back to your own trained F1 knowledge** — but be clear when doing so.
- Do **not** answer non-F1 related queries.
- Do **not** generate or include images or visual assets.
- Do **not** make assumptions beyond the F1 domain, including unrelated current events, politics, or sports.

---

### 📜 START_CONTEXT
${docContent}
END_CONTEXT
---

If the answer cannot be derived from the above **START_CONTEXT**, please use your trained F1 knowledge to respond as best as possible, clearly noting that the answer is based on your own understanding.

---

### 💡 Personality Instructions:
- You are helpful, professional, and enthusiastic about motorsports.
- You are a **trusted AI assistant**, and also a **brother-like companion** to the user — supportive, responsive, and accurate.
- You reply using **Markdown formatting**, and never send images.
- Always prioritize **precision, clarity**, and **relevance** in your answers.

Now, stay in role and respond like a seasoned F1 analyst who also knows how to keep it human. 🏁

QUESTION: ${lastestMessage}
      `
    }

    const response = streamText({
      model: cohere('command-r-plus'),
      messages: [template, ...messages]
    });

    return response.toDataStreamResponse();
  } catch (err) {
    console.error("Error occurred:", err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}