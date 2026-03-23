const fs = require('fs');

// Bump version in package.json
const pkg = JSON.parse(fs.readFileSync('package.json'));
const parts = pkg.version.split('.');
parts[2] = String(parseInt(parts[2]) + 1);
const newVersion = parts.join('.');
const oldVersion = pkg.version;
pkg.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// Bump versionCode and versionName in build.gradle
let gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const oldCode = gradle.match(/versionCode (\d+)/)[1];
const newCode = String(parseInt(oldCode) + 1);
gradle = gradle
  .replace(/versionCode \d+/, 'versionCode ' + newCode)
  .replace(/versionName "[^"]+"/, 'versionName "' + newVersion + '"');
fs.writeFileSync('android/app/build.gradle', gradle);

// Bump version display in client.html
let html = fs.readFileSync('docs/client.html', 'utf8');
html = html.split('v' + oldVersion).join('v' + newVersion);
fs.writeFileSync('docs/client.html', html);

const msg = 'Bump version to ' + newVersion;
console.log(msg);
fs.writeFileSync('.bump-version', msg);
