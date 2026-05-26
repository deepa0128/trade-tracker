import type { Portfolio } from '../types.js';

const NOW = '2026-05-26T00:00:00.000Z';

export const SEED_PORTFOLIOS: Portfolio[] = [
  {
    id: 'tech_growth',
    name: 'Tech & Growth',
    exchange: 'NSE',
    createdAt: NOW,
    updatedAt: NOW,
    holdings: [
      { ticker: 'TCS.NS',        name: 'Tata Consultancy',   sector: 'IT',  shares: 20,  avgCost: 3650,  exchange: 'NSE' },
      { ticker: 'INFY.NS',       name: 'Infosys',            sector: 'IT',  shares: 35,  avgCost: 1420,  exchange: 'NSE' },
      { ticker: 'HCLTECH.NS',    name: 'HCL Technologies',   sector: 'IT',  shares: 45,  avgCost: 1380,  exchange: 'NSE' },
      { ticker: 'WIPRO.NS',      name: 'Wipro Ltd',          sector: 'IT',  shares: 80,  avgCost: 480,   exchange: 'NSE' },
      { ticker: 'PERSISTENT.NS', name: 'Persistent Systems', sector: 'IT',  shares: 12,  avgCost: 4800,  exchange: 'NSE' },
      { ticker: 'LTIM.NS',       name: 'LTIMindtree',        sector: 'IT',  shares: 10,  avgCost: 5200,  exchange: 'NSE' },
    ],
  },
  {
    id: 'blue_chip_defensive',
    name: 'Blue Chip Defensive',
    exchange: 'BSE',
    createdAt: NOW,
    updatedAt: NOW,
    holdings: [
      { ticker: 'RELIANCE.BO',   name: 'Reliance Industries', sector: 'Energy',  shares: 25,  avgCost: 2680,  exchange: 'BSE' },
      { ticker: 'HDFCBANK.BO',   name: 'HDFC Bank',           sector: 'Banking', shares: 55,  avgCost: 1680,  exchange: 'BSE' },
      { ticker: 'HINDUNILVR.BO', name: 'Hindustan Unilever',  sector: 'FMCG',    shares: 30,  avgCost: 2550,  exchange: 'BSE' },
      { ticker: 'ITC.BO',        name: 'ITC Ltd',             sector: 'FMCG',    shares: 200, avgCost: 460,   exchange: 'BSE' },
      { ticker: 'NESTLEIND.BO',  name: 'Nestle India',        sector: 'FMCG',    shares: 5,   avgCost: 24200, exchange: 'BSE' },
      { ticker: 'TATAMOTORS.BO', name: 'Tata Motors',         sector: 'Auto',    shares: 60,  avgCost: 820,   exchange: 'BSE' },
    ],
  },
  {
    id: 'mid_cap_opportunities',
    name: 'Mid Cap Opportunities',
    exchange: 'NSE_BSE',
    createdAt: NOW,
    updatedAt: NOW,
    holdings: [
      { ticker: 'ZOMATO.NS',    name: 'Zomato Ltd',         sector: 'Consumer',    shares: 400, avgCost: 185,  exchange: 'NSE' },
      { ticker: 'IRCTC.NS',     name: 'IRCTC',              sector: 'Travel',      shares: 80,  avgCost: 780,  exchange: 'NSE' },
      { ticker: 'TATAELXSI.NS', name: 'Tata Elxsi',         sector: 'IT',          shares: 10,  avgCost: 7200, exchange: 'NSE' },
      { ticker: 'DIXON.NS',     name: 'Dixon Technologies', sector: 'Electronics', shares: 15,  avgCost: 9400, exchange: 'NSE' },
      { ticker: 'POLYCAB.NS',   name: 'Polycab India',      sector: 'Electricals', shares: 20,  avgCost: 5800, exchange: 'NSE' },
    ],
  },
];
