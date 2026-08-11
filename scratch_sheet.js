const https = require('https');
https.get('https://docs.google.com/spreadsheets/d/1YoZhdV7TOGwIiYtY9ioZpUWULdbA6kOdcXWea4O6yrc/edit?usp=sharing', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        // Look for sheet names in the bootstrap data
        const regex = /"name":"([^"]+)"/g;
        let match;
        const names = new Set();
        while ((match = regex.exec(data)) !== null) {
            names.add(match[1]);
        }
        console.log(Array.from(names));
    });
});
