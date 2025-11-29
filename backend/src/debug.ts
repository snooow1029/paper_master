/**
 * Debug utilities for troubleshooting Railway deployment issues
 */

import { AppDataSource } from './config/database';

export async function debugEnvironment() {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    env: {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      GROBID_URL: process.env.GROBID_URL || 'Not set',
      LLM_TYPE: process.env.LLM_TYPE || 'Not set',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
    },
    packages: {} as any,
    database: {} as any,
  };

  // Check critical packages
  const criticalPackages = ['pg', 'typeorm', 'express', 'axios'];
  for (const pkg of criticalPackages) {
    try {
      require.resolve(pkg);
      const pkgInfo = require(`${pkg}/package.json`);
      debugInfo.packages[pkg] = {
        installed: true,
        version: pkgInfo.version,
        path: require.resolve(pkg),
      };
    } catch (error) {
      debugInfo.packages[pkg] = {
        installed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check database connection
  try {
    debugInfo.database = {
      initialized: AppDataSource.isInitialized,
      options: AppDataSource.options.type,
    };
    if (AppDataSource.isInitialized) {
      debugInfo.database.connected = true;
    }
  } catch (error) {
    debugInfo.database = {
      initialized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return debugInfo;
}

export function logStartupInfo() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DEBUG INFORMATION');
  console.log('='.repeat(80));
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Port: ${process.env.PORT || 'Not set'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
  console.log(`GROBID_URL: ${process.env.GROBID_URL || 'Not set'}`);
  console.log(`LLM_TYPE: ${process.env.LLM_TYPE || 'Not set'}`);
  
  // Check packages
  console.log('\n📦 Package Status:');
  const packages = ['pg', 'typeorm', 'express', 'axios'];
  const fs = require('fs');
  const path = require('path');
  
  packages.forEach(pkg => {
    try {
      // First check if package can be resolved
      const pkgPath = require.resolve(pkg);
      // Then try to read package.json from node_modules
      const pkgJsonPath = path.join(path.dirname(pkgPath), '..', 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgInfo = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        console.log(`  ✅ ${pkg}: ${pkgInfo.version}`);
      } else {
        // Fallback: try to find package.json in node_modules
        const nodeModulesPath = path.join(process.cwd(), 'node_modules', pkg, 'package.json');
        if (fs.existsSync(nodeModulesPath)) {
          const pkgInfo = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf8'));
          console.log(`  ✅ ${pkg}: ${pkgInfo.version}`);
        } else {
          console.log(`  ✅ ${pkg}: INSTALLED (version unknown)`);
        }
      }
    } catch (error) {
      console.log(`  ❌ ${pkg}: NOT FOUND`);
    }
  });

  // Check node_modules location
  try {
    const pgPath = require.resolve('pg');
    console.log(`\n📁 pg package location: ${pgPath}`);
  } catch (error) {
    console.log(`\n❌ pg package NOT FOUND in node_modules`);
  }

  console.log('='.repeat(80) + '\n');
}

