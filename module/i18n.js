const fs = require('fs');
const path = require('path');
const config = require('../config/config.json');

const defaultLang = config.language || 'en';
const fallbackLang = 'en';

const cache = new Map();

function loadLanguage(lang) {
  if (cache.has(lang)) {
    return cache.get(lang);
  }

  const filePath = path.join(__dirname, '..', 'locale', `${lang}.json`);
  let data = {};

  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  cache.set(lang, data);
  return data;
}

function interpolate(template, vars) {
  if (!vars) {
    return template;
  }

  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return '';
  });
}

function getValue(obj, keyPath) {
  if (!obj || !keyPath) {
    return undefined;
  }

  return keyPath.split('.').reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, obj);
}

function __(key, vars) {
  const langData = loadLanguage(defaultLang);
  const fallbackData = defaultLang === fallbackLang ? {} : loadLanguage(fallbackLang);
  const template = getValue(langData, key) || getValue(fallbackData, key) || key;
  return interpolate(template, vars);
}

module.exports = {
  __,
};
