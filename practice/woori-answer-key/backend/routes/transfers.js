'use strict';
// 이체 흐름: POST /check → (GET /check/:ticket) → POST /password → POST / → GET /:txId (완료)
const express = require('express');
const { check, getTicket, verifyPin, execute, getDone } = require('../transfer');

module.exports = function transfersRouter(db, hooks) {
  const router = express.Router();
  router.post('/check', (req, res) => res.json(check(db, req.body)));
  router.get('/check/:ticket', (req, res) => res.json(getTicket(db, req.params.ticket)));
  router.post('/password', (req, res) => res.json(verifyPin(db, req.body)));
  router.post('/', (req, res) => res.status(201).json(execute(db, req.body, hooks)));
  router.get('/:id', (req, res) => res.json(getDone(db, req.params.id)));
  return router;
};
