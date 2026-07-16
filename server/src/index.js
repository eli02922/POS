import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Op } from 'sequelize';

import { comparePassword, signToken } from './auth.js';
import {
  AuditLog,
  Category,
  Customer,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  Refund,
  Sale,
  SaleItem,
  User,
  createAuditLog,
  createId,
  initDatabase,
  sequelize,
  timestamp
} from './db.js';
import { buildOverviewReport, calculateSaleTotals, sanitizeUser } from './helpers.js';
import { requireAuth, requireRole } from './middleware.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

const productInclude = [{ model: Category, as: 'category', attributes: ['id', 'name'] }];
const purchaseOrderInclude = [{ model: PurchaseOrderItem, as: 'items' }];
const saleInclude = [
  { model: SaleItem, as: 'items' },
  { model: Refund, as: 'refunds' }
];

const normalizeNumber = (value) => Number(value || 0);

const mapProduct = (product) => {
  const plainProduct = typeof product?.toJSON === 'function' ? product.toJSON() : product;
  return {
    id: plainProduct.id,
    name: plainProduct.name,
    sku: plainProduct.sku,
    barcode: plainProduct.barcode,
    categoryId: plainProduct.categoryId,
    price: normalizeNumber(plainProduct.price),
    taxRate: normalizeNumber(plainProduct.taxRate),
    stock: Number(plainProduct.stock || 0),
    reorderLevel: Number(plainProduct.reorderLevel || 0),
    active: Boolean(plainProduct.active),
    categoryName: plainProduct.category?.name || 'Uncategorized'
  };
};

const mapPurchaseOrder = (purchaseOrder) => {
  const plainPurchaseOrder = typeof purchaseOrder?.toJSON === 'function' ? purchaseOrder.toJSON() : purchaseOrder;
  return {
    id: plainPurchaseOrder.id,
    supplierName: plainPurchaseOrder.supplierName,
    status: plainPurchaseOrder.status,
    createdAt: plainPurchaseOrder.createdAt,
    receivedAt: plainPurchaseOrder.receivedAt,
    totalCost: normalizeNumber(plainPurchaseOrder.totalCost),
    items: (plainPurchaseOrder.items || []).map((item) => ({
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      productId: item.productId,
      quantity: Number(item.quantity || 0),
      cost: normalizeNumber(item.cost)
    }))
  };
};

const mapSale = (sale) => {
  const plainSale = typeof sale?.toJSON === 'function' ? sale.toJSON() : sale;
  return {
    id: plainSale.id,
    receiptNumber: plainSale.receiptNumber,
    customerId: plainSale.customerId,
    paymentMethod: plainSale.paymentMethod,
    status: plainSale.status,
    createdAt: plainSale.createdAt,
    subtotal: normalizeNumber(plainSale.subtotal),
    discountTotal: normalizeNumber(plainSale.discountTotal),
    taxTotal: normalizeNumber(plainSale.taxTotal),
    total: normalizeNumber(plainSale.total),
    items: (plainSale.items || []).map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      quantity: Number(item.quantity || 0),
      unitPrice: normalizeNumber(item.unitPrice),
      discount: normalizeNumber(item.discount),
      taxRate: normalizeNumber(item.taxRate),
      taxAmount: normalizeNumber(item.taxAmount),
      lineSubtotal: normalizeNumber(item.lineSubtotal),
      lineTotal: normalizeNumber(item.lineTotal)
    })),
    refunds: (plainSale.refunds || []).map((refund) => ({
      id: refund.id,
      saleId: refund.saleId,
      processedAt: refund.processedAt,
      reason: refund.reason
    }))
  };
};

const mapAuditLog = (auditLog) => {
  const plainAuditLog = typeof auditLog?.toJSON === 'function' ? auditLog.toJSON() : auditLog;
  return {
    id: plainAuditLog.id,
    actorId: plainAuditLog.actorId,
    action: plainAuditLog.action,
    module: plainAuditLog.module,
    details: plainAuditLog.details,
    timestamp: plainAuditLog.timestamp
  };
};

