import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

// We will read the file as text and use regex to extract and replace, or just import it.
// Importing it is easier to read, but writing it back as TS is tricky.
// Let's just import it, modify the objects, and write it back.

// To avoid TS errors with importing a TS file in a script, we can run this with tsx.
import { BLOG_POSTS } from './src/data/blogs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function optimizeBlogPost(post: any) {
  try {
    const prompt = `
    You are an expert SEO copywriter. I will provide you with a blog post's current title, excerpt, and content.
    Your task is to optimize the title, excerpt (meta description), and tags for maximum search engine visibility and click-through rate.
    
    Current Title: ${post.title}
    Current Excerpt: ${post.excerpt}
    Current Tags: ${post.tags.join(', ')}
    
    Requirements:
    1. Title: Make it catchy, keyword-rich, and under 60 characters if possible.
    2. Excerpt: Make it a compelling meta description, including primary keywords, under 160 characters.
    3. Tags: Provide 4-6 highly relevant SEO keywords/tags.
    
    Return the result as a JSON object with keys: "title", "excerpt", "tags".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            excerpt: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['title', 'excerpt', 'tags']
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return {
        ...post,
        title: result.title || post.title,
        excerpt: result.excerpt || post.excerpt,
        tags: result.tags && result.tags.length > 0 ? result.tags : post.tags
      };
    }
  } catch (error) {
    console.error(`Error optimizing post ${post.id}:`, error);
  }
  return post;
}

async function main() {
  console.log(`Starting SEO optimization for ${BLOG_POSTS.length} blog posts...`);
  
  const optimizedPosts = [];
  const batchSize = 5; // Process in small batches to avoid rate limits
  
  for (let i = 0; i < BLOG_POSTS.length; i += batchSize) {
    const batch = BLOG_POSTS.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(BLOG_POSTS.length / batchSize)}...`);
    
    const promises = batch.map(post => optimizeBlogPost(post));
    const results = await Promise.all(promises);
    optimizedPosts.push(...results);
    
    // Small delay between batches
    if (i + batchSize < BLOG_POSTS.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('Finished optimizing all posts. Writing to file...');
  
  const fileContent = `import React from 'react';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: React.ReactNode;
  author: string;
  date: string;
  readTime: string;
  category: string;
  imageUrl: string;
  tags: string[];
}

export const BLOG_POSTS: BlogPost[] = ${JSON.stringify(optimizedPosts, null, 2)};
`;

  fs.writeFileSync(path.join(process.cwd(), 'src', 'data', 'blogs.ts'), fileContent);
  console.log('Successfully updated src/data/blogs.ts with SEO optimized content!');
}

main().catch(console.error);
