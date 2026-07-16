import bcrypt from 'bcryptjs';

import { createId } from './db.js';

export const buildSeedState = () => {
  const categories = [
    { id: createId('cat'), name: 'Beverages', description: 'Drinks and refreshments' },
    { id: createId('cat'), name: 'Snacks', description: 'Quick bite products' },
    { id: createId('cat'), name: 'Household', description: 'Daily essentials' }
  ];

  const products = [
    {
      id: createId('prd'),
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
      id: createId('prd'),
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
      id: createId('prd'),
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
        id: createId('usr'),
        name: 'System Admin',
        email: 'admin@pos.local',
        passwordHash: bcrypt.hashSync('Admin@123', 10),
        role: 'admin'
      },
      {
        id: createId('usr'),
        name: 'Store Manager',
        email: 'manager@pos.local',
        passwordHash: bcrypt.hashSync('Manager@123', 10),
        role: 'manager'
      },
      {
        id: createId('usr'),
        name: 'Cashier User',
        email: 'cashier@pos.local',
        passwordHash: bcrypt.hashSync('Cashier@123', 10),
        role: 'cashier'
      }
    ],
    categories,
    products,
    customers: [
      {
        id: createId('cus'),
        name: 'Walk-in Customer',
        email: 'walkin@pos.local',
        phone: 'N/A',
        loyaltyPoints: 0,
        tier: 'standard'
      }
    ],
    purchaseOrders: []
  };
};