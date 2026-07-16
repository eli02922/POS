import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DataTypes, Sequelize } from 'sequelize';

const resolveDialect = () => {
  if (process.env.DATABASE_URL?.startsWith('mysql')) {
    return 'mysql';
  }

  return process.env.DB_DIALECT === 'mysql' ? 'mysql' : 'postgres';
};

const dialect = resolveDialect();
const port = Number(process.env.DB_PORT || (dialect === 'mysql' ? 3306 : 5432));
const dialectOptions =
  process.env.DB_SSL === 'true'
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : undefined;

export const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect,
      logging: false,
      dialectOptions
    })
  : new Sequelize(
      process.env.DB_NAME || 'pulse_pos',
      process.env.DB_USER || (dialect === 'mysql' ? 'root' : 'postgres'),
      process.env.DB_PASSWORD || 'postgres',
      {
        host: process.env.DB_HOST || 'localhost',
        port,
        dialect,
        logging: false,
        dialectOptions
      }
    );

export const createId = (prefix) => `${prefix}_${randomUUID()}`;
export const timestamp = () => new Date().toISOString();

const commonConfig = {
  timestamps: false
};

export const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false }
  },
  commonConfig
);

export const Category = sequelize.define(
  'Category',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
  },
  commonConfig
);

export const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    sku: { type: DataTypes.STRING, allowNull: false, unique: true },
    barcode: { type: DataTypes.STRING, allowNull: false, unique: true },
    categoryId: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    taxRate: { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 0.12 },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reorderLevel: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  commonConfig
);

export const Customer = sequelize.define(
  'Customer',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    phone: { type: DataTypes.STRING, allowNull: false, defaultValue: '' },
    loyaltyPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    tier: { type: DataTypes.STRING, allowNull: false, defaultValue: 'standard' }
  },
  commonConfig
);

export const PurchaseOrder = sequelize.define(
  'PurchaseOrder',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    supplierName: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    receivedAt: { type: DataTypes.DATE, allowNull: true },
    totalCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  },
  commonConfig
);

export const PurchaseOrderItem = sequelize.define(
  'PurchaseOrderItem',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    purchaseOrderId: { type: DataTypes.STRING, allowNull: false },
    productId: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  },
  commonConfig
);

export const Sale = sequelize.define(
  'Sale',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    receiptNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    customerId: { type: DataTypes.STRING, allowNull: true },
    paymentMethod: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discountTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    taxTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  },
  commonConfig
);

export const SaleItem = sequelize.define(
  'SaleItem',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    saleId: { type: DataTypes.STRING, allowNull: false },
    productId: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    sku: { type: DataTypes.STRING, allowNull: false },
    barcode: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    taxRate: { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 0 },
    taxAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    lineSubtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  },
  commonConfig
);

export const Refund = sequelize.define(
  'Refund',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    saleId: { type: DataTypes.STRING, allowNull: false },
    processedAt: { type: DataTypes.DATE, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: false }
  },
  commonConfig
);

export const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    actorId: { type: DataTypes.STRING, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    module: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    timestamp: { type: DataTypes.DATE, allowNull: false }
  },
  commonConfig
);

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'purchaseOrderId', as: 'items' });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
Product.hasMany(PurchaseOrderItem, { foreignKey: 'productId', as: 'purchaseOrderItems' });
PurchaseOrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Customer.hasMany(Sale, { foreignKey: 'customerId', as: 'sales' });
Sale.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Sale.hasMany(SaleItem, { foreignKey: 'saleId', as: 'items' });
SaleItem.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });
Product.hasMany(SaleItem, { foreignKey: 'productId', as: 'saleItems' });
SaleItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Sale.hasMany(Refund, { foreignKey: 'saleId', as: 'refunds' });
Refund.belongsTo(Sale, { foreignKey: 'saleId', as: 'sale' });

export const initDatabase = async ({ sync = false, force = false } = {}) => {
  await sequelize.authenticate();

  if (sync) {
    await sequelize.sync({ force });
  }
};

export const createAuditLog = async (actorId, action, module, details, options = {}) =>
  AuditLog.create(
    {
      id: createId('log'),
      actorId,
      action,
      module,
      details,
      timestamp: timestamp()
    },
    options
  );