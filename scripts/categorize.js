#!/usr/bin/env node

/**
 * categorize.js
 * Auto-generates category tags for projects based on keyword matching.
 *
 * Reads:  docs/data/projects.json
 * Writes: docs/data/projects.json (adds 'tags' field to each project)
 *
 * Usage: node scripts/categorize.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROJECTS_FILE = path.join(ROOT, 'docs', 'data', 'projects.json');

const CATEGORIES = {
  'AI/ML': {
    keywords: [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning',
      'gpt', 'llm', 'chatbot', 'neural', 'transformer', 'diffusion',
      '人工智能', '机器学习', '深度学习', '大模型', '大语言模型',
      'chatgpt', 'openai', 'claude', 'gemini', 'copilot',
    ],
    icon: '🤖',
  },
  'Developer': {
    keywords: [
      'code', 'ide', 'api', 'cli', 'git', 'debug', 'compiler', 'editor',
      'programming', 'developer', 'sdk', 'framework', 'library',
      '编程', '开发', '代码', '编辑器', 'ide', '终端', '命令行',
      'vscode', 'jetbrains', 'vim', 'neovim', 'emacs',
    ],
    icon: '💻',
  },
  'Productivity': {
    keywords: [
      'tool', 'productivity', 'organizer', 'planner', 'todo', 'task',
      'calendar', 'note', 'markdown', 'knowledge', 'wiki',
      '工具', '效率', '笔记', '任务', '日历', '计划', '知识管理',
      'notion', 'obsidian', 'todoist',
    ],
    icon: '⚡',
  },
  'Game': {
    keywords: [
      'game', 'play', 'rpg', 'puzzle', 'strategy', 'arcade',
      '游戏', '棋牌', '角色扮演', '策略', '休闲',
    ],
    icon: '🎮',
  },
  'Media': {
    keywords: [
      'video', 'audio', 'image', 'photo', 'music', 'stream',
      'podcast', 'camera', 'editor', 'player',
      '视频', '音频', '图片', '音乐', '摄影', '播放器', '剪辑',
      'ffmpeg', 'media',
    ],
    icon: '🎬',
  },
  'Mobile': {
    keywords: [
      'ios', 'android', 'mobile', 'phone', 'app store', 'react native',
      'flutter', 'swift', 'kotlin',
      '手机', '移动端', 'android', 'ios',
    ],
    icon: '📱',
  },
  'Web': {
    keywords: [
      'website', 'browser', 'online', 'web app', 'saas', 'pwa',
      '网页', '浏览器', '在线', '网站', '前端',
      'chrome', 'firefox', 'extension', '插件',
    ],
    icon: '🌐',
  },
  'Finance': {
    keywords: [
      'finance', 'payment', 'crypto', 'wallet', 'stock', 'trading',
      'invest', 'budget', 'accounting',
      '金融', '支付', '加密', '钱包', '股票', '理财', '记账',
      'bitcoin', 'ethereum', 'defi', 'nft',
    ],
    icon: '💰',
  },
  'Education': {
    keywords: [
      'learn', 'education', 'course', 'tutorial', 'teach', 'study',
      '学习', '教育', '课程', '教程', '培训', '知识',
    ],
    icon: '📚',
  },
  'Design': {
    keywords: [
      'design', 'ui', 'ux', 'figma', 'sketch', 'logo', 'icon',
      'font', 'color', 'template',
      '设计', 'ui', 'ux', '图标', '字体', '模板', '配色',
    ],
    icon: '🎨',
  },
};

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function detectLang(text) {
  if (!text) return 'en';
  return /[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en';
}

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

function getTags(project, translations) {
  const tags = new Set();
  const trans = translations[project.name] || {};

  const name = (trans.en_name || project.name || '');
  const desc = (trans.en_description || project.description || '');
  const combined = `${name} ${desc} ${project.name} ${project.description}`;
  const lowerCombined = combined.toLowerCase();

  for (const [category, config] of Object.entries(CATEGORIES)) {
    for (const keyword of config.keywords) {
      const kw = keyword.toLowerCase();

      // Chinese keywords: simple includes (Chinese has no word boundaries)
      if (isChinese(keyword)) {
        if (lowerCombined.includes(kw)) {
          tags.add(category);
          break;
        }
      } else {
        // English short keywords (<=4 chars): use word boundary to avoid false matches
        if (kw.length <= 4) {
          const regex = new RegExp(`(?<![a-z])${kw}(?![a-z])`, 'i');
          if (regex.test(combined)) {
            tags.add(category);
            break;
          }
        } else {
          // English long keywords: simple includes
          if (lowerCombined.includes(kw)) {
            tags.add(category);
            break;
          }
        }
      }
    }
  }

  return Array.from(tags);
}

function main() {
  console.log('=== Auto-Categorize Projects ===\n');

  const projects = loadJSON(PROJECTS_FILE);
  if (!projects || !projects.projects) {
    console.error('Error: Cannot read projects.json');
    process.exit(1);
  }

  // Try to load translations if available
  const translationsPath = path.join(ROOT, 'docs', 'data', 'translations.json');
  const translations = loadJSON(translationsPath) || {};
  const hasTranslations = Object.keys(translations).length > 0;

  console.log(`Projects: ${projects.projects.length}`);
  console.log(`Translations available: ${hasTranslations ? 'yes' : 'no (using Chinese only)'}\n`);

  let categorized = 0;
  let uncategorized = 0;

  for (const project of projects.projects) {
    const tags = getTags(project, translations);
    project.tags = tags;

    if (tags.length > 0) {
      categorized++;
    } else {
      uncategorized++;
      project.tags = ['Other'];
    }
  }

  saveJSON(PROJECTS_FILE, projects);

  console.log(`Results:`);
  console.log(`  Categorized: ${categorized}`);
  console.log(`  Uncategorized (tagged as "Other"): ${uncategorized}`);

  // Print category stats
  const stats = {};
  for (const project of projects.projects) {
    for (const tag of project.tags) {
      stats[tag] = (stats[tag] || 0) + 1;
    }
  }

  console.log(`\nCategory distribution:`);
  for (const [cat, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nSaved to: ${PROJECTS_FILE}`);
}

main();
