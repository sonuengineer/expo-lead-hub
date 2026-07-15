const sqlite3 = require('sqlite3').verbose();
function all(path, sql) {
  return new Promise((res, rej) => {
    const db = new sqlite3.Database(path, (err) => {
      if (err) return rej(err);
      db.all(sql, (e, rows) => { if (e) return rej(e); db.close(() => res(rows)); });
    });
  });
}
function run(path, sql) {
  return new Promise((res, rej) => {
    const db = new sqlite3.Database(path, (err) => {
      if (err) return rej(err);
      db.run(sql, function (e) { if (e) return rej(e); db.close(() => res(this.changes)); });
    });
  });
}
(async () => {
  for (const p of ['/app/data/openwa.sqlite', '/app/data/main.sqlite']) {
    try {
      const tables = await all(p, "SELECT name FROM sqlite_master WHERE type='table'");
      const names = tables.map((t) => t.name);
      console.log('TABLES(' + p + '):', names.join(', '));
      const kt = names.find((x) => /api_?key/i.test(x));
      if (kt) {
        const rows = await all(p, 'SELECT * FROM ' + kt);
        console.log('BEFORE ' + kt + ':', JSON.stringify(rows));
        const ch = await run(p, 'DELETE FROM ' + kt);
        console.log('DELETED rows:', ch);
      }
    } catch (e) { console.log('ERR(' + p + '):', e.message); }
  }
})();
