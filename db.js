const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./icecream.db');

// Create tables
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      total REAL,
      ticket TEXT
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      flavor TEXT,
      quantity INTEGER,
      price REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    )
  `);
});

module.exports = db;