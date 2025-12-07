#!/usr/bin/env node

/**
 * Check if required dependencies are installed
 * This script is run during Railway deployment to ensure pg is installed
 */

const fs = require('fs');
const path = require('path');

const requiredPackages = ['pg', 'typeorm', 'express'];

console.log('🔍 Checking required dependencies...');

let allInstalled = true;

requiredPackages.forEach(pkg => {
  const packagePath = path.join(__dirname, '..', 'node_modules', pkg);
  if (fs.existsSync(packagePath)) {
    console.log(`✅ ${pkg} is installed`);
  } else {
    console.error(`❌ ${pkg} is NOT installed`);
    allInstalled = false;
  }
});

if (!allInstalled) {
  console.error('\n⚠️  Some required packages are missing!');
  console.error('Running: npm install');
  process.exit(1);
} else {
  console.log('\n✅ All required dependencies are installed');
  process.exit(0);
}

