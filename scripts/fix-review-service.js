// Quick fix script to add userName and photoURL to getSeriesReviews
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../client/src/utils/reviewService.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix first occurrence (episode reviews in getSeriesReviews - around line 289)
content = content.replace(
    /(\.\.\.\(episodeReviews\.data \|\| \[\]\)\.map\(r => \({\s+\.\.\.r,\s+id: r\.id,\s+userId: r\.user_id,)(\s+tmdbId:)/,
    '$1\n                userName: r.user_name || \'User\',\n                photoURL: r.photo_url,$2'
);

// Fix second occurrence (season reviews in getSeriesReviews - around line 302)
content = content.replace(
    /(\.\.\.\(seasonReviews\.data \|\| \[\]\)\.map\(r => \({\s+\.\.\.r,\s+id: r\.id,\s+userId: r\.user_id,)(\s+tmdbId:)/,
    '$1\n                userName: r.user_name || \'User\',\n                photoURL: r.photo_url,$2'
);

// Fix third and fourth occurrences (getUserReviews function - around lines 365 and 374)
let count = 0;
content = content.replace(
    /(userId: r\.user_id,)(\s+tmdbId: r\.tmdb_id,)/g,
    (match, p1, p2) => {
        count++;
        // Only replace in getUserReviews (occurrences 3 and 4, skip first 2 which are already handled)
        if (count > 2) {
            return `${p1}\n                userName: r.user_name || 'User',\n                photoURL: r.photo_url,${p2}`;
        }
        return match;
    }
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed reviewService.js - added userName and photoURL fields');