const getState = async () => {
  const [users, categories, products, customers, purchaseOrders, sales, auditLogs] = await Promise.all([
    User.findAll({ order: [['name', 'ASC']] }),
    Category.findAll({ order: [['name', 'ASC']] }),
    Product.findAll({ include: productInclude, order: [['name', 'ASC']] }),
    Customer.findAll({ order: [['name', 'ASC']] }),
    PurchaseOrder.findAll({ include: purchaseOrderInclude, order: [['createdAt', 'DESC']] }),
    Sale.findAll({ include: saleInclude, order: [['createdAt', 'DESC']] }),
    AuditLog.findAll({ order: [['timestamp', 'DESC']] })
  ]);

  return {
    users: users.map((user) => sanitizeUser(user)),
    categories: categories.map((category) => category.toJSON()),
    products: products.map(mapProduct),
    customers: customers.map((customer) => customer.toJSON()),
    purchaseOrders: purchaseOrders.map(mapPurchaseOrder),
    sales: sales.map(mapSale),
    auditLogs: auditLogs.map(mapAuditLog)
  };
};

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'pos-server', timestamp: timestamp() });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isValid = await comparePassword(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  await createAuditLog(user.id, 'LOGIN', 'AUTH', { email: user.email });

  return res.json({
    token: signToken(user),
    user: sanitizeUser(user)
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/bootstrap', requireAuth, async (_req, res) => {
  const state = await getState();
  const overview = buildOverviewReport(state);

  res.json({
    users: state.users,
    categories: state.categories,
    products: state.products,
    customers: state.customers,
    purchaseOrders: state.purchaseOrders,
    sales: state.sales,
    auditLogs: state.auditLogs.slice(0, 25),
    reports: overview
  });
});

app.get('/api/categories', requireAuth, async (_req, res) => {
  const categories = await Category.findAll({ order: [['name', 'ASC']] });
  res.json(categories.map((category) => category.toJSON()));
});

app.post('/api/categories', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { name, description = '' } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  const category = await Category.create({
    id: createId('cat'),
    name: name.trim(),
    description: description.trim()
  });
  await createAuditLog(req.user.id, 'CREATE_CATEGORY', 'CATALOG', category.toJSON());

  return res.status(201).json(category.toJSON());
});

app.get('/api/products', requireAuth, async (_req, res) => {
  const products = await Product.findAll({ include: productInclude, order: [['name', 'ASC']] });
  res.json(products.map(mapProduct));
});

app.post('/api/products', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { name, sku, barcode, categoryId, price, taxRate = 0.12, stock = 0, reorderLevel = 0 } = req.body;

  if (!name || !sku || !barcode || !categoryId) {
    return res.status(400).json({ message: 'Name, SKU, barcode, and category are required.' });
  }

  const product = await Product.create({
    id: createId('prd'),
    name: name.trim(),
    sku: sku.trim(),
    barcode: barcode.trim(),
    categoryId,
    price: Number(price || 0),
    taxRate: Number(taxRate || 0),
    stock: Number(stock || 0),
    reorderLevel: Number(reorderLevel || 0),
    active: true
  });
  await createAuditLog(req.user.id, 'CREATE_PRODUCT', 'CATALOG', product.toJSON());

  const createdProduct = await Product.findByPk(product.id, { include: productInclude });

  return res.status(201).json(mapProduct(createdProduct));
});

app.put('/api/products/:productId', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const product = await Product.findByPk(req.params.productId);

  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  await product.update({
    ...req.body,
    price: Number(req.body.price ?? product.price),
    taxRate: Number(req.body.taxRate ?? product.taxRate),
    stock: Number(req.body.stock ?? product.stock),
    reorderLevel: Number(req.body.reorderLevel ?? product.reorderLevel)
  });

  await createAuditLog(req.user.id, 'UPDATE_PRODUCT', 'CATALOG', product.toJSON());

  const updatedProduct = await Product.findByPk(product.id, { include: productInclude });

  return res.json(mapProduct(updatedProduct));
});

