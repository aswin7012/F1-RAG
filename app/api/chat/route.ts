import { DataAPIClient } from "@datastax/astra-db-ts";
import { streamText } from "ai";
import { openai as openaiProvider } from "@ai-sdk/openai";

interface DocumentResult {
  text: string;
  $vector: number[];
}

const { ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN } = process.env;

const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await fetch("http://localhost:5000/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts: [text] }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.embeddings[0]; // Return the first (and only) embedding
  } catch (error) {
    console.error("Error getting embedding from local server:", error);
    // Return a zero vector as fallback (won't match anything but won't crash)
    return new Array(768).fill(0);
  }
};

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);

const db = client.db(ASTRA_DB_API_ENDPOINT as string, { namespace: ASTRA_DB_NAMESPACE as string });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const latestMessage = messages[messages.length - 1]?.content;

    if (!latestMessage) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let docContent = "";

    // Get embedding from local server
    const embedding = await getEmbedding(latestMessage);

    const collection = db.collection(ASTRA_DB_COLLECTION as string);

    const cursor = collection.find({}, {
      sort: {
        $vector: embedding
      },
      limit: 10
    });

    const documents = await cursor.toArray();

    docContent = documents?.map((doc) => (doc as unknown as DocumentResult).text).join('\n\n');

    const template = {
      role: "system" as const,
      content: `You are an AI assistant who knows everything about Formula One.
      Use the below context to augment what you know about Formula One racing.
      The context will provide you with the most recent page data from Wikipedia,
      the official F1 website and others.
      If the context doesn't include the information you need, answer based on your 
      existing knowledge and don't mention the source of your information or
      what the context does or doesn't include.
      Format responses using markdown where applicable and don't return images.
      -----------------
      START CONTEXT

      ${docContent}

      END CONTEXT
      ------------------
      QUESTION: ${latestMessage}
      `
    };

    const response = streamText({
      model: openaiProvider("gpt-4o-mini"),
      messages: [template, ...messages]
    });

    return response.toDataStreamResponse();
  } catch (err) {
    console.error("Error in chat API:", err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}