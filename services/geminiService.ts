import { GoogleGenAI } from "@google/genai";
import { Lead } from "../types";

// Helper to validate API Key
export const hasApiKey = (): boolean => {
  return !!process.env.API_KEY;
};

// Initialize Gemini Client
const getClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set it in the environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Uses Gemini with Google Maps tool to find businesses.
 * Note: Maps tool is strictly for Gemini 2.5 series.
 */
export const searchBusinesses = async (
  category: string,
  location: string,
  mode: 'fast' | 'deep' | 'extreme' = 'fast',
  locationHints: string = '',
  excludeNames: string[] = []
): Promise<Lead[]> => {
  const ai = getClient();
  
  let countInstruction = "";
  let sourceLabel = "";

  switch (mode) {
    case 'fast':
      countInstruction = "Find up to 10 distinct businesses. Provide a quick overview.";
      sourceLabel = "Fast Scrape";
      break;
    case 'deep':
      countInstruction = "Perform a thorough search. Find up to 20 distinct businesses. Dig deeper than just the top results.";
      sourceLabel = "Deep Scrape";
      break;
    case 'extreme':
      countInstruction = "EXTREME MODE: We need maximum volume. Find at least 20-30 businesses in this specific batch. Look for hidden gems, new listings, and places with fewer reviews to expand the list.";
      sourceLabel = "Extreme Scrape";
      break;
  }

  // Optimize exclusion context to avoid token limits while maintaining effectiveness
  // We use a Set to ensure uniqueness and slice the last 100 to keep prompt size manageable
  const uniqueExcludes = [...new Set(excludeNames)];
  const exclusionList = uniqueExcludes.slice(-100).map(n => `"${n}"`).join(", ");
  
  const exclusionContext = uniqueExcludes.length > 0 
    ? `\nCRITICAL CONSTRAINT: You MUST IGNORE these previously found businesses: [${exclusionList}]. \nDo NOT return any of these. Find COMPLETELY DIFFERENT businesses.` 
    : "";

  const prompt = `
    Task: Search for businesses on Google Maps.
    Search Query: "${category}"
    Location: "${location}"
    ${locationHints ? `Hints: "${locationHints}"` : ""}
    
    ${countInstruction}
    ${exclusionContext}
    
    Instruction:
    1. Use the Google Maps tool to find businesses matching the query in the specified location.
    2. Focus on getting valid contact details where available.
    3. If the exact location has limited results, slightly expand the radius but keep it relevant.
    
    Output Format:
    Return a pure JSON array of objects.
    Keys: "name", "address", "phone", "email", "website", "rating", "type".
    
    Rules:
    - "phone" should be the public number.
    - "email" should be a plausible contact email if found, or leave empty string.
    - "rating" should be the number (e.g. 4.5).
    - Do not wrap in markdown (no \`\`\`json). Just the raw JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        // We do not set responseMimeType to JSON here because we are using a tool (Maps).
      },
    });

    const text = response.text || "[]";
    
    // Robust JSON extraction
    // 1. Try finding array brackets first
    let cleanJson = text;
    const arrayMatch = text.match(/\[([\s\S]*)\]/);
    
    if (arrayMatch) {
      cleanJson = arrayMatch[0];
    } else {
      // 2. Fallback cleanup
      cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    
    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("JSON Parse Error:", e);
      // Attempt to fix common trailing comma issues or markdown noise
      try {
         // distinct fix for common "Generative AI" JSON issues
         cleanJson = cleanJson.replace(/,\s*]/g, ']'); 
         parsedData = JSON.parse(cleanJson);
      } catch (e2) {
         console.error("Failed to recover JSON data");
         return [];
      }
    }

    if (!Array.isArray(parsedData)) {
      return [];
    }

    // Map to Lead interface
    const leads: Lead[] = parsedData.map((item: any) => ({
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.name || "Unknown Business",
      category: item.type || category,
      address: item.address || location,
      phone: item.phone || "N/A",
      email: item.email || "",
      website: item.website || "",
      rating: typeof item.rating === 'number' ? item.rating : 0,
      status: 'New',
      source: sourceLabel,
    }));

    // Filter out potential duplicates that might have slipped through based on name similarity
    // (Simple normalization check)
    const finalLeads = leads.filter(newLead => {
      const isDuplicate = uniqueExcludes.some(existingName => 
        existingName.toLowerCase() === newLead.name.toLowerCase()
      );
      return !isDuplicate;
    });

    return finalLeads;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Validates/Refines a location string using Gemini + Google Maps.
 */
export const lookupLocation = async (query: string): Promise<string> => {
  const ai = getClient();
  const prompt = `Use Google Maps to find the location matching: "${query}". Return ONLY the formatted address or standard name of the place (e.g. "Downtown Dubai, UAE"). Do not include any other text.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
    return response.text?.trim() || query;
  } catch (e) {
    console.warn("Location lookup failed, returning original", e);
    return query;
  }
};

/**
 * Reverse geocodes coordinates to a location name.
 */
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const ai = getClient();
  const prompt = `What city/area is at coordinates ${lat}, ${lng}? Return ONLY the "City, Region, Country" string.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });
    return response.text?.trim() || `${lat}, ${lng}`;
  } catch (e) {
    console.warn("Reverse geocode failed", e);
    return `${lat}, ${lng}`;
  }
};

/**
 * Generates marketing email/message content based on a prompt.
 */
export const generateEmailContent = async (
  topic: string,
  tone: string,
  platform: 'Email' | 'WhatsApp' = 'Email'
): Promise<{ subject: string; body: string }> => {
  const ai = getClient();
  
  let instructions = "";
  if (platform === 'WhatsApp') {
    instructions = `
      Platform: WhatsApp (Direct Business Message)
      Goal: Create a highly persuasive, professional, and attractive offer that motivates the user to act.
      Tone: ${tone} (must be Professional yet Engaging).
      
      Constraints: 
      - Length: Approximately 80-130 words. Not too short, not too long. Enough to sell the value properly.
      - Structure: Use clear paragraphs or line breaks.
      - Formatting: Use *bold* for the most attractive parts of the offer (e.g., discounts, key benefits).
      - Emojis: Use 2-3 professional emojis (e.g., 🚀, 📈, ⭐) to make it visually appealing but not childish.
      - No hashtags.
      
      CRITICAL INSTRUCTIONS:
      1. Greeting: You MUST start with "Hello {name}," or "Hi {name Team},". This placeholder is mandatory.
      2. The Hook: Immediately state the value or the problem you solve.
      3. The Offer: Make the offer sound irresistible and professional. Explain WHY they need it.
      4. Call to Action: End with a clear, low-friction question or step.
    `;
  } else {
    instructions = `
      Platform: Professional Cold Email
      Goal: B2B Sales & Partnerships - High Conversion.
      Tone: ${tone} (Professional, Authoritative, Persuasive).
      
      Constraints:
      - Length: Approximately 200-250 words. Detailed and convincing.
      - Formatting: Use HTML tags (<br>, <p>, <strong>, <ul>, <li>) to structure the email beautifully.
      - Content Structure:
        1. Salutation: "Dear {name}," or "Hi {name},".
        2. Opener: A strong, personalized hook related to their industry.
        3. Value Proposition: Elaborate on the offer. Use bullet points (<ul><li>) to list 3 key benefits.
        4. Motivation: Explain the ROI (Return on Investment) or the 'Cost of Inaction'.
        5. Call to Action: A clear, professional next step.
        
      CRITICAL INSTRUCTIONS:
      - Subject Line: Needs to be professional, catchy, and relevant (under 60 chars).
      - The email must feel like a genuine business opportunity, not spam.
    `;
  }

  const prompt = `
    You are a world-class copywriter for B2B marketing. 
    Write a high-converting message about this topic: "${topic}"
    
    ${instructions}
    
    Return ONLY a JSON object with two keys: "subject" and "body".
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", 
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  const text = response.text || "{}";
  return JSON.parse(text);
};

/**
 * Validates a phone number for WhatsApp (Simple heuristic)
 */
export const validateWhatsAppNumber = (phone: string): boolean => {
  if (!phone || phone === "N/A") return false;
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  // Basic check: length between 10 and 15
  return digits.length >= 10 && digits.length <= 15;
};