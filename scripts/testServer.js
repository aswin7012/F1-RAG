// Simple test script to check if the embedding server is working
const testEmbeddingServer = async () => {
  try {
    console.log("Testing embedding server...");
    
    const response = await fetch("http://localhost:5000/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        texts: ["Hello world", "This is a test"] 
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Server is working!");
    console.log("Response:", data);
    console.log(`Embedding dimensions: ${data.embeddings[0].length}`);
    
  } catch (error) {
    console.error("❌ Server test failed:", error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log("Make sure your Python Flask server is running:");
      console.log("  python your_flask_server.py");
    }
  }
};

testEmbeddingServer();
