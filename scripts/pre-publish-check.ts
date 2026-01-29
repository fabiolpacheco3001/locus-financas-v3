#!/usr/bin/env tsx
/**
 * Pre-Publish i18n Verification Script
 * 
 * This script runs all i18n checks before allowing publication.
 * All checks must pass for the publication to proceed.
 * 
 * Usage: npx tsx scripts/pre-publish-check.ts
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  details?: string[];
}

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = COLORS.reset): void {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logHeader(message: string): void {
  console.log('\n' + '='.repeat(60));
  log(message, COLORS.bold + COLORS.blue);
  console.log('='.repeat(60));
}

function logResult(result: CheckResult): void {
  const icon = result.passed ? '✅' : '❌';
  const color = result.passed ? COLORS.green : COLORS.red;
  log(`${icon} ${result.name}: ${result.message}`, color);
  
  if (result.details && result.details.length > 0) {
    result.details.forEach(detail => {
      console.log(`   ${detail}`);
    });
  }
}

async function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on('error', (err) => {
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}

async function checkI18nAudit(): Promise<CheckResult> {
  log('\n📋 Running i18n audit...', COLORS.yellow);
  
  try {
    const result = await runCommand('npx', ['tsx', 'scripts/i18n-audit.ts']);
    
    // Check for missing or inconsistent keys in output
    const hasMissingKeys = result.stdout.includes('Missing keys') || 
                           result.stdout.includes('Inconsistent keys');
    const hasOrphanKeys = result.stdout.includes('Orphan keys');
    
    if (result.exitCode !== 0 || hasMissingKeys) {
      return {
        name: 'i18n Audit',
        passed: false,
        message: 'Missing or inconsistent translation keys found',
        details: result.stdout.split('\n').filter(line => 
          line.includes('Missing') || 
          line.includes('Inconsistent') ||
          line.includes('  - ')
        ).slice(0, 10),
      };
    }
    
    return {
      name: 'i18n Audit',
      passed: true,
      message: 'All translation keys are valid and consistent',
    };
  } catch (error) {
    return {
      name: 'i18n Audit',
      passed: false,
      message: `Failed to run audit: ${error}`,
    };
  }
}

async function checkHardcodedStrings(): Promise<CheckResult> {
  log('\n🔍 Checking for hardcoded strings...', COLORS.yellow);
  
  try {
    const result = await runCommand('npx', ['tsx', 'scripts/check-hardcoded-strings.ts']);
    
    // Parse the output to count issues
    const issueMatch = result.stdout.match(/Found (\d+) potential hardcoded strings/);
    const issueCount = issueMatch ? parseInt(issueMatch[1], 10) : 0;
    
    if (issueCount > 0) {
      // Extract file locations
      const fileMatches = result.stdout.match(/📄 [^\n]+/g) || [];
      
      return {
        name: 'Hardcoded Strings Check',
        passed: false,
        message: `Found ${issueCount} potential hardcoded strings`,
        details: fileMatches.slice(0, 5),
      };
    }
    
    return {
      name: 'Hardcoded Strings Check',
      passed: true,
      message: 'No hardcoded strings detected',
    };
  } catch (error) {
    return {
      name: 'Hardcoded Strings Check',
      passed: false,
      message: `Failed to run check: ${error}`,
    };
  }
}

async function checkE2ETests(): Promise<CheckResult> {
  log('\n🧪 Running i18n E2E tests...', COLORS.yellow);
  
  try {
    // Check if playwright is configured
    const playwrightConfig = path.join(process.cwd(), 'playwright.config.ts');
    if (!fs.existsSync(playwrightConfig)) {
      return {
        name: 'E2E i18n Tests',
        passed: false,
        message: 'Playwright config not found',
      };
    }
    
    // Run only the forms i18n regression tests
    const result = await runCommand('npx', [
      'playwright', 'test', 
      'tests/e2e/formsI18nRegression.spec.ts',
      '--reporter=line'
    ]);
    
    if (result.exitCode !== 0) {
      // Extract failure summary
      const failedTests = result.stdout.match(/\d+ failed/)?.[0] || 'Tests failed';
      
      return {
        name: 'E2E i18n Tests',
        passed: false,
        message: failedTests,
        details: result.stdout.split('\n')
          .filter(line => line.includes('Error:') || line.includes('expect'))
          .slice(0, 5),
      };
    }
    
    return {
      name: 'E2E i18n Tests',
      passed: true,
      message: 'All i18n regression tests passed',
    };
  } catch (error) {
    return {
      name: 'E2E i18n Tests',
      passed: false,
      message: `Failed to run tests: ${error}`,
    };
  }
}

function checkDOMForKeys(): CheckResult {
  log('\n🔎 Checking for translation key patterns...', COLORS.yellow);
  
  // This is a static check - we scan source files for potential issues
  const srcDir = path.join(process.cwd(), 'src');
  const issues: string[] = [];
  
  // Pattern that matches translation keys being rendered directly
  // e.g., {keyName} where keyName looks like 'namespace.key'
  const keyPattern = />\s*\{['"`]([a-z]+\.[a-z]+(?:\.[a-z]+)*)['"`]\s*\}/gi;
  
  // Also check for string interpolation that might expose keys
  const templatePattern = /\$\{['"`]([a-z]+\.[a-z]+(?:\.[a-z]+)*)['"`]\}/gi;
  
  function scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', '.git', 'i18n'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          // Skip comments and imports
          if (line.trim().startsWith('//') || line.includes('import ')) return;
          
          // Check for direct key rendering (not in t() call)
          if (keyPattern.test(line) && !line.includes('t(') && !line.includes('t`')) {
            issues.push(`${path.relative(process.cwd(), fullPath)}:${index + 1}`);
          }
          keyPattern.lastIndex = 0;
          
          if (templatePattern.test(line)) {
            issues.push(`${path.relative(process.cwd(), fullPath)}:${index + 1} (template)`);
          }
          templatePattern.lastIndex = 0;
        });
      }
    }
  }
  
  try {
    scanDirectory(srcDir);
    
    if (issues.length > 0) {
      return {
        name: 'DOM Key Visibility Check',
        passed: false,
        message: `Found ${issues.length} potential exposed keys`,
        details: issues.slice(0, 10),
      };
    }
    
    return {
      name: 'DOM Key Visibility Check',
      passed: true,
      message: 'No exposed translation keys detected in source',
    };
  } catch (error) {
    return {
      name: 'DOM Key Visibility Check',
      passed: false,
      message: `Failed to scan: ${error}`,
    };
  }
}

async function checkTranslationKeyParity(): Promise<CheckResult> {
  log('\n📊 Checking translation key parity across locales...', COLORS.yellow);
  
  const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
  const locales = ['pt-BR.json', 'en.json', 'es.json'];
  
  try {
    const keySets: Map<string, Set<string>> = new Map();
    
    for (const locale of locales) {
      const filePath = path.join(localesDir, locale);
      if (!fs.existsSync(filePath)) {
        return {
          name: 'Translation Key Parity',
          passed: false,
          message: `Missing locale file: ${locale}`,
        };
      }
      
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const keys = flattenKeys(content);
      keySets.set(locale, new Set(keys));
    }
    
    // Compare all locales against pt-BR (source of truth)
    const ptBRKeys = keySets.get('pt-BR.json')!;
    const missingKeys: string[] = [];
    
    for (const [locale, keys] of keySets) {
      if (locale === 'pt-BR.json') continue;
      
      for (const key of ptBRKeys) {
        if (!keys.has(key)) {
          missingKeys.push(`${locale}: ${key}`);
        }
      }
    }
    
    if (missingKeys.length > 0) {
      return {
        name: 'Translation Key Parity',
        passed: false,
        message: `${missingKeys.length} keys missing in some locales`,
        details: missingKeys.slice(0, 10),
      };
    }
    
    return {
      name: 'Translation Key Parity',
      passed: true,
      message: 'All locales have consistent keys',
    };
  } catch (error) {
    return {
      name: 'Translation Key Parity',
      passed: false,
      message: `Failed to check parity: ${error}`,
    };
  }
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}

async function main(): Promise<void> {
  logHeader('🚀 Pre-Publish i18n Verification');
  log('\nRunning all i18n checks before publication...\n', COLORS.yellow);
  
  const startTime = Date.now();
  const results: CheckResult[] = [];
  
  // Run checks sequentially for cleaner output
  results.push(await checkI18nAudit());
  results.push(await checkHardcodedStrings());
  results.push(checkDOMForKeys());
  results.push(await checkTranslationKeyParity());
  
  // E2E tests are optional - only run if explicitly requested
  const runE2E = process.argv.includes('--e2e');
  if (runE2E) {
    results.push(await checkE2ETests());
  }
  
  // Print summary
  logHeader('📊 Verification Summary');
  
  results.forEach(logResult);
  
  const failedChecks = results.filter(r => !r.passed);
  const passedChecks = results.filter(r => r.passed);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '-'.repeat(60));
  log(`⏱️  Duration: ${duration}s`, COLORS.blue);
  log(`✅ Passed: ${passedChecks.length}`, COLORS.green);
  
  if (failedChecks.length > 0) {
    log(`❌ Failed: ${failedChecks.length}`, COLORS.red);
    
    console.log('\n' + '='.repeat(60));
    log('🚫 PUBLICATION BLOCKED', COLORS.bold + COLORS.red);
    console.log('='.repeat(60));
    log('\nThe following checks must pass before publishing:\n', COLORS.yellow);
    
    failedChecks.forEach((check, index) => {
      log(`${index + 1}. ${check.name}: ${check.message}`, COLORS.red);
    });
    
    log('\n📝 How to fix:', COLORS.blue);
    log('1. Run: npx tsx scripts/i18n-audit.ts', COLORS.reset);
    log('2. Run: npx tsx scripts/check-hardcoded-strings.ts', COLORS.reset);
    log('3. Add missing translations to locale files', COLORS.reset);
    log('4. Use t() for all user-facing strings', COLORS.reset);
    
    if (!runE2E) {
      log('\n💡 Tip: Add --e2e flag to also run E2E tests', COLORS.yellow);
    }
    
    process.exit(1);
  } else {
    console.log('\n' + '='.repeat(60));
    log('✅ ALL CHECKS PASSED - Ready to publish!', COLORS.bold + COLORS.green);
    console.log('='.repeat(60));
    
    process.exit(0);
  }
}

main().catch((error) => {
  log(`\n❌ Unexpected error: ${error}`, COLORS.red);
  process.exit(1);
});
