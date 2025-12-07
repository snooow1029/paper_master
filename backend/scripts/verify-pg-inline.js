#!/usr/bin/env node

/**
 * Inline version of pg verification - this is a backup
 * The main verification is now done inline in package.json prestart script
 */

try {
  require('pg');
  console.log('✅ pg package is installed');
  process.exit(0);
} catch (error) {
  console.error('❌ pg package not found, installing...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install pg@^8.16.3 --save', { stdio: 'inherit' });
    console.log('✅ pg package installed successfully');
    process.exit(0);
  } catch (installError) {
    console.error('❌ Failed to install pg package:', installError);
    process.exit(1);
  }
}




