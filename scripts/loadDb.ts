import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
// import { OpenAIClient } from "@langchain/openai"; // not free
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import "dotenv/config";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const { ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN } = process.env;

const f1gptdata = [
  "https://en.wikipedia.org/wiki/Formula_One",
  "https://www.formula1.com/en/latest/all",
  "https://www.formula1.com/en/racing/2024.html",
  "https://www.formula1.com/en/results.html/2024/races.html",
  "https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/List_of_Formula_One_World_Driverrs%27_Champions"
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN as string);

const db = client.db(ASTRA_DB_API_ENDPOINT as string, { keyspace: ASTRA_DB_NAMESPACE as string });

// Openai: not free
// const openai = new OpenAIClient({apiKey: OPENAI_API_KEY });

// open source: free
const embeddings = new HuggingFaceTransformersEmbeddings({
  model: 'Xenova/all-MiniLM-L6-v2',
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
  separators: ["\n\n", "\n", " ", ""]
});

const createCollection = async (similarityMetric: SimilarityMetric) => {
  const collection = await db.createCollection(ASTRA_DB_COLLECTION as string, {
    vector: {
      dimension: 384,
      metric: similarityMetric
    }
  });
  console.log(collection);
}


const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION as string);

  for await (const url of f1gptdata) {
    const content  = await scrapePage(url);
    const chunks = await splitter.splitText(content as string);

    // creat embeddings for each chunk
    for await (const chunk of chunks) {

      // From openai, but this cost money
      /**
      const embedd = openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
        encoding_format: "float"
      });

      const vector = (await embedd)?.data?.[0]?.embedding;
      */

      // From open-source: free
      const vector = await embeddings.embedQuery(chunk);

      await collection.insertOne({
        $vector: vector,
        text: chunk
      });
    }
  }

  console.log("Data loaded completely 🎉")
}

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url as string, {
    launchOptions: {
      headless: true
    },
    gotoOptions: {
      waitUntil: "domcontentloaded"
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result
    }
  })
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, "");
}

createCollection('dot_product').then(() => loadSampleData()).catch(err => console.log(err))