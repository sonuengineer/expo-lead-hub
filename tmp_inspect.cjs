const D = require('better-sqlite3');
function dump(path) {
  try {
    const db = new D(path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    console.log('TABLES(' + path + '):', tables.join(', '));
    const kt = tables.find(x => /api_?key/i.test(x));
    if (kt) {
      console.log('KEY TABLE:', kt);
      console.log(JSON.stringify(db.prepare('SELECT * FROM ' + kt).all(), null, 2));
    }
  } catch (e) {
    console.log('ERR(' + path + '):', e.message);
  }
}
dump('/app/data/openwa.sqlite');
dump('/app/data/main.sqlite');
