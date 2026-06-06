import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:\\Users\\krzyc\\.gemini\\antigravity-ide\\brain\\f3ea0e76-7a43-493d-bac7-219f81fbe327';
const outputDir = path.join(process.cwd(), 'public', 'screenshots');

const excludeFiles = [
  'media__1780760574657.png',
  'media__1780761036182.png',
  'media__1780762316992.png'
];

async function convertAll() {
  const files = fs.readdirSync(artifactsDir).filter(f => f.startsWith('media__') && f.endsWith('.png') && !excludeFiles.includes(f));
  
  // Sort files by creation time
  files.sort((a, b) => {
    const statA = fs.statSync(path.join(artifactsDir, a));
    const statB = fs.statSync(path.join(artifactsDir, b));
    return statA.mtime.getTime() - statB.mtime.getTime();
  });

  // Clear existing screenshots
  const existingFiles = fs.readdirSync(outputDir);
  for (const file of existingFiles) {
    if (file.endsWith('.webp')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }

  for (let i = 0; i < files.length; i++) {
    const inputPath = path.join(artifactsDir, files[i]);
    const outputPath = path.join(outputDir, `screenshot-${i + 1}.webp`);
    
    try {
      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath);
      console.log(`Converted ${files[i]} to screenshot-${i + 1}.webp`);
    } catch (err) {
      console.error(`Error converting ${files[i]}:`, err);
    }
  }
}

convertAll();
