import { useEffect, useMemo, useReducer, useState } from 'react';
import { apiRequest } from './api.js';

const tokenKey = 'pulse-pos-token';
const userKey = 'pulse-pos-user';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'sales', label: 'Sales' },
  { id: 'receipts', label: 'Receipt Journal' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'procurement', label: 'Procurement' },
  { id: 'audit', label: 'Audit' }
];

const initialState = {
  activeTab: 'overview',
  bootstrap: {
    categories: [],
    products: [],
    customers: [],
    purchaseOrders: [],
    sales: [],
    auditLogs: [],
    reports: {
      kpis: {},
      lowStockProducts: [],
      topSellingProducts: [],
      recentSales: []
    }
  },
  loading: false,
  error: ''
};

function reducer(state, action) {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: action.value, error: '' };
    case 'error':
      return { ...state, loading: false, error: action.value };
    case 'bootstrap':
      return { ...state, loading: false, error: '', bootstrap: action.value };
    case 'tab':
      return { ...state, activeTab: action.value };
    default:
      return state;
  }
}

const currency = (value) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const dateTime = (value) =>
  new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));

const Section = ({ title, children, action }) => (
  <section className="panel">
    <div className="panel-header">
      <div>
        <p className="eyebrow">Module</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Table = ({ columns, rows, emptyMessage = 'No records yet.' }) => {
  if (!rows.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const StatCard = ({ label, value, hint }) => (
  <article className="stat-card">
    <p>{label}</p>
    <h3>{value}</h3>
    <span>{hint}</span>
  </article>
);

const LoginScreen = ({ onSubmit, error }) => {
  const [email, setEmail] = useState('admin@pos.local');
  const [password, setPassword] = useState('Admin@123');

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div>
          <p className="eyebrow">Retail Command Center</p>
          <h1>Pulse POS</h1>
          <p className="lead">
            A starter POS platform with React, Express, JWT auth, RBAC, inventory deduction,
            loyalty, procurement, dashboards, refunds, and audit tracking.
          </p>
        </div>
        <form
          className="form-grid"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ email, password });
          }}
        >
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="inline-error">{error}</div> : null}
          <button className="primary-button" type="submit">
            Sign in
          </button>
        </form>
        <div className="credentials-box">
          <strong>Demo users</strong>
          <p>Admin: admin@pos.local / Admin@123</p>
          <p>Manager: manager@pos.local / Manager@123</p>
          <p>Cashier: cashier@pos.local / Cashier@123</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState({
    token: window.localStorage.getItem(tokenKey) || '',
    user: JSON.parse(window.localStorage.getItem(userKey) || 'null')
  });
  const [state, dispatch] = useReducer(reducer, initialState);
  const [message, setMessage] = useState('');
  const [catalogForm, setCatalogForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    price: 0,
    stock: 0,
    reorderLevel: 0
  });
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [customerForm, setCustomerForm] = useState({ name: '', email: '', phone: '' });
  const [barcodeValue, setBarcodeValue] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cart, setCart] = useState([]);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptStatus, setReceiptStatus] = useState('all');
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({ supplierName: '', productId: '', quantity: 1, cost: 0 });

  const canManage = ['admin', 'manager'].includes(session.user?.role);

  const refreshBootstrap = async () => {
    if (!session.token) {
      return;
    }

    dispatch({ type: 'loading', value: true });

    try {
      const data = await apiRequest('/api/bootstrap', { token: session.token });
      dispatch({ type: 'bootstrap', value: data });
      if (!selectedCustomerId && data.customers[0]) {
        setSelectedCustomerId(data.customers[0].id);
      }
      if (!catalogForm.categoryId && data.categories[0]) {
        setCatalogForm((current) => ({ ...current, categoryId: data.categories[0].id }));
      }
      if (!purchaseOrderForm.productId && data.products[0]) {
        setPurchaseOrderForm((current) => ({ ...current, productId: data.products[0].id }));
      }
      if (!selectedReceiptId && data.sales[0]) {
        setSelectedReceiptId(data.sales[0].id);
      }
    } catch (error) {
      dispatch({ type: 'error', value: error.message });
      if (error.message.includes('token')) {
        handleLogout();
      }
    }
  };

  useEffect(() => {
    refreshBootstrap();
  }, [session.token]);

  const handleLogin = async (credentials) => {
    dispatch({ type: 'loading', value: true });

    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: credentials
      });

      window.localStorage.setItem(tokenKey, response.token);
      window.localStorage.setItem(userKey, JSON.stringify(response.user));
      setSession({ token: response.token, user: response.user });
    } catch (error) {
      dispatch({ type: 'error', value: error.message });
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(userKey);
    setSession({ token: '', user: null });
    setCart([]);
  };

  const runMutation = async (callback, successMessage) => {
    setMessage('');

    try {
      await callback();
      await refreshBootstrap();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const salesTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountTotal = cart.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity - item.discount) * item.taxRate, 0);
    const total = subtotal - discountTotal + taxTotal;

    return { subtotal, discountTotal, taxTotal, total };
  }, [cart]);

  const customersById = useMemo(
    () => new Map(state.bootstrap.customers.map((customer) => [customer.id, customer])),
    [state.bootstrap.customers]
  );

  const filteredReceipts = useMemo(() => {
    const searchTerm = receiptSearch.trim().toLowerCase();

    return state.bootstrap.sales.filter((sale) => {
      const customer = customersById.get(sale.customerId);
      const matchesSearch =
        !searchTerm ||
        sale.receiptNumber.toLowerCase().includes(searchTerm) ||
        sale.paymentMethod.toLowerCase().includes(searchTerm) ||
        customer?.name?.toLowerCase().includes(searchTerm);
      const matchesStatus = receiptStatus === 'all' || sale.status === receiptStatus;

      return matchesSearch && matchesStatus;
    });
  }, [customersById, receiptSearch, receiptStatus, state.bootstrap.sales]);

  const selectedReceipt =
    filteredReceipts.find((sale) => sale.id === selectedReceiptId) || filteredReceipts[0] || null;

  useEffect(() => {
    if (!filteredReceipts.length) {
      if (selectedReceiptId) {
        setSelectedReceiptId('');
      }
      return;
    }

    if (!selectedReceipt || selectedReceipt.id !== selectedReceiptId) {
      setSelectedReceiptId(filteredReceipts[0].id);
    }
  }, [filteredReceipts, selectedReceipt, selectedReceiptId]);

  const addProductToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          name: product.name,
          quantity: 1,
          price: product.price,
          taxRate: product.taxRate,
          discount: 0
        }
      ];
    });
  };

  const handleBarcodeScan = () => {
    const match = state.bootstrap.products.find((product) => product.barcode === barcodeValue.trim());

    if (!match) {
      setMessage('Barcode was not found.');
      return;
    }

    addProductToCart(match);
    setBarcodeValue('');
    setMessage(`Added ${match.name} to the sale cart.`);
  };

  const handlePrintReceipt = () => {
    if (!selectedReceipt) {
      setMessage('Select a receipt to print.');
      return;
    }

    window.print();
  };

  const filteredTabs = canManage ? tabs : tabs.filter((tab) => tab.id !== 'audit');

  if (!session.token || !session.user) {
    return <LoginScreen onSubmit={handleLogin} error={state.error} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">POS Platform</p>
          <h2>Pulse POS</h2>
          <p className="sidebar-copy">Operations, checkout, stock control, and analytics in one place.</p>
        </div>
        <nav>
          {filteredTabs.map((tab) => (
            <button
              key={tab.id}
              className={state.activeTab === tab.id ? 'nav-button active' : 'nav-button'}
              onClick={() => dispatch({ type: 'tab', value: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>
            <strong>{session.user.name}</strong>
            <p>{session.user.role}</p>
          </div>
          <button className="ghost-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live Operations</p>
            <h1>{tabs.find((tab) => tab.id === state.activeTab)?.label}</h1>
          </div>
          {message ? <div className="toast">{message}</div> : null}
        </header>

        {state.error ? <div className="inline-error">{state.error}</div> : null}

        {state.activeTab === 'overview' ? (
          <div className="stack">
            <div className="stats-grid">
              <StatCard
                label="Revenue"
                value={currency(state.bootstrap.reports.kpis.totalRevenue)}
                hint="Completed sales"
              />
              <StatCard
                label="Units sold"
                value={state.bootstrap.reports.kpis.totalUnitsSold || 0}
                hint="Across all receipts"
              />
              <StatCard
                label="Low-stock SKUs"
                value={state.bootstrap.reports.kpis.lowStockCount || 0}
                hint="Needs replenishment"
              />
              <StatCard
                label="Open POs"
                value={state.bootstrap.reports.kpis.pendingPurchaseOrders || 0}
                hint="Awaiting receipt"
              />
            </div>

            <Section title="Sales and Inventory Snapshot">
              <div className="dual-grid">
                <div>
                  <h3>Top-selling products</h3>
                  <Table
                    columns={[
                      { key: 'name', label: 'Product' },
                      { key: 'quantity', label: 'Units' },
                      { key: 'revenue', label: 'Revenue', render: (row) => currency(row.revenue) }
                    ]}
                    rows={state.bootstrap.reports.topSellingProducts}
                    emptyMessage="No completed sales yet."
                  />
                </div>
                <div>
                  <h3>Recent receipts</h3>
                  <Table
                    columns={[
                      { key: 'receiptNumber', label: 'Receipt' },
                      { key: 'paymentMethod', label: 'Payment' },
                      { key: 'total', label: 'Total', render: (row) => currency(row.total) }
                    ]}
                    rows={state.bootstrap.reports.recentSales}
                    emptyMessage="No receipts yet."
                  />
                </div>
              </div>
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'catalog' ? (
          <div className="stack">
            <Section title="Category Management">
              <form
                className="form-grid compact-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  runMutation(
                    () =>
                      apiRequest('/api/categories', {
                        method: 'POST',
                        token: session.token,
                        body: categoryForm
                      }).then(() => setCategoryForm({ name: '', description: '' })),
                    'Category created.'
                  );
                }}
              >
                <label>
                  <span>Name</span>
                  <input
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <input
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm({ ...categoryForm, description: event.target.value })
                    }
                  />
                </label>
                <button className="primary-button" type="submit" disabled={!canManage}>
                  Add category
                </button>
              </form>
            </Section>

            <Section title="Product Management">
              <form
                className="form-grid catalog-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  runMutation(
                    () =>
                      apiRequest('/api/products', {
                        method: 'POST',
                        token: session.token,
                        body: catalogForm
                      }).then(() =>
                        setCatalogForm({
                          name: '',
                          sku: '',
                          barcode: '',
                          categoryId: state.bootstrap.categories[0]?.id || '',
                          price: 0,
                          stock: 0,
                          reorderLevel: 0
                        })
                      ),
                    'Product saved.'
                  );
                }}
              >
                <label>
                  <span>Product name</span>
                  <input
                    value={catalogForm.name}
                    onChange={(event) => setCatalogForm({ ...catalogForm, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>SKU</span>
                  <input
                    value={catalogForm.sku}
                    onChange={(event) => setCatalogForm({ ...catalogForm, sku: event.target.value })}
                  />
                </label>
                <label>
                  <span>Barcode</span>
                  <input
                    value={catalogForm.barcode}
                    onChange={(event) => setCatalogForm({ ...catalogForm, barcode: event.target.value })}
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select
                    value={catalogForm.categoryId}
                    onChange={(event) => setCatalogForm({ ...catalogForm, categoryId: event.target.value })}
                  >
                    {state.bootstrap.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Price</span>
                  <input
                    type="number"
                    value={catalogForm.price}
                    onChange={(event) => setCatalogForm({ ...catalogForm, price: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>Opening stock</span>
                  <input
                    type="number"
                    value={catalogForm.stock}
                    onChange={(event) => setCatalogForm({ ...catalogForm, stock: Number(event.target.value) })}
                  />
                </label>
                <label>
                  <span>Reorder level</span>
                  <input
                    type="number"
                    value={catalogForm.reorderLevel}
                    onChange={(event) =>
                      setCatalogForm({ ...catalogForm, reorderLevel: Number(event.target.value) })
                    }
                  />
                </label>
                <button className="primary-button" type="submit" disabled={!canManage}>
                  Save product
                </button>
              </form>

              <Table
                columns={[
                  { key: 'name', label: 'Product' },
                  { key: 'sku', label: 'SKU' },
                  { key: 'barcode', label: 'Barcode' },
                  { key: 'categoryName', label: 'Category' },
                  { key: 'stock', label: 'Stock' },
                  { key: 'price', label: 'Price', render: (row) => currency(row.price) }
                ]}
                rows={state.bootstrap.products}
              />
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'sales' ? (
          <div className="stack">
            <Section title="Checkout and Barcode Scanning" action={<span className="badge">Real-time stock deduction</span>}>
              <div className="checkout-grid">
                <div className="stack">
                  <div className="scanner-row">
                    <input
                      placeholder="Scan or enter barcode"
                      value={barcodeValue}
                      onChange={(event) => setBarcodeValue(event.target.value)}
                    />
                    <button className="primary-button" onClick={handleBarcodeScan}>
                      Scan
                    </button>
                  </div>
                  <div className="product-pills">
                    {state.bootstrap.products.map((product) => (
                      <button key={product.id} className="pill-button" onClick={() => addProductToCart(product)}>
                        {product.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="stack">
                  <label>
                    <span>Customer</span>
                    <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                      {state.bootstrap.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Payment method</span>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="ewallet">E-Wallet</option>
                    </select>
                  </label>
                </div>
              </div>

              <Table
                columns={[
                  { key: 'name', label: 'Item' },
                  {
                    key: 'quantity',
                    label: 'Qty',
                    render: (row) => (
                      <input
                        className="table-input"
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) =>
                          setCart((current) =>
                            current.map((item) =>
                              item.productId === row.productId
                                ? { ...item, quantity: Number(event.target.value) }
                                : item
                            )
                          )
                        }
                      />
                    )
                  },
                  { key: 'price', label: 'Price', render: (row) => currency(row.price) },
                  {
                    key: 'discount',
                    label: 'Discount',
                    render: (row) => (
                      <input
                        className="table-input"
                        type="number"
                        min="0"
                        value={row.discount}
                        onChange={(event) =>
                          setCart((current) =>
                            current.map((item) =>
                              item.productId === row.productId
                                ? { ...item, discount: Number(event.target.value) }
                                : item
                            )
                          )
                        }
                      />
                    )
                  },
                  {
                    key: 'remove',
                    label: 'Action',
                    render: (row) => (
                      <button
                        className="ghost-button"
                        onClick={() => setCart((current) => current.filter((item) => item.productId !== row.productId))}
                      >
                        Remove
                      </button>
                    )
                  }
                ]}
                rows={cart}
                emptyMessage="Scan items or click a product to start a sale."
              />

              <div className="totals-card">
                <div><span>Subtotal</span><strong>{currency(salesTotals.subtotal)}</strong></div>
                <div><span>Discounts</span><strong>{currency(salesTotals.discountTotal)}</strong></div>
                <div><span>Tax</span><strong>{currency(salesTotals.taxTotal)}</strong></div>
                <div><span>Total</span><strong>{currency(salesTotals.total)}</strong></div>
              </div>

              <button
                className="primary-button"
                onClick={() =>
                  runMutation(
                    () =>
                      apiRequest('/api/sales', {
                        method: 'POST',
                        token: session.token,
                        body: {
                          customerId: selectedCustomerId,
                          paymentMethod,
                          items: cart.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.price,
                            discount: item.discount
                          }))
                        }
                      }).then(() => setCart([])),
                    'Sale completed and receipt generated.'
                  )
                }
                disabled={!cart.length}
              >
                Complete sale
              </button>
            </Section>

            <Section title="Transaction History">
              <Table
                columns={[
                  { key: 'receiptNumber', label: 'Receipt' },
                  { key: 'status', label: 'Status' },
                  { key: 'paymentMethod', label: 'Payment' },
                  { key: 'total', label: 'Total', render: (row) => currency(row.total) },
                  {
                    key: 'refund',
                    label: 'Action',
                    render: (row) =>
                      row.status === 'completed' && canManage ? (
                        <button
                          className="ghost-button"
                          onClick={() =>
                            runMutation(
                              () =>
                                apiRequest(`/api/sales/${row.id}/refund`, {
                                  method: 'POST',
                                  token: session.token,
                                  body: { reason: 'Manual refund from dashboard' }
                                }),
                              `Refund processed for ${row.receiptNumber}.`
                            )
                          }
                        >
                          Refund
                        </button>
                      ) : (
                        'Closed'
                      )
                  }
                ]}
                rows={state.bootstrap.sales}
              />
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'inventory' ? (
          <Section title="Low-stock Monitoring and Restock Alerts">
            <Table
              columns={[
                { key: 'name', label: 'Product' },
                { key: 'categoryName', label: 'Category' },
                { key: 'stock', label: 'On hand' },
                { key: 'reorderLevel', label: 'Reorder level' }
              ]}
              rows={state.bootstrap.reports.lowStockProducts}
              emptyMessage="No low-stock items right now."
            />
          </Section>
        ) : null}

        {state.activeTab === 'receipts' ? (
          <div className="stack">
            <Section
              title="Receipt Journal"
              action={
                <button className="primary-button print-hide" onClick={handlePrintReceipt}>
                  Print selected receipt
                </button>
              }
            >
              <div className="journal-toolbar print-hide">
                <label>
                  <span>Search receipt, customer, or payment</span>
                  <input
                    placeholder="RCPT-..., Walk-in Customer, cash"
                    value={receiptSearch}
                    onChange={(event) => setReceiptSearch(event.target.value)}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select value={receiptStatus} onChange={(event) => setReceiptStatus(event.target.value)}>
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </label>
              </div>

              <div className="journal-grid">
                <div className="receipt-list print-hide">
                  {filteredReceipts.length ? (
                    filteredReceipts.map((sale) => {
                      const customer = customersById.get(sale.customerId);

                      return (
                        <button
                          key={sale.id}
                          className={sale.id === selectedReceipt?.id ? 'receipt-row active' : 'receipt-row'}
                          onClick={() => setSelectedReceiptId(sale.id)}
                        >
                          <div>
                            <strong>{sale.receiptNumber}</strong>
                            <p>{customer?.name || 'Walk-in Customer'}</p>
                          </div>
                          <div className="receipt-row-meta">
                            <span>{dateTime(sale.createdAt)}</span>
                            <strong>{currency(sale.total)}</strong>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="empty-state">No receipts match the current filters.</div>
                  )}
                </div>

                <div className="receipt-sheet">
                  {selectedReceipt ? (
                    <>
                      <div className="receipt-header">
                        <div>
                          <p className="eyebrow">Receipt</p>
                          <h3>{selectedReceipt.receiptNumber}</h3>
                        </div>
                        <div className="receipt-status-pill">{selectedReceipt.status}</div>
                      </div>

                      <div className="receipt-meta-grid">
                        <div>
                          <span>Customer</span>
                          <strong>{customersById.get(selectedReceipt.customerId)?.name || 'Walk-in Customer'}</strong>
                        </div>
                        <div>
                          <span>Issued</span>
                          <strong>{dateTime(selectedReceipt.createdAt)}</strong>
                        </div>
                        <div>
                          <span>Payment</span>
                          <strong>{selectedReceipt.paymentMethod}</strong>
                        </div>
                        <div>
                          <span>Lines</span>
                          <strong>{selectedReceipt.items.length}</strong>
                        </div>
                      </div>

                      <Table
                        columns={[
                          { key: 'name', label: 'Item' },
                          { key: 'quantity', label: 'Qty' },
                          { key: 'unitPrice', label: 'Unit', render: (row) => currency(row.unitPrice) },
                          { key: 'discount', label: 'Discount', render: (row) => currency(row.discount) },
                          { key: 'lineTotal', label: 'Total', render: (row) => currency(row.lineTotal) }
                        ]}
                        rows={selectedReceipt.items}
                      />

                      <div className="receipt-totals">
                        <div><span>Subtotal</span><strong>{currency(selectedReceipt.subtotal)}</strong></div>
                        <div><span>Discount</span><strong>{currency(selectedReceipt.discountTotal)}</strong></div>
                        <div><span>Tax</span><strong>{currency(selectedReceipt.taxTotal)}</strong></div>
                        <div><span>Grand total</span><strong>{currency(selectedReceipt.total)}</strong></div>
                      </div>

                      {selectedReceipt.refunds.length ? (
                        <div className="receipt-refunds">
                          <p className="eyebrow">Refund history</p>
                          {selectedReceipt.refunds.map((refund) => (
                            <div key={refund.id} className="refund-row">
                              <strong>{dateTime(refund.processedAt)}</strong>
                              <span>{refund.reason}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="empty-state">There are no receipts to review yet.</div>
                  )}
                </div>
              </div>
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'customers' ? (
          <div className="stack">
            <Section title="Customer and Loyalty Management">
              <form
                className="form-grid compact-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  runMutation(
                    () =>
                      apiRequest('/api/customers', {
                        method: 'POST',
                        token: session.token,
                        body: customerForm
                      }).then(() => setCustomerForm({ name: '', email: '', phone: '' })),
                    'Customer profile created.'
                  );
                }}
              >
                <label>
                  <span>Name</span>
                  <input
                    value={customerForm.name}
                    onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    value={customerForm.email}
                    onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })}
                  />
                </label>
                <label>
                  <span>Phone</span>
                  <input
                    value={customerForm.phone}
                    onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })}
                  />
                </label>
                <button className="primary-button" type="submit">
                  Add customer
                </button>
              </form>
            </Section>

            <Section title="Loyalty Profiles">
              <Table
                columns={[
                  { key: 'name', label: 'Customer' },
                  { key: 'email', label: 'Email' },
                  { key: 'tier', label: 'Tier' },
                  { key: 'loyaltyPoints', label: 'Points' }
                ]}
                rows={state.bootstrap.customers}
              />
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'procurement' ? (
          <div className="stack">
            <Section title="Purchase Orders and Stock Replenishment">
              <form
                className="form-grid compact-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  runMutation(
                    () =>
                      apiRequest('/api/purchase-orders', {
                        method: 'POST',
                        token: session.token,
                        body: {
                          supplierName: purchaseOrderForm.supplierName,
                          items: [
                            {
                              productId: purchaseOrderForm.productId,
                              quantity: purchaseOrderForm.quantity,
                              cost: purchaseOrderForm.cost
                            }
                          ]
                        }
                      }).then(() =>
                        setPurchaseOrderForm({
                          supplierName: '',
                          productId: state.bootstrap.products[0]?.id || '',
                          quantity: 1,
                          cost: 0
                        })
                      ),
                    'Purchase order created.'
                  );
                }}
              >
                <label>
                  <span>Supplier</span>
                  <input
                    value={purchaseOrderForm.supplierName}
                    onChange={(event) =>
                      setPurchaseOrderForm({ ...purchaseOrderForm, supplierName: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Product</span>
                  <select
                    value={purchaseOrderForm.productId}
                    onChange={(event) =>
                      setPurchaseOrderForm({ ...purchaseOrderForm, productId: event.target.value })
                    }
                  >
                    {state.bootstrap.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    value={purchaseOrderForm.quantity}
                    onChange={(event) =>
                      setPurchaseOrderForm({ ...purchaseOrderForm, quantity: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Unit cost</span>
                  <input
                    type="number"
                    value={purchaseOrderForm.cost}
                    onChange={(event) =>
                      setPurchaseOrderForm({ ...purchaseOrderForm, cost: Number(event.target.value) })
                    }
                  />
                </label>
                <button className="primary-button" type="submit" disabled={!canManage}>
                  Create PO
                </button>
              </form>
            </Section>

            <Section title="Receiving Queue">
              <Table
                columns={[
                  { key: 'supplierName', label: 'Supplier' },
                  { key: 'status', label: 'Status' },
                  { key: 'totalCost', label: 'Cost', render: (row) => currency(row.totalCost) },
                  {
                    key: 'receive',
                    label: 'Action',
                    render: (row) =>
                      row.status === 'pending' && canManage ? (
                        <button
                          className="ghost-button"
                          onClick={() =>
                            runMutation(
                              () =>
                                apiRequest(`/api/purchase-orders/${row.id}/receive`, {
                                  method: 'POST',
                                  token: session.token
                                }),
                              'Purchase order received and stock updated.'
                            )
                          }
                        >
                          Receive
                        </button>
                      ) : (
                        'Received'
                      )
                  }
                ]}
                rows={state.bootstrap.purchaseOrders}
              />
            </Section>
          </div>
        ) : null}

        {state.activeTab === 'audit' && canManage ? (
          <Section title="Audit Trail">
            <Table
              columns={[
                { key: 'timestamp', label: 'When' },
                { key: 'module', label: 'Module' },
                { key: 'action', label: 'Action' },
                { key: 'actorId', label: 'Actor' }
              ]}
              rows={state.bootstrap.auditLogs}
            />
          </Section>
        ) : null}
      </main>
    </div>
  );
}

export default App;