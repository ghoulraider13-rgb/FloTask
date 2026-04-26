import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // Force Vercel to log the start of the function
  console.log("🟢 API Route Hit!");
  console.log("Request Method:", req.method);

  // 1. Handle CORS (Sometimes Vercel blocks frontend requests silently)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Check for the API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("🔴 ERROR: Vercel cannot see the GEMINI_API_KEY");
      return res.status(500).json({ error: 'API Key missing from server' });
    }

    console.log("🟡 API Key found. Initializing Gemini...");
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We will use gemini-1.5-flash as it is the fastest and most reliable for this
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});

    // 3. Process the prompt
    const prompt = req.body.prompt || req.body; 
    console.log("🟡 Prompt received. Sending to Google...");

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    console.log("🟢 Success! Sending data back to React.");
    return res.status(200).json({ text: text });

  } catch (error) {
    // Force a detailed crash log
    console.error("🔴 CRITICAL CRASH:", error.message);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
