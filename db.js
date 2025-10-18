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

  db.run(`
  CREATE TABLE IF NOT EXISTS flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    price REAL NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

  db.run(`
  CREATE TABLE IF NOT EXISTS store_flavors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_name TEXT NOT NULL,
    flavor_id INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(flavor_id) REFERENCES flavors(id),
    UNIQUE(store_name, flavor_id)
  )
`);

  // Insert default flavors if they don't exist
  const defaultFlavors = [
    'Limón', 'Mango', 'Fresa', 'Fresa mora', 'Guanábana', 'Guayaba',
    'Maracuyá', 'Tuna', 'Sandía', 'Melón', 'Nanche', 'Tinto',
    'Jugo verde', 'Mandarina', 'Pitaya', 'Pitahaya', 'Tamarindo',
    'Piña', 'Acai Asai', 'Zapote', 'Gazpacho', 'Frambuesa',
    'Frutos rojos', 'Tequila limón', 'Mezcal higo', 'Queso',
    'Taro', 'Mamey', 'Coco', 'Pistache', 'Piñón', 'Choco Menta',
    'Chocolate (amaranto-cereza envinada)', 'Vainilla', 'Oreo',
    'Malvavisco', 'Cajeta', 'Fresas con crema', 'Café',
    'Pay de limón', 'Matcha', 'Mouse de Naranja', 'Arroz con leche',
    'Mazapán', 'Cereza', 'Frambuesa yoghurt', 'Rompope'
  ];

  defaultFlavors.forEach(flavor => {
    db.run(`
        INSERT OR IGNORE INTO flavors (name, price)
        VALUES (?, 12.00)
      `, [flavor]);
  });
});

module.exports = db;