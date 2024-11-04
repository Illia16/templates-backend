const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, 'dist');
const SRC_DIR = __dirname;

const prepareDistFolder = () => {
  if (fs.existsSync(DIST_DIR)) {
    fs.rmdirSync(DIST_DIR, { recursive: true });
  }
  fs.mkdirSync(DIST_DIR);

  const filesToCopy = ['index.html', 'config.js'];
  filesToCopy.forEach(file => {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(DIST_DIR, file));
  });

  // Copy the scripts folder
  const srcScriptsDir = path.join(SRC_DIR, 'scripts');
  const destScriptsDir = path.join(DIST_DIR, 'scripts');

  if (fs.existsSync(srcScriptsDir)) {
    fs.mkdirSync(destScriptsDir);
    execSync(`cp -r ${srcScriptsDir}/* ${destScriptsDir}`);
  }

  console.log('Files and folders copied to dist directory successfully.');
};

prepareDistFolder();
