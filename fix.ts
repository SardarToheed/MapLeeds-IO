import fs from 'fs';
let content = fs.readFileSync('src/data/blogs.ts', 'utf-8');
content = content.replace(/author: 'Sardar Toheed'Connor',/g, "author: 'Sardar Toheed',");
fs.writeFileSync('src/data/blogs.ts', content);
