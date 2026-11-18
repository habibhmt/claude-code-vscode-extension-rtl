'use strict';

const fs = require('node:fs');
const path = require('node:path');

const catalog = path.join(__dirname, '..', 'claude-api', 'deepseek-models.json');

function modelChoices(rows = JSON.parse(fs.readFileSync(catalog, 'utf8'))) {
  if (!Array.isArray(rows) || rows.length === 0) throw Error('Invalid VS Code model catalog');
  const choices = rows.flatMap(row => {
    if (typeof row?.value !== 'string' || row.value.includes(':') || !row.displayName) {
      throw Error('Invalid VS Code model catalog');
    }
    if (row.value.startsWith('deepseek/')) {
      return [{ ...row, displayName: row.displayName + ' — OpenRouter API Key' }];
    }
    const { openRouterModel, ...model } = row;
    if (!/^claude-[a-z0-9-]+$/.test(model.value) || !/^anthropic\/claude-[a-z0-9.-]+$/.test(openRouterModel)) {
      throw Error('Invalid Claude account pair');
    }
    return [
      { ...model, value: openRouterModel, displayName: model.displayName + ' — OpenRouter API Key', description: 'Billed to OpenRouter.' },
      { ...model, value: 'anthropic-api/' + model.value, displayName: model.displayName + ' — Anthropic API Key', description: 'Billed to Anthropic Console.' },
    ];
  });
  if (new Set(choices.map(m => m.value)).size !== choices.length) throw Error('Duplicate VS Code model choice');
  return choices;
}

module.exports = { modelChoices };
