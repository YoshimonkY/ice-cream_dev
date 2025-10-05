const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Route to save an order (legacy support)
app.post('/orders', (req, res) => {
    const { items, total, ticket, cups, customerName, storeId } = req.body;
    const timestamp = new Date().toISOString();

    // Support both old format (items array) and new format (cups array)
    if (cups && cups.length > 0) {
        // New cup-based order format
        saveCupOrder(req, res, timestamp);
    } else {
        // Legacy format for backward compatibility
        saveLegacyOrder(req, res, timestamp);
    }
});

// Save new cup-based order (legacy format for now)
function saveCupOrder(req, res, timestamp) {
    const { cups, total, ticket, customerName, storeId } = req.body;

    // For now, save as legacy format - convert cups to items array
    const items = [];
    cups.forEach(cup => {
        Object.values(cup.items).forEach(item => {
            items.push(item);
        });
    });

    db.run(
        'INSERT INTO orders (timestamp, total, ticket) VALUES (?, ?, ?)',
        [timestamp, total, ticket],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const orderId = this.lastID;
            const stmt = db.prepare('INSERT INTO order_items (order_id, flavor, quantity, price) VALUES (?, ?, ?, ?)');

            items.forEach(item => {
                stmt.run([orderId, item.flavor, item.quantity, item.price]);
            });

            stmt.finalize();
            res.json({ id: orderId, message: 'Cup order saved successfully' });
        }
    );
}

// Save legacy order format
function saveLegacyOrder(req, res, timestamp) {
    const { items, total, ticket } = req.body;

    db.run(
        'INSERT INTO orders (timestamp, total, ticket) VALUES (?, ?, ?)',
        [timestamp, total, ticket],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const orderId = this.lastID;
            const stmt = db.prepare('INSERT INTO order_items (order_id, flavor, quantity, price) VALUES (?, ?, ?, ?)');

            items.forEach(item => {
                stmt.run([orderId, item.flavor, item.quantity, item.price]);
            });

            stmt.finalize();
            res.json({ id: orderId, message: 'Order saved successfully' });
        }
    );
}


// Route to get orders with customizable limit and order
app.get('/orders', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const orderDirection = req.query.order === 'ASC' ? 'ASC' : 'DESC';

    const query = `
    SELECT o.id, o.timestamp, o.total, o.ticket, oi.flavor, oi.quantity, oi.price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ORDER BY o.id ${orderDirection}
    LIMIT ?
  `;

    db.all(query, [limit], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Group by order ID
        const orders = {};
        rows.forEach(row => {
            if (!orders[row.id]) {
                orders[row.id] = {
                    id: row.id,
                    timestamp: row.timestamp,
                    total: row.total,
                    ticket: row.ticket,
                    items: []
                };
            }
            if (row.flavor) {
                orders[row.id].items.push({
                    flavor: row.flavor,
                    quantity: row.quantity,
                    price: row.price
                });
            }
        });

        res.json(Object.values(orders));
    });
});

