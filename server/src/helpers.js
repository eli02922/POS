export const sanitizeUser = (user) => {
  const plainUser = typeof user?.toJSON === 'function' ? user.toJSON() : user;
  const { passwordHash, ...safeUser } = plainUser;
  return safeUser;
};

export const getCategoryName = (state, categoryId) =>
  state.categories.find((category) => category.id === categoryId)?.name || 'Uncategorized';

export const calculateSaleTotals = (productsIndex, items) => {
  const normalizedItems = items.map((item) => {
    const product = productsIndex.get(item.productId);

    if (!product) {
      throw new Error(`Product ${item.productId} was not found.`);
    }

    const quantity = Number(item.quantity || 0);
    const discount = Number(item.discount || 0);
    const unitPrice = Number(item.unitPrice ?? product.price);
    const lineSubtotal = quantity * unitPrice;
    const taxAmount = (lineSubtotal - discount) * product.taxRate;

    if (quantity <= 0) {
      throw new Error(`Invalid quantity for ${product.name}.`);
    }

    if (quantity > product.stock) {
      throw new Error(`Insufficient stock for ${product.name}.`);
    }

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      quantity,
      unitPrice,
      discount,
      taxRate: product.taxRate,
      taxAmount: Number(taxAmount.toFixed(2)),
      lineSubtotal: Number(lineSubtotal.toFixed(2)),
      lineTotal: Number((lineSubtotal - discount + taxAmount).toFixed(2))
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
  const discountTotal = normalizedItems.reduce((sum, item) => sum + item.discount, 0);
  const taxTotal = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = subtotal - discountTotal + taxTotal;

  return {
    items: normalizedItems,
    subtotal: Number(subtotal.toFixed(2)),
    discountTotal: Number(discountTotal.toFixed(2)),
    taxTotal: Number(taxTotal.toFixed(2)),
    total: Number(total.toFixed(2))
  };
};

export const buildOverviewReport = (state) => {
  const orderedSales = [...state.sales].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
  const completedSales = orderedSales.filter((sale) => sale.status === 'completed');
  const refundedSales = orderedSales.filter((sale) => sale.status === 'refunded');
  const totalRevenue = completedSales.reduce((sum, sale) => sum + sale.total, 0);
  const refundValue = refundedSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalUnitsSold = completedSales.reduce(
    (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const lowStockProducts = state.products.filter((product) => product.stock <= product.reorderLevel);

  const topSellingMap = new Map();

  completedSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = topSellingMap.get(item.productId) || {
        productId: item.productId,
        name: item.name,
        quantity: 0,
        revenue: 0
      };

      current.quantity += item.quantity;
      current.revenue += item.lineTotal;
      topSellingMap.set(item.productId, current);
    });
  });

  return {
    kpis: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      refundValue: Number(refundValue.toFixed(2)),
      totalSales: completedSales.length,
      totalUnitsSold,
      products: state.products.length,
      customers: state.customers.length,
      lowStockCount: lowStockProducts.length,
      pendingPurchaseOrders: state.purchaseOrders.filter((po) => po.status !== 'received').length
    },
    lowStockProducts: lowStockProducts.map((product) => ({
      ...product,
      categoryName: getCategoryName(state, product.categoryId)
    })),
    topSellingProducts: Array.from(topSellingMap.values())
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        revenue: Number(entry.revenue.toFixed(2))
      })),
    recentSales: completedSales.slice(0, 5)
  };
};