app.get('/api/inventory/low-stock', requireAuth, async (_req, res) => {
  const products = await Product.findAll({
    include: productInclude,
    where: {
      stock: {
        [Op.lte]: sequelize.col('reorderLevel')
      }
    },
    order: [['stock', 'ASC']]
  });
  res.json(products.map(mapProduct));
});

app.patch('/api/inventory/:productId', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { stock } = req.body;
  const product = await Product.findByPk(req.params.productId);

  if (!product) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  await product.update({ stock: Number(stock) });
  await createAuditLog(req.user.id, 'ADJUST_INVENTORY', 'INVENTORY', {
    productId: product.id,
    stock: Number(product.stock)
  });

  return res.json(product.toJSON());
});

app.get('/api/customers', requireAuth, async (_req, res) => {
  const customers = await Customer.findAll({ order: [['name', 'ASC']] });
  res.json(customers.map((customer) => customer.toJSON()));
});

app.post('/api/customers', requireAuth, async (req, res) => {
  const { name, email = '', phone = '' } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: 'Customer name is required.' });
  }

  const customer = await Customer.create({
    id: createId('cus'),
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    loyaltyPoints: 0,
    tier: 'standard'
  });
  await createAuditLog(req.user.id, 'CREATE_CUSTOMER', 'CUSTOMERS', customer.toJSON());

  return res.status(201).json(customer.toJSON());
});

app.get('/api/purchase-orders', requireAuth, async (_req, res) => {
  const purchaseOrders = await PurchaseOrder.findAll({
    include: purchaseOrderInclude,
    order: [['createdAt', 'DESC']]
  });
  res.json(purchaseOrders.map(mapPurchaseOrder));
});

app.post('/api/purchase-orders', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { supplierName, items = [] } = req.body;

  if (!supplierName?.trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Supplier name and at least one item are required.' });
  }

  const poItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity || 0),
    cost: Number(item.cost || 0)
  }));
  const purchaseOrder = await sequelize.transaction(async (transaction) => {
    const createdPurchaseOrder = await PurchaseOrder.create(
      {
        id: createId('po'),
        supplierName: supplierName.trim(),
        status: 'pending',
        createdAt: timestamp(),
        receivedAt: null,
        totalCost: Number(poItems.reduce((sum, item) => sum + item.quantity * item.cost, 0).toFixed(2))
      },
      { transaction }
    );

    await PurchaseOrderItem.bulkCreate(
      poItems.map((item) => ({
        id: createId('poi'),
        purchaseOrderId: createdPurchaseOrder.id,
        ...item
      })),
      { transaction }
    );

    await createAuditLog(req.user.id, 'CREATE_PURCHASE_ORDER', 'PROCUREMENT', createdPurchaseOrder.toJSON(), {
      transaction
    });

    return createdPurchaseOrder.id;
  });

  const createdPurchaseOrder = await PurchaseOrder.findByPk(purchaseOrder, { include: purchaseOrderInclude });

  return res.status(201).json(mapPurchaseOrder(createdPurchaseOrder));
});

app.post('/api/purchase-orders/:purchaseOrderId/receive', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const purchaseOrder = await PurchaseOrder.findByPk(req.params.purchaseOrderId, {
    include: purchaseOrderInclude
  });

  if (!purchaseOrder) {
    return res.status(404).json({ message: 'Purchase order not found.' });
  }

  if (purchaseOrder.status === 'received') {
    return res.status(400).json({ message: 'Purchase order has already been received.' });
  }

  await sequelize.transaction(async (transaction) => {
    for (const item of purchaseOrder.items) {
      const product = await Product.findByPk(item.productId, { transaction });

      if (product) {
        await product.update({ stock: Number(product.stock) + Number(item.quantity) }, { transaction });
      }
    }

    await purchaseOrder.update(
      {
        status: 'received',
        receivedAt: timestamp()
      },
      { transaction }
    );

    await createAuditLog(req.user.id, 'RECEIVE_PURCHASE_ORDER', 'PROCUREMENT', purchaseOrder.toJSON(), {
      transaction
    });
  });

  const updatedPurchaseOrder = await PurchaseOrder.findByPk(purchaseOrder.id, { include: purchaseOrderInclude });

  return res.json(mapPurchaseOrder(updatedPurchaseOrder));
});

