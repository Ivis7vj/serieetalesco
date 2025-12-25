const fs = require('fs');
const path = './src/pages/Profile.jsx';
if (!fs.existsSync(path)) {
    console.log('File not found:', path);
    process.exit(1);
}
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const line1339 = lines[1338];
console.log('Line 1339 Length:', line1339.length);
console.log('Char at 305:', line1339[304]);
console.log('Substring around 305:', line1339.substring(290, 320));
