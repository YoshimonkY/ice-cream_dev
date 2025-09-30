const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Route to save an order
app.post('/orders', (req, res) => {
    const { items, total, ticket } = req.body;
    const timestamp = new Date().toISOString();

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
});

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

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});