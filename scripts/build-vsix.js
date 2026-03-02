#!/usr/bin/env node
const { execSync } = require('child_process');

const version = process.argv[2];

// Step 1: type-check, lint, and bundle for production
execSync('npm run package', { stdio: 'inherit' });

// Step 2: produce the .vsix file
const cmd = version ? `vsce package ${version}` : 'vsce package';
execSync(cmd, { stdio: 'inherit' });
