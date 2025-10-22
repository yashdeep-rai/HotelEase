const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT customer_id AS customerId, first_name AS firstName, last_name AS lastName, email, phone FROM customer');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT customer_id AS customerId, first_name AS firstName, last_name AS lastName, email, phone FROM customer WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'Missing required fields' });
    const [result] = await pool.query('INSERT INTO customer (first_name, last_name, email, phone) VALUES (?, ?, ?, ?)', [firstName, lastName, email || null, phone || null]);
    res.status(201).json({ customerId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ error: 'Missing required fields' });
    const [result] = await pool.query('UPDATE customer SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE customer_id = ?', [firstName, lastName, email || null, phone || null, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Customer updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM customer WHERE customer_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
