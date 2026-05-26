const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// Get portfolio overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    const user = await User.query().findById(req.user.id);
    const trades = await Trade.query().where('userId', req.user.id);
    
    const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const winTrades = trades.filter(t => t.profit > 0).length;
    const lossTrades = trades.filter(t => t.profit < 0).length;
    const winRate = trades.length > 0 ? (winTrades / trades.length * 100).toFixed(2) : 0;
    
    res.json({
      accountBalance: user.accountBalance,
      totalProfit,
      winRate,
      winTrades,
      lossTrades,
      totalTrades: trades.length,
      openTrades: trades.filter(t => t.status === 'OPEN').length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio overview' });
  }
});

// Get portfolio by asset
router.get('/assets', authenticate, async (req, res) => {
  try {
    const trades = await Trade.query()
      .where('userId', req.user.id)
      .where('status', 'OPEN');
    
    const assets = {};
    trades.forEach(trade => {
      if (!assets[trade.pair]) {
        assets[trade.pair] = {
          pair: trade.pair,
          quantity: 0,
          averagePrice: 0,
          currentValue: 0,
          profit: 0
        };
      }
      assets[trade.pair].quantity += trade.quantity;
    });

    res.json({
      assets: Object.values(assets)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// Get trade history
router.get('/history', authenticate, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const trades = await Trade.query()
      .where('userId', req.user.id)
      .where('status', 'CLOSED')
      .orderBy('closedAt', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await Trade.query()
      .where('userId', req.user.id)
      .where('status', 'CLOSED')
      .resultSize();

    res.json({
      trades,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

// Get performance statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const trades = await Trade.query().where('userId', req.user.id);
    
    const stats = {
      totalTrades: trades.length,
      profitableTrades: trades.filter(t => t.profit > 0).length,
      losingTrades: trades.filter(t => t.profit < 0).length,
      averageProfit: trades.length > 0 ? (trades.reduce((sum, t) => sum + (t.profit || 0), 0) / trades.length).toFixed(2) : 0,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.profit || 0)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.profit || 0)) : 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    };

    const profitTrades = trades.filter(t => t.profit > 0).reduce((sum, t) => sum + t.profit, 0);
    const lossTrades = trades.filter(t => t.profit < 0).reduce((sum, t) => sum + Math.abs(t.profit), 0);
    stats.profitFactor = lossTrades > 0 ? (profitTrades / lossTrades).toFixed(2) : 0;

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
