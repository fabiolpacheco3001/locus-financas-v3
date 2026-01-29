#!/usr/bin/env tsx
/**
 * Hardcoded String Detection Script
 * 
 * This script detects potential hardcoded strings in UI components.
 * It helps ensure all user-facing text uses the i18n translation system.
 * 
 * Usage: npx tsx scripts/check-hardcoded-strings.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');

interface Issue {
  file: string;
  line: number;
  text: string;
  context: string;
}

// Patterns that are allowed (not hardcoded strings)
const ALLOWED_PATTERNS = [
  // Technical/code-related
  /^[A-Z_]+$/, // Constants like "INCOME", "EXPENSE"
  /^[a-z-]+$/, // CSS classes, IDs
  /^\d+$/, // Numbers
  /^#[0-9a-fA-F]+$/, // Hex colors
  /^https?:\/\//, // URLs
  /^\/[a-z-/]*$/, // Routes/paths
  /^@\//,  // Import aliases
  /^[a-z]+\.[a-z]+/i, // Translation keys like "common.save"
  /^\{\{.*\}\}$/, // Interpolation placeholders
  /^[<>+\-*/=!&|?:;,.()\[\]{}]+$/, // Operators and punctuation
  /^\s*$/, // Whitespace only
  /^\.+$/, // Just dots
  /^R\$/, // Currency symbols
  /^\$/, // Currency symbols
  /^€/, // Currency symbols
  /^%$/, // Percent symbol
];

// File patterns to skip
const SKIP_FILES = [
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
  /node_modules/,
  /dist/,
  /\.json$/,
  /index\.ts$/,
  /types\.ts$/,
  /client\.ts$/,
  /config/,
  /i18n\//,
];

// Component patterns that typically contain user data (not hardcoded)
const DYNAMIC_DATA_PATTERNS = [
  /\{[^}]*\.[^}]*\}/, // Object property access like {user.name}
  /\$\{.*\}/, // Template literals
];

function isAllowedText(text: string): boolean {
  // Check against allowed patterns
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Check if it's very short (likely an icon or symbol)
  if (text.length <= 2) {
    return true;
  }
  
  // Check if it looks like a translation call
  if (text.includes('t(') || text.includes('t`')) {
    return true;
  }
  
  return false;
}

function checkFile(filePath: string): Issue[] {
  const issues: Issue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Check if file should be skipped
  for (const pattern of SKIP_FILES) {
    if (pattern.test(filePath)) {
      return issues;
    }
  }
  
  // Only check TSX files (UI components)
  if (!filePath.endsWith('.tsx')) {
    return issues;
  }
  
  // Pattern to match JSX text content
  // Matches: >Text<, >Text</tag, or standalone text in JSX
  const jsxTextPattern = />([^<>{}\n]+)</g;
  
  // Pattern to match string literals in attributes
  const attrStringPattern = /(?:label|title|placeholder|alt|aria-label)=["']([^"']+)["']/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
      continue;
    }
    
    // Check JSX text content
    let match;
    while ((match = jsxTextPattern.exec(line)) !== null) {
      const text = match[1].trim();
      
      if (text && !isAllowedText(text)) {
        // Check if it's dynamic data
        let isDynamic = false;
        for (const pattern of DYNAMIC_DATA_PATTERNS) {
          if (pattern.test(match[0])) {
            isDynamic = true;
            break;
          }
        }
        
        if (!isDynamic && /[a-zA-Z]{3,}/.test(text)) {
          issues.push({
            file: filePath,
            line: lineNumber,
            text: text.substring(0, 50),
            context: line.trim().substring(0, 80),
          });
        }
      }
    }
    
    // Check string literals in specific attributes
    while ((match = attrStringPattern.exec(line)) !== null) {
      const text = match[1].trim();
      
      if (text && !isAllowedText(text) && /[a-zA-Z]{3,}/.test(text)) {
        // Skip if it's inside a t() call
        if (!line.includes(`t('`) && !line.includes(`t("`)) {
          issues.push({
            file: filePath,
            line: lineNumber,
            text: text.substring(0, 50),
            context: line.trim().substring(0, 80),
          });
        }
      }
    }
  }
  
  return issues;
}

function walkDir(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
        files.push(...walkDir(fullPath));
      }
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function main() {
  console.log('🔍 Scanning for hardcoded strings...\n');
  
  const files = walkDir(SRC_DIR);
  let allIssues: Issue[] = [];
  
  for (const file of files) {
    const issues = checkFile(file);
    allIssues = allIssues.concat(issues);
  }
  
  if (allIssues.length > 0) {
    console.log(`⚠️  Found ${allIssues.length} potential hardcoded strings:\n`);
    
    // Group by file
    const byFile = new Map<string, Issue[]>();
    for (const issue of allIssues) {
      const relativePath = path.relative(process.cwd(), issue.file);
      if (!byFile.has(relativePath)) {
        byFile.set(relativePath, []);
      }
      byFile.get(relativePath)!.push(issue);
    }
    
    for (const [file, issues] of byFile) {
      console.log(`📄 ${file}`);
      for (const issue of issues) {
        console.log(`   Line ${issue.line}: "${issue.text}"`);
        console.log(`   Context: ${issue.context}`);
        console.log('');
      }
    }
    
    console.log('='.repeat(60));
    console.log(`\n⚠️  ${allIssues.length} potential issues found.`);
    console.log('Review each case - some may be false positives (user data, technical terms).\n');
    
    // Exit with warning (not error) as manual review is needed
    process.exit(0);
  } else {
    console.log('✅ No hardcoded strings detected!\n');
    process.exit(0);
  }
}

main();
