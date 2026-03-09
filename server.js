const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); 

const db = new sqlite3.Database('./aurora.db');

// Inicialización de Tablas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS productos(
        id INTEGER PRIMARY KEY,
        name TEXT,
        code TEXT UNIQUE,
        price REAL,
        qty INTEGER,
        image TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ventas(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT,
        total REAL,
        totalBs REAL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS detalle_ventas(
        venta_id INTEGER,
        producto_name TEXT,
        cantidad INTEGER,
        FOREIGN KEY(venta_id) REFERENCES ventas(id)
    )`);
});

// --- RUTAS ---

// 1. Obtener Todo (Dashboard e Inventario)
app.get('/api/datos', (req, res) => {
    db.all("SELECT * FROM productos", (err, productos) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT * FROM ventas ORDER BY id DESC", (err, ventas) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.all("SELECT * FROM detalle_ventas", (err, detalles) => {
                if (err) return res.status(500).json({ error: err.message });
                
                const sales = ventas.map(v => ({
                    ...v,
                    items: detalles.filter(d => d.venta_id === v.id).map(d => ({
                        name: d.producto_name,
                        cantidad: d.cantidad
                    }))
                }));
                res.json({ inventory: productos, sales: sales });
            });
        });
    });
});

// 2. Procesar Venta
app.post('/api/ventas', (req, res) => {
    const { items, totalUsd, totalBs } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: "No hay items" });

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        const stmtVenta = db.prepare("INSERT INTO ventas(fecha, total, totalBs) VALUES(?, ?, ?)");
        const fechaActual = new Date().toLocaleString();

        stmtVenta.run(fechaActual, totalUsd, totalBs, function(err) {
            if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: err.message });
            }

            const ventaId = this.lastID;
            const stmtUpdate = db.prepare("UPDATE productos SET qty = qty - ? WHERE id = ?");
            const stmtDetalle = db.prepare("INSERT INTO detalle_ventas(venta_id, producto_name, cantidad) VALUES(?, ?, ?)");

            try {
                items.forEach(item => {
                    stmtUpdate.run(item.cartQty, item.id);
                    stmtDetalle.run(ventaId, item.name, item.cartQty);
                });
                stmtUpdate.finalize();
                stmtDetalle.finalize();
                db.run("COMMIT");
                res.json({ success: true, id: ventaId });
            } catch (error) {
                db.run("ROLLBACK");
                res.status(500).json({ error: error.message });
            }
        });
        stmtVenta.finalize();
    });
});

// 3. CRUD Productos (Post, Put, Delete)
app.post('/api/productos', (req, res) => {
    const { id, name, code, price, qty, image } = req.body;
    db.run("INSERT INTO productos(id, name, code, price, qty, image) VALUES(?, ?, ?, ?, ?, ?)",
        [id, name, code, price, qty, image], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
});

app.put('/api/productos/:id', (req, res) => {
    const { qty } = req.body;
    db.run("UPDATE productos SET qty = ? WHERE id = ?", [qty, req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/productos/:id', (req, res) => {
    db.run("DELETE FROM productos WHERE id = ?", req.params.id, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));