import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Fixed, project-authored illustrations. Never derive markup or paths from user input.
export const MEDIA_CATEGORIES = Object.freeze([
  { slug: 'health-fitness', label: 'Fitness', color: '#b5edb0', ink: '#23442a', symbol: '<path d="M268 365h264M268 295v140M225 320v90M532 295v140M575 320v90"/>' },
  { slug: 'travel', label: 'Travel', color: '#b0dfee', ink: '#173e53', symbol: '<path d="m212 445 127-195 65 96 50-69 134 168z"/><circle cx="538" cy="248" r="33"/>' },
  { slug: 'gaming', label: 'Gaming', color: '#d7c2fa', ink: '#41236c', symbol: '<path d="M285 285h230c27 0 40 15 47 42l30 113c8 31-22 48-46 26l-55-48H309l-55 48c-24 22-54 5-46-26l30-113c7-27 20-42 47-42Z"/><path d="M277 346h66m-33-33v66"/><circle cx="494" cy="337" r="9"/><circle cx="534" cy="372" r="9"/>' },
  { slug: 'technology', label: 'Technology', color: '#b3e5df', ink: '#164b44', symbol: '<rect x="295" y="263" width="210" height="210" rx="25"/><rect x="349" y="317" width="102" height="102" rx="10"/><path d="M335 225v38m65-38v38m65-38v38m-130 210v38m65-38v38m65-38v38M257 303h38m-38 65h38m-38 65h38m210-130h38m-38 65h38m-38 65h38"/>' },
  { slug: 'cars-bikes', label: 'Cars', color: '#f3c797', ink: '#6a361d', symbol: '<path d="m235 370 43-94h240l49 94m-345 67v-67h356v67m-356 0h356M300 276l-17 94m217-94 20 94"/><circle cx="285" cy="442" r="33"/><circle cx="515" cy="442" r="33"/>' },
  { slug: 'food', label: 'Food', color: '#f5d9a0', ink: '#664319', symbol: '<path d="M241 348h318c-12 88-55 135-159 135s-147-47-159-135Zm-9 0h336M310 282c-29-30 31-38 0-67m90 67c-29-30 31-38 0-67m90 67c-29-30 31-38 0-67"/>' },
  { slug: 'fashion', label: 'Fashion', color: '#f5c0d4', ink: '#692741', symbol: '<path d="m328 248-105 65 51 82 47-27v125h158V368l47 27 51-82-105-65c-19 56-125 56-144 0Z"/>' },
  { slug: 'photography', label: 'Photography', color: '#bfcdee', ink: '#2c3f69', symbol: '<path d="M240 293h87l25-47h96l25 47h87v190H240Z"/><circle cx="400" cy="388" r="63"/><circle cx="522" cy="332" r="10"/>' },
  { slug: 'music', label: 'Music', color: '#eac6ed', ink: '#5a2a5f', symbol: '<path d="M335 446V275l198-38v171M335 326l198-38"/><ellipse cx="296" cy="452" rx="39" ry="30"/><ellipse cx="494" cy="414" rx="39" ry="30"/>' },
  { slug: 'sports', label: 'Sports', color: '#c9e6a5', ink: '#355122', symbol: '<circle cx="400" cy="365" r="137"/><path d="m400 307 56 40-21 66h-70l-21-66 56-40Zm0-79v79m-130 16 74 24m-26 128 47-62m117 62-47-62m95-90-74 24"/>' },
].map(Object.freeze));

export function renderCategorySvg(category) {
  if (!MEDIA_CATEGORIES.includes(category)) throw new Error('Unknown fixed demo category');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-labelledby="title desc">
  <title id="title">RecoSocial demo: ${category.label}</title>
  <desc id="desc">Project-generated geometric ${category.label.toLowerCase()} illustration. Synthetic demo content, not a real user photograph.</desc>
  <rect width="800" height="1000" fill="${category.color}"/>
  <circle cx="730" cy="88" r="205" fill="white" opacity=".24"/>
  <circle cx="35" cy="864" r="172" fill="${category.ink}" opacity=".08"/>
  <path d="M54 181h692M54 775h692" stroke="${category.ink}" stroke-width="2" opacity=".3"/>
  <text x="55" y="93" fill="${category.ink}" font-family="sans-serif" font-size="26" font-weight="700" letter-spacing="3">RECOSOCIAL</text>
  <text x="55" y="136" fill="${category.ink}" font-family="sans-serif" font-size="22">GENERATED DEMO CONTENT</text>
  <g stroke="${category.ink}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round">${category.symbol}</g>
  <text x="400" y="640" fill="${category.ink}" text-anchor="middle" font-family="sans-serif" font-size="64" font-weight="700">${category.label}</text>
  <text x="400" y="693" fill="${category.ink}" text-anchor="middle" font-family="sans-serif" font-size="25">A synthetic collection for exploring ideas</text>
  <text x="55" y="842" fill="${category.ink}" font-family="sans-serif" font-size="23">DEMO / NOT A REAL ACCOUNT</text>
  <text x="55" y="889" fill="${category.ink}" font-family="sans-serif" font-size="22">Local shapes. No scraped media.</text>
</svg>\n`;
}

export function generatedMedia() {
  return MEDIA_CATEGORIES.map(category => ({ name: `${category.slug}.svg`, source: renderCategorySvg(category) }));
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node scripts/demo/generate-media.mjs (no arguments)');
  const output = fileURLToPath(new URL('../../public/demo/recosocial-v1/', import.meta.url));
  await mkdir(output, { recursive: true });
  for (const file of generatedMedia()) await writeFile(resolve(output, file.name), file.source, 'utf8');
  console.log('Regenerated 10 fixed RecoSocial demo SVGs. Existing video left unchanged.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