// Route to get all orders (no limit)
app.get('/all-orders', (req, res) => {
    const query = `
    SELECT o.id, o.timestamp, o.total, oi.flavor, oi.quantity, oi.price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ORDER BY o.id DESC
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Group by order ID
        const orders = {};
        rows.forEach(row => {
            if (!orders[row.id]) {
                orders[row.id] = {
                    id: row.id,
                    timestamp: row.timestamp,
                    total: row.total,
                    items: []
                };
            }
            if (row.flavor) {
                orders[row.id].items.push({
                    flavor: row.flavor,
                    quantity: row.quantity,
                    price: row.price
                });
            }
        });

        res.json(Object.values(orders));
    });
});

// Inventory Management Routes

// Get all flavors
app.get('/flavors', (req, res) => {
    db.all('SELECT * FROM flavors ORDER BY name', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Add new flavor
app.post('/flavors', (req, res) => {
    const { name, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({ error: 'Name and price are required' });
    }

    db.run(
        'INSERT INTO flavors (name, price) VALUES (?, ?)',
        [name, price],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Flavor added successfully' });
        }
    );
});

// Update flavor (price and/or active status)
app.put('/flavors/:id', (req, res) => {
    const { id } = req.params;
    const { price, active } = req.body;

    if (price === undefined && active === undefined) {
        return res.status(400).json({ error: 'Price or active status is required' });
    }

    let query = 'UPDATE flavors SET ';
    let params = [];
    let updates = [];

    if (price !== undefined) {
        updates.push('price = ?');
        params.push(price);
    }

    if (active !== undefined) {
        updates.push('active = ?');
        params.push(active);
    }

    query += updates.join(', ') + ' WHERE id = ?';
    params.push(id);

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Flavor not found' });
        }
        res.json({ message: 'Flavor updated successfully' });
    });
});

// Delete flavor
app.delete('/flavors/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM flavors WHERE id = ?', [id], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Flavor not found' });
        }
        res.json({ message: 'Flavor deleted successfully' });
    });
});

// Store-specific flavor management

// Get flavors for a specific store
app.get('/store-flavors/:store', (req, res) => {
    const { store } = req.params;

    // Special handling for puesto2 - if it's a new request and no entries exist,
    // copy the flavor settings from puesto
    if (store === 'puesto2') {
        db.all('SELECT * FROM store_flavors WHERE store_name = ?', ['puesto2'], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // If no entries exist for puesto2, copy from puesto
            if (rows.length === 0) {
                db.all('SELECT * FROM store_flavors WHERE store_name = ?', ['puesto'], (err, puestoRows) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // If puesto has entries, copy them for puesto2
                    if (puestoRows.length > 0) {
                        const stmt = db.prepare('INSERT INTO store_flavors (store_name, flavor_id, active) VALUES (?, ?, ?)');

                        puestoRows.forEach(row => {
                            stmt.run(['puesto2', row.flavor_id, row.active]);
                        });

                        stmt.finalize((err) => {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }

                            // Now get the flavors for puesto2
                            getFlavorsForStore('puesto2', res);
                        });
                    } else {
                        // If puesto has no entries either, just return all flavors
                        getFlavorsForStore('puesto2', res);
                    }
                });
            } else {
                // puesto2 already has entries, get them normally
                getFlavorsForStore('puesto2', res);
            }
        });
    } else {
        // For all other stores, process normally
        getFlavorsForStore(store, res);
    }
});

// Helper function to get flavors for a store
function getFlavorsForStore(store, res) {
    const query = `
        SELECT f.*, sf.active as store_active
        FROM flavors f
        LEFT JOIN store_flavors sf ON f.id = sf.flavor_id AND sf.store_name = ?
        ORDER BY f.name
    `;

    db.all(query, [store], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
}

// Update store flavor assignments
app.post('/store-flavors/:store', (req, res) => {
    const { store } = req.params;
    const { flavorAssignments } = req.body; // Array of {flavorId, active}

    if (!Array.isArray(flavorAssignments)) {
        return res.status(400).json({ error: 'flavorAssignments must be an array' });
    }

    // Start transaction
    db.serialize(() => {
        db.run('BEGIN');

        // First, deactivate all flavors for this store
        db.run('DELETE FROM store_flavors WHERE store_name = ?', [store], (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            // Insert active assignments
            if (flavorAssignments.length > 0) {
                const stmt = db.prepare(`
                    INSERT INTO store_flavors (store_name, flavor_id, active)
                    VALUES (?, ?, ?)
                `);

                flavorAssignments.forEach(assignment => {
                    if (assignment.active) {
                        stmt.run([store, assignment.flavorId, 1]);
                    }
                });

                stmt.finalize((err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    db.run('COMMIT');
                    res.json({ message: 'Store flavors updated successfully' });
                });
            } else {
                db.run('COMMIT');
                res.json({ message: 'Store flavors updated successfully' });
            }
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});