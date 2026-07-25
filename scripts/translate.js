#!/usr/bin/env node

/**
 * translate.js
 * Batch translates Chinese project names and descriptions to English
 * using Google Translate free API (no key required).
 *
 * Reads:  docs/data/projects.json
 * Writes: docs/data/translations.json
 *
 * Usage: node scripts/translate.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_FILE = path.join(ROOT, 'docs', 'data', 'projects.json');
const TRANSLATIONS_FILE = path.join(ROOT, 'docs', 'data', 'translations.json');

const DELAY_MS = 200;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function translateText(text, sourceLang = 'zh-CN', targetLang = 'en') {
  if (!text || text.trim().length === 0) return '';

  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return text;

    const data = await res.json();
    // Response format: [[["translated text","original text",...],...],...]
    if (data && data[0]) {
      return data[0].map(s => s[0]).join('');
    }
    return text;
  } catch (err) {
    return text;
  }
}

function detectLang(text) {
  if (!text) return 'en';
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

async function main() {
  console.log('=== Google Translate Batch Translation ===\n');

  const projects = loadJSON(PROJECTS_FILE);
  if (!projects || !projects.projects) {
    console.error('Error: Cannot read projects.json');
    process.exit(1);
  }

  const translations = loadJSON(TRANSLATIONS_FILE) || {};
  const existingKeys = new Set(Object.keys(translations));

  const toTranslate = projects.projects.filter(p => {
    if (existingKeys.has(p.name)) return false;
    return detectLang(p.name) === 'zh' || detectLang(p.description) === 'zh';
  });

  console.log(`Total projects: ${projects.projects.length}`);
  console.log(`Already translated: ${existingKeys.size}`);
  console.log(`To translate: ${toTranslate.length}\n`);

  if (toTranslate.length === 0) {
    console.log('Nothing to translate. Done!');
    return;
  }

  let translated = 0;

  for (let i = 0; i < toTranslate.length; i++) {
    const p = toTranslate[i];
    const progress = `[${i + 1}/${toTranslate.length}]`;

    process.stdout.write(`${progress} ${p.name.substring(0, 40)}... `);

    const en_name = detectLang(p.name) === 'zh'
      ? await translateText(p.name)
      : p.name;

    await sleep(DELAY_MS);

    const en_description = detectLang(p.description) === 'zh'
      ? await translateText(p.description)
      : p.description;

    translations[p.name] = { en_name, en_description };
    translated++;
    console.log('OK');

    if ((i + 1) % 50 === 0) {
      saveJSON(TRANSLATIONS_FILE, translations);
      console.log(`  [Saved: ${translated}/${toTranslate.length}]\n`);
    }

    await sleep(DELAY_MS);
  }

  saveJSON(TRANSLATIONS_FILE, translations);
  console.log(`\nDone! Translated: ${translated}`);
  console.log(`Saved to: ${TRANSLATIONS_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
