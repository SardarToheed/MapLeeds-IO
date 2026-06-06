import fs from 'fs';

console.log('Reading file...');
let content = fs.readFileSync('src/data/blogs.ts', 'utf8');
console.log('File read successfully. Length:', content.length);

async function run() {
  let content = fs.readFileSync('src/data/blogs.ts', 'utf8');
  
  // We need to parse the BLOG_POSTS array.
  // Since it's a TS file with ReactNode content, it's tricky to parse as JSON.
  // Let's just use regex to find each blog post and add the metadata.
  
  const postsRegex = /id:\s*'([^']+)',\s*slug:\s*'([^']+)',\s*title:\s*'([^']+)',\s*excerpt:\s*'([^']+)',/g;
  
  let match;
  const updates = [];
  
  while ((match = postsRegex.exec(content)) !== null) {
    const id = match[1];
    const slug = match[2];
    const title = match[3];
    const excerpt = match[4];
    
    console.log(`Generating metadata for: ${title}`);
    
    const prompt = `Generate optimized SEO metadata for a blog post.
Title: ${title}
Excerpt: ${excerpt}

Return ONLY a JSON object with the following format, no markdown formatting, no backticks:
{
  "seoTitle": "Optimized SEO Title (max 60 chars)",
  "seoDescription": "Optimized meta description (max 160 chars)",
  "seoKeywords": "keyword1, keyword2, keyword3, keyword4, keyword5"
}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const jsonStr = response.text.trim();
      const metadata = JSON.parse(jsonStr);
      
      updates.push({
        id,
        metadata
      });
    } catch (e) {
      console.error(`Failed for ${title}:`, e);
    }
  }
  
  // Now apply updates
  for (const update of updates) {
    const { id, metadata } = update;
    const searchStr = `id: '${id}',`;
    const replaceStr = `id: '${id}',\n    seoTitle: '${metadata.seoTitle.replace(/'/g, "\\'")}',\n    seoDescription: '${metadata.seoDescription.replace(/'/g, "\\'")}',\n    seoKeywords: '${metadata.seoKeywords.replace(/'/g, "\\'")}',`;
    
    content = content.replace(searchStr, replaceStr);
  }
  
  // Update interface
  if (!content.includes('seoTitle?: string;')) {
    content = content.replace('tags: string[];', 'tags: string[];\n  seoTitle?: string;\n  seoDescription?: string;\n  seoKeywords?: string;');
  }
  
  fs.writeFileSync('src/data/blogs.ts', content);
  console.log('Done updating blogs.ts');
}

run();