app.get('/api/sales', requireAuth, async (_req, res) => {
  const sales = await Sale.findAll({ include: saleInclude, order: [['createdAt', 'DESC']] });
  res.json(sales.map(mapSale));
});

app.post('/api/sales', requireAuth, async (req, res) => {
  const { customerId, paymentMethod = 'cash', items = [] } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one line item is required.' });
  }

  const products = await Product.findAll({
    where: { id: items.map((item) => item.productId) }
  });
  const productsIndex = new Map(products.map((product) => [product.id, product.toJSON()]));

  try {
    const totals = calculateSaleTotals(productsIndex, items);
    const saleId = await sequelize.transaction(async (transaction) => {
      const sale = await Sale.create(
        {
          id: createId('sale'),
          receiptNumber: `RCPT-${Date.now()}`,
          customerId,
          paymentMethod,
          status: 'completed',
          createdAt: timestamp(),
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total
        },
        { transaction }
      );

      await SaleItem.bulkCreate(
        totals.items.map((item) => ({
          id: createId('sli'),
          saleId: sale.id,
          ...item
        })),
        { transaction }
      );

      for (const item of totals.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        await product.update({ stock: Number(product.stock) - Number(item.quantity) }, { transaction });
      }

      if (customerId) {
        const customer = await Customer.findByPk(customerId, { transaction });

        if (customer) {
          const loyaltyPoints = Number(customer.loyaltyPoints) + Math.floor(totals.total / 10);
          let tier = 'standard';

          if (loyaltyPoints >= 500) {
            tier = 'gold';
          } else if (loyaltyPoints >= 250) {
            tier = 'silver';
          }

          await customer.update({ loyaltyPoints, tier }, { transaction });
        }
      }

      await createAuditLog(
        req.user.id,
        'PROCESS_SALE',
        'SALES',
        {
          saleId: sale.id,
          receiptNumber: sale.receiptNumber,
          total: totals.total
        },
        { transaction }
      );

      return sale.id;
    });

    const sale = await Sale.findByPk(saleId, { include: saleInclude });

    return res.status(201).json(mapSale(sale));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

app.post('/api/sales/:saleId/refund', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const sale = await Sale.findByPk(req.params.saleId, { include: saleInclude });

  if (!sale) {
    return res.status(404).json({ message: 'Sale not found.' });
  }

  if (sale.status === 'refunded') {
    return res.status(400).json({ message: 'Sale has already been refunded.' });
  }

  await sequelize.transaction(async (transaction) => {
    await sale.update({ status: 'refunded' }, { transaction });
    await Refund.create(
      {
        id: createId('refund'),
        saleId: sale.id,
        processedAt: timestamp(),
        reason: req.body.reason || 'Customer refund'
      },
      { transaction }
    );

    for (const item of sale.items) {
      const product = await Product.findByPk(item.productId, { transaction });

      if (product) {
        await product.update({ stock: Number(product.stock) + Number(item.quantity) }, { transaction });
      }
    }

    await createAuditLog(req.user.id, 'PROCESS_REFUND', 'SALES', {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber
    }, {
      transaction
    });
  });

  const updatedSale = await Sale.findByPk(sale.id, { include: saleInclude });

  return res.json(mapSale(updatedSale));
});

app.get('/api/reports/overview', requireAuth, async (_req, res) => {
  res.json(buildOverviewReport(await getState()));
});

app.get('/api/audit-logs', requireAuth, requireRole('admin', 'manager'), async (_req, res) => {
  const auditLogs = await AuditLog.findAll({ order: [['timestamp', 'DESC']] });
  res.json(auditLogs.map(mapAuditLog));
});

const startServer = async () => {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`POS server running on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start POS server:', error);
  process.exitCode = 1;
});