import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const dataDir = path.join(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');

const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const now = () => new Date().toISOString();

const seedState = () => {
  const adminPasswordHash = bcrypt.hashSync('Admin@123', 10);
  const managerPasswordHash = bcrypt.hashSync('Manager@123', 10);
  const cashierPasswordHash = bcrypt.hashSync('Cashier@123', 10);

  const categories = [
    { id: makeId('cat'), name: 'Beverages', description: 'Drinks and refreshments' },
    { id: makeId('cat'), name: 'Snacks', description: 'Quick bite products' },
    { id: makeId('cat'), name: 'Household', description: 'Daily essentials' }
  ];

  const products = [
    {
      id: makeId('prd'),
      name: 'Sparkling Water',
      sku: 'BEV-001',
      barcode: '480000100001',
      categoryId: categories[0].id,
      price: 35,
      taxRate: 0.12,
      stock: 52,
      reorderLevel: 12,
      active: true
    },
    {
      id: makeId('prd'),
      name: 'Potato Chips',
      sku: 'SNK-001',
      barcode: '480000100002',
      categoryId: categories[1].id,
      price: 55,
      taxRate: 0.12,
      stock: 38,
      reorderLevel: 10,
      active: true
    },
    {
      id: makeId('prd'),
      name: 'Laundry Detergent',
      sku: 'HOU-001',
      barcode: '480000100003',
      categoryId: categories[2].id,
      price: 210,
      taxRate: 0.12,
      stock: 16,
      reorderLevel: 8,
      active: true
    }
  ];

  return {
    users: [
      {
        id: makeId('usr'),
        name: 'System Admin',
        email: 'admin@pos.local',
        passwordHash: adminPasswordHash,
        role: 'admin'
      },
      {
        id: makeId('usr'),
        name: 'Store Manager',
        email: 'manager@pos.local',
        passwordHash: managerPasswordHash,
        role: 'manager'
      },
      {
        id: makeId('usr'),
        name: 'Cashier User',
        email: 'cashier@pos.local',
        passwordHash: cashierPasswordHash,
        role: 'cashier'
      }
    ],
    categories,
    products,
    customers: [
      {
        id: makeId('cus'),
        name: 'Walk-in Customer',
        email: 'walkin@pos.local',
        phone: 'N/A',
        loyaltyPoints: 0,
        tier: 'standard'
      }
    ],
    purchaseOrders: [],
    sales: [],
    auditLogs: []
  };
};

const ensureDb = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(seedState(), null, 2));
  }
};

export const loadDb = () => {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
};

export const saveDb = (state) => {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
  return state;
};

export const resetDb = () => saveDb(seedState());

export const createId = makeId;
export const timestamp = now;