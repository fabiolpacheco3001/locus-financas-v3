#!/usr/bin/env tsx
/**
 * i18n Audit Script
 * 
 * This script audits the i18n translation files and code usage.
 * It detects:
 * - Missing keys (used in code but not defined in JSONs)
 * - Orphan keys (defined in JSONs but not used in code)
 * - Inconsistencies between language files
 * 
 * Usage: npx tsx scripts/i18n-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.join(process.cwd(), 'src/i18n/locales');
const SRC_DIR = path.join(process.cwd(), 'src');
const LOCALE_FILES = ['pt-BR.json', 'en.json', 'es.json'] as const;

interface AuditResult {
  missingKeys: Record<string, string[]>; // key -> locales missing it
  orphanKeys: Record<string, string[]>; // key -> locales having it
  inconsistentKeys: Record<string, { present: string[]; missing: string[] }>;
  usedKeys: Set<string>;
  definedKeys: Record<string, Set<string>>;
}

// Flatten nested JSON object to dot notation keys
function flattenObject(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

// Extract all t() calls from TypeScript/TSX files
function extractKeysFromCode(dir: string): Set<string> {
  const keys = new Set<string>();
  
  function processFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Match t('key'), t("key"), t(`key`)
    const patterns = [
      /t\(\s*['"`]([^'"`]+)['"`]/g,
      /t\(\s*['"`]([^'"`]+)['"`]\s*,/g,
      /translateMessage\(\s*['"`]([^'"`]+)['"`]/g,
      /translateLocalizedMessage\(\s*\{\s*messageKey:\s*['"`]([^'"`]+)['"`]/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        keys.add(match[1]);
      }
    }
  }
  
  function walkDir(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        processFile(fullPath);
      }
    }
  }
  
  walkDir(dir);
  return keys;
}

// Load all locale files
function loadLocales(): Record<string, Record<string, string>> {
  const locales: Record<string, Record<string, string>> = {};
  
  for (const file of LOCALE_FILES) {
    const filePath = path.join(LOCALES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    const locale = file.replace('.json', '');
    locales[locale] = flattenObject(json);
  }
  
  return locales;
}

// Perform audit
function audit(): AuditResult {
  console.log('🔍 Starting i18n audit...\n');
  
  const usedKeys = extractKeysFromCode(SRC_DIR);
  const locales = loadLocales();
  
  console.log(`📊 Found ${usedKeys.size} translation keys in code`);
  
  const definedKeys: Record<string, Set<string>> = {};
  for (const [locale, keys] of Object.entries(locales)) {
    definedKeys[locale] = new Set(Object.keys(keys));
    console.log(`📊 Found ${definedKeys[locale].size} keys in ${locale}.json`);
  }
  
  // Get all unique keys across all locales
  const allDefinedKeys = new Set<string>();
  for (const keys of Object.values(definedKeys)) {
    for (const key of keys) {
      allDefinedKeys.add(key);
    }
  }
  
  // Find missing keys (used but not defined)
  const missingKeys: Record<string, string[]> = {};
  for (const key of usedKeys) {
    const missingIn: string[] = [];
    for (const [locale, keys] of Object.entries(definedKeys)) {
      if (!keys.has(key)) {
        missingIn.push(locale);
      }
    }
    if (missingIn.length > 0) {
      missingKeys[key] = missingIn;
    }
  }
  
  // Find orphan keys (defined but not used)
  const orphanKeys: Record<string, string[]> = {};
  for (const key of allDefinedKeys) {
    if (!usedKeys.has(key)) {
      const presentIn: string[] = [];
      for (const [locale, keys] of Object.entries(definedKeys)) {
        if (keys.has(key)) {
          presentIn.push(locale);
        }
      }
      orphanKeys[key] = presentIn;
    }
  }
  
  // Find inconsistent keys (defined in some locales but not others)
  const inconsistentKeys: Record<string, { present: string[]; missing: string[] }> = {};
  for (const key of allDefinedKeys) {
    const present: string[] = [];
    const missing: string[] = [];
    
    for (const locale of Object.keys(definedKeys)) {
      if (definedKeys[locale].has(key)) {
        present.push(locale);
      } else {
        missing.push(locale);
      }
    }
    
    if (missing.length > 0 && present.length > 0) {
      inconsistentKeys[key] = { present, missing };
    }
  }
  
  return {
    missingKeys,
    orphanKeys,
    inconsistentKeys,
    usedKeys,
    definedKeys,
  };
}

// Print audit results
function printResults(result: AuditResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 AUDIT RESULTS');
  console.log('='.repeat(60));
  
  // Missing keys
  const missingCount = Object.keys(result.missingKeys).length;
  if (missingCount > 0) {
    console.log(`\n❌ MISSING KEYS (${missingCount}):`);
    console.log('Keys used in code but missing in translation files:\n');
    for (const [key, locales] of Object.entries(result.missingKeys)) {
      console.log(`  "${key}" → missing in: ${locales.join(', ')}`);
    }
  } else {
    console.log('\n✅ No missing keys!');
  }
  
  // Inconsistent keys
  const inconsistentCount = Object.keys(result.inconsistentKeys).length;
  if (inconsistentCount > 0) {
    console.log(`\n⚠️  INCONSISTENT KEYS (${inconsistentCount}):`);
    console.log('Keys defined in some locales but not others:\n');
    for (const [key, { present, missing }] of Object.entries(result.inconsistentKeys)) {
      console.log(`  "${key}"`);
      console.log(`    ✓ Present in: ${present.join(', ')}`);
      console.log(`    ✗ Missing in: ${missing.join(', ')}`);
    }
  } else {
    console.log('\n✅ All keys are consistent across locales!');
  }
  
  // Orphan keys (optional warning)
  const orphanCount = Object.keys(result.orphanKeys).length;
  if (orphanCount > 0) {
    console.log(`\n💡 ORPHAN KEYS (${orphanCount}):`);
    console.log('Keys defined but not found in code (may be dynamic or obsolete):\n');
    const orphanList = Object.entries(result.orphanKeys).slice(0, 20);
    for (const [key, locales] of orphanList) {
      console.log(`  "${key}"`);
    }
    if (orphanCount > 20) {
      console.log(`  ... and ${orphanCount - 20} more`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Keys used in code: ${result.usedKeys.size}`);
  console.log(`  Missing keys: ${missingCount}`);
  console.log(`  Inconsistent keys: ${inconsistentCount}`);
  console.log(`  Orphan keys: ${orphanCount}`);
  console.log('');
  
  // Exit with error if there are missing or inconsistent keys
  if (missingCount > 0 || inconsistentCount > 0) {
    console.log('❌ Audit FAILED - Please fix the issues above\n');
    process.exit(1);
  } else {
    console.log('✅ Audit PASSED\n');
    process.exit(0);
  }
}

// Run audit
const result = audit();
printResults(result);
