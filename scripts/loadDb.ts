import { DataAPIClient } from '@datastax/astra-db-ts';
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import 'dotenv/config';

type SimilarityMetric = 'dot_product' | 'cosine' | 'euclidean';

const {
    GOOGLE_API_KEY, 
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_TOKEN
} = process.env;

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://www.skysports.com/f1',
    'https://www.skysports.com/f1/news/12433/13284600/lewis-hamilton-new-ferrari-driver-celebrates-40th-birthday-ahead-of-fresh-f1-adventure-in-2025',
    'https://www.formula1.com/en/latest/all',
    'https://www.formula1.com/en/latest/article/the-beginners-guide-to-the-formula-1-weekend.5RFZzGXNhEi9AEuMXwo987',
    'https://www.redbull.com/ie-en/f1-24-tips-guide',
    'https://www.formula1.com/en/racing/2023',
    'https://www.formula1.com/en/racing/2023/United_States.html',
    'https://www.formula1.com/en/racing/2022',
];

const client = new DataAPIClient(ASTRA_DB_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {
    namespace: ASTRA_DB_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
});

const createCollection = async (similarityMetric: SimilarityMetric = "cosine") => {
    try {
        const res = await db.createCollection(ASTRA_DB_COLLECTION, {
            vector: {
                dimension: 768,
                metric: similarityMetric,
            }
        });
        console.log("Collection created:", res);
    } catch (e) {
        console.log("Collection may already exist.");
    }
};

const loadSampleData = async () => {
    const collection = db.collection(ASTRA_DB_COLLECTION);
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

        for await (const chunk of chunks) {
            const result = await embeddingModel.embedContent({
                content: chunk,
                taskType: TaskType.RETRIEVAL_DOCUMENT, 
            });

            const vector = result.embedding.values;

            const res = await collection.insertOne({
                $vector: vector,
                text: chunk,
            });
        }
    }
    console.log('Data loading complete.');
};

const scrapePage = async (url: string) => {
    try {
        const loader = new PuppeteerWebBaseLoader(url, {
            launchOptions: {
                headless: true,
            },
            gotoOptions: {
                waitUntil: "domcontentloaded"
            },
        });
        const docs = await loader.load();
        return docs.map(doc => doc.pageContent).join('\n\n');
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        return '';
    }
};

createCollection().then(() => loadSampleData());