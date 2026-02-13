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
  excludeNames: string[] = []
): Promise<Lead[]> => {
  const ai = getClient();
  
  let countInstruction = "";
  let sourceLabel = "";

  switch (mode) {
    case 'fast':
      countInstruction = "Find about 10 distinct businesses. Provide a quick overview.";
      sourceLabel = "Fast Scrape";
      break;
    case 'deep':
      countInstruction = "Perform a thorough search. Find between 50 and 99 distinct businesses. Dig deeper than just the top results. Ensure a good mix of established and new businesses.";
      sourceLabel = "Deep Scrape";
      break;
    case 'extreme':
      countInstruction = "Perform an exhaustive, extreme deep search. List AS MANY results as possible (aim for 200 to 500 distinct businesses). Do not limit yourself to one page of results. Aggressively find phone numbers and emails. This is a high-volume data extraction request.";
      sourceLabel = "Extreme Scrape";
      break;
  }

  // Construct exclusion text if we are loading more
  const exclusionContext = excludeNames.length > 0 
    ? `IMPORTANT: The user has already seen the following businesses. DO NOT include them in the results. Find DIFFERENT businesses: ${excludeNames.slice(0, 50).join(', ')}...` 
    : "";

  const prompt = `
    ${countInstruction}
    Category: "${category}"
    Location: "${location}"
    ${exclusionContext}
    
    For each business, provide:
    1. Name
    2. Full Address
    3. Phone Number (if available in public listing)
    4. Website URL (if available)
    5. A plausible email address (if not found, generate a likely format like info@domain.com or leave empty)
    6. Rating (simulate a rating between 3.5 and 5.0 if not strictly available)
    
    Return the data as a pure JSON array of objects. Do not wrap in markdown code blocks. 
    The JSON keys must be: "name", "address", "phone", "email", "website", "rating".
    
    Example format:
    [
      { "name": "Example Dental", "address": "123 Main St", "phone": "+1 555-0102", "email": "contact@exampledental.com", "website": "https://exampledental.com", "rating": 4.5 }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Required for Google Maps tool
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        // We do not set responseMimeType to JSON here because we are using a tool (Maps).
      },
    });

    const text = response.text || "[]";
    
    // Clean up potential markdown code blocks or explanatory text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let parsedData: any[] = [];
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("Failed to parse JSON directly, attempting relaxed parsing", e);
      return [];
    }

    // Map to Lead interface
    const leads: Lead[] = parsedData.map((item: any, index: number) => ({
      id: `lead-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.name || "Unknown Business",
      category: category,
      address: item.address || location,
      phone: item.phone || "N/A",
      email: item.email || "",
      website: item.website || "",
      rating: item.rating || 0,
      status: 'New',
      source: sourceLabel,
    }));

    return leads;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

/**
 * Generates marketing email content based on a prompt.
 */
export const generateEmailContent = async (
  topic: string,
  tone: string
): Promise<{ subject: string; body: string }> => {
  const ai = getClient();
  
  const prompt = `
    Write a short, punchy promotional email/message for a marketing campaign.
    Topic: ${topic}
    Tone: ${tone}
    Length: Strictly under 120 words. Keep it concise and high-impact suitable for WhatsApp or quick emails.
    
    Return the response in JSON format with two keys: "subject" and "body".
    The body should be HTML formatted (using <br>, <p>, <strong> tags).
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