const fs = require('fs');
const path = require('path');

const walk = function (dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.json') || file.endsWith('.md') || file.endsWith('.html')) {
                        results.push(file);
                    }
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

const dirs = [
    'E:\\\\theJoker\\\\vibe-coding-ide\\\\src',
    'E:\\\\theJoker\\\\vibe-coding-ide\\\\electron'
];

let filesToProcess = [
    'E:\\\\theJoker\\\\vibe-coding-ide\\\\package.json',
    'E:\\\\theJoker\\\\vibe-coding-ide\\\\README.md',
    'E:\\\\theJoker\\\\vibe-coding-ide\\\\index.html'
];

let pendingDirs = dirs.length;

dirs.forEach(d => {
    walk(d, (err, list) => {
        if (list) {
            filesToProcess.push(...list);
        }
        pendingDirs--;
        if (pendingDirs === 0) {
            processFiles();
        }
    });
});

function processFiles() {
    filesToProcess.forEach(f => {
        try {
            let content = fs.readFileSync(f, 'utf8');
            if (content.includes('Vibe Coding IDE')) {
                content = content.replace(/The Joker - Vibe Coding IDE/g, 'The Joker - ENDj0K3R');
                content = content.replace(/The Joker — Vibe Coding IDE/g, 'The Joker — ENDj0K3R');
                content = content.replace(/Vibe Coding IDE/g, 'ENDj0K3R');
                fs.writeFileSync(f, content, 'utf8');
                console.log('Updated', f);
            }
        } catch (e) {
            console.error('Error processing', f, e);
        }
    });
}
