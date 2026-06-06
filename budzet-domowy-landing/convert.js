import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const artifactsDir = 'C:\\Users\\krzyc\\.gemini\\antigravity-ide\\brain\\f3ea0e76-7a43-493d-bac7-219f81fbe327';
const outputDir = path.join(process.cwd(), 'public', 'screenshots');

async function convertAll() {
  const files = fs.readdirSync(artifactsDir).filter(f => f.startsWith('media__') && f.endsWith('.png'));
  
  // Sort files by creation time
  files.sort((a, b) => {
    const statA = fs.statSync(path.join(artifactsDir, a));
    const statB = fs.statSync(path.join(artifactsDir, b));
    return statA.mtime.getTime() - statB.mtime.getTime();
  });

  // The first 2 files are old unrelated images, the last 10 are the real screenshots
  const targetFiles = files.slice(-10);

  // Clear existing screenshots
  const existingFiles = fs.readdirSync(outputDir);
  for (const file of existingFiles) {
    if (file.endsWith('.webp')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }

  for (let i = 0; i < targetFiles.length; i++) {
    const inputPath = path.join(artifactsDir, targetFiles[i]);
    const outputPath = path.join(outputDir, `screenshot-${i + 1}.webp`);
    
    try {
      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath);
      console.log(`Converted ${targetFiles[i]} to screenshot-${i + 1}.webp`);
    } catch (err) {
      console.error(`Error converting ${targetFiles[i]}:`, err);
    }
  }
}

convertAll();
