import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import "dotenv/config";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_TOKEN,
} = process.env;

if (
  !ASTRA_DB_NAMESPACE ||
  !ASTRA_DB_COLLECTION ||
  !ASTRA_DB_API_ENDPOINT ||
  !ASTRA_DB_TOKEN
) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

const EMBEDDING_SERVER_URL = "http://localhost:5000/embed";

const checkEmbeddingServer = async (): Promise<boolean> => {
  try {
    const response = await fetch("http://localhost:5000", {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
};

const getEmbeddings = async (texts: string[]): Promise<number[][]> => {
  try {
    const response = await fetch(EMBEDDING_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ texts }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.embeddings;
  } catch (error) {
    console.error("Error getting embeddings from local server:", error);
    throw error;
  }
};

const f1Data = [
  "https://en.wikipedia.org/wiki/Formula_One",
  "https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-formula-1-weekend.5RFZzGXNhEi9AEuMXwo987",
  "https://www.formula1.com/en/racing/2023",
  "https://www.redbull.com/ie-en/f1-24-tips-guide",
];

const client = new DataAPIClient(ASTRA_DB_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {
  namespace: ASTRA_DB_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (
  similarityMetric: SimilarityMetric = "cosine"
) => {
  try {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
      vector: {
        dimension: 768,
        metric: similarityMetric,
      },
    });
    console.log("Collection created:", res);
  } catch (error) {
    console.log("Collection may already exist:", error);
  }
};

const loadSampleData = async () => {
  const collection = db.collection(ASTRA_DB_COLLECTION);
  
  console.log("Checking if embedding server is running at http://localhost:5000...");
  const serverRunning = await checkEmbeddingServer();
  if (!serverRunning) {
    console.error("❌ Embedding server is not running!");
    console.log("Please start your Python Flask server first:");
    console.log("  python your_flask_server.py");
    console.log("Make sure it's running on port 5000");
    return;
  }
  console.log("✅ Embedding server is running");
  
  console.log(`Loading data from ${f1Data.length} URLs...`);

  for await (const url of f1Data) {
    console.log(`Scraping: ${url}`);
    const content = await scrapePage(url);
    if (!content) {
      console.log(`Skipping empty content from ${url}`);
      continue;
    }

    const chunks = await splitter.splitText(content);
    console.log(`  > Split into ${chunks.length} chunks.`);

    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`);
      
      try {
        const embeddings = await getEmbeddings(batch);
        
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const vector = embeddings[j];
          
          if (!vector || vector.length === 0) {
            console.log(`Skipping chunk due to missing embedding vector`);
            continue;
          }

          await collection.insertOne({
            $vector: vector,
            text: chunk,
          });
        }
      } catch (error) {
        console.error(`Error processing batch:`, error);
        console.log("❌ Server connection lost. Please check if your Python Flask server is still running.");
        return;
      }
    }
  }
  console.log("Data loading complete.");
};

const scrapePage = async (url: string) => {
  try {
    const loader = new PuppeteerWebBaseLoader(url, {
      launchOptions: {
        headless: true,
      },
      gotoOptions: {
        waitUntil: "domcontentloaded",
      },
      evaluate: async (page, browser) => {
        const result = await page.evaluate(() => document.body.innerHTML);
        await browser.close();

        return result;
      },
    });
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, "");
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return "";
  }
};

createCollection().then(() => loadSampleData());
