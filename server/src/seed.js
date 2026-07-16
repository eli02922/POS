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
	initDatabase
} from './db.js';
import { buildSeedState } from './seedData.js';

const seed = async () => {
	await initDatabase({ sync: true, force: true });

	const state = buildSeedState();

	await User.bulkCreate(state.users);
	await Category.bulkCreate(state.categories);
	await Product.bulkCreate(state.products);
	await Customer.bulkCreate(state.customers);
	await PurchaseOrder.bulkCreate(state.purchaseOrders);
	await PurchaseOrderItem.bulkCreate([]);
	await Sale.bulkCreate([]);
	await SaleItem.bulkCreate([]);
	await Refund.bulkCreate([]);
	await AuditLog.bulkCreate([]);

	console.log('POS seed data generated in the configured RDBMS.');
};

seed().catch((error) => {
	console.error('Failed to seed database:', error);
	process.exitCode = 1;
});