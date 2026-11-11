import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildQuery } from '../api';
import { useApi, useDebouncedValue, usePagination } from '../lib/hooks';
import { count, daysAgo, formatDate, formatDateTime, inputDate, money, qty, titleCase } from '../lib/format';
import { Alert, DataTable, PageHeader, Pagination, Panel, SearchInput, StatCard, StatusBadge, Toolbar } from '../components/ui';
import Icon from '../components/Icon';
import { DateRange } from './SalesPages';
import { MovementQuantity } from './InventoryPage';

const reports = {
  sales: {
    label: 'Sales', dates: true, category: true, status: ['Completed', 'Cancelled', 'Pending'],
    summary: [['totalTransactions', 'Sales counted', 'count'], ['grossSales', 'Gross sales', 'money'], ['discounts', 'Discounts', 'money'], ['netSales', 'Net sales', 'money']],
    columns: [
      ['sale_number', 'Sale', 'text', true], ['sale_date', 'Date', 'datetime'], ['employee_name', 'Cashier', 'text'],
      ['subtotal', 'Subtotal', 'money'], ['discount', 'Discount', 'money'], ['total_amount', 'Total', 'money'], ['sale_status', 'Status', 'status']
    ],
    note: 'Totals count completed sales unless you pick a status.'
  },
  'product-sales': {
    label: 'Product sales', dates: true, category: true,
    summary: [['quantitySold', 'Units sold', 'qty'], ['revenue', 'Revenue', 'money']],
    columns: [['product_name', 'Product', 'text', true], ['quantity_sold', 'Quantity sold', 'qty'], ['revenue', 'Revenue', 'money']],
    note: 'Completed sales only, best sellers first.'
  },
  inventory: {
    label: 'Inventory valuation', category: true,
    summary: [['inventoryValue', 'Inventory value at cost', 'money']],
    columns: [
      ['product_name', 'Product', 'text', true], ['category_name', 'Category', 'text'], ['stock_quantity', 'On hand', 'qty'], ['reorder_level', 'Reorder at', 'qty'],
      ['cost_price', 'Cost', 'money'], ['selling_price', 'Price', 'money'], ['inventory_value', 'Value', 'money'], ['stock_status', 'Status', 'status']
    ],
    note: 'A snapshot of current stock. Date filters do not apply.'
  },
  'stock-receiving': {
    label: 'Stock receiving', dates: true, supplier: true,
    summary: [['totalTransactions', 'Deliveries', 'count'], ['totalCost', 'Total cost', 'money']],
    columns: [['receiving_number', 'Delivery', 'text', true], ['receiving_date', 'Date', 'datetime'], ['supplier_name', 'Supplier', 'text'], ['employee_name', 'Received by', 'text'], ['total_cost', 'Total cost', 'money'], ['status', 'Status', 'status']]
  },
  payments: {
    label: 'Payments', dates: true, method: true, status: ['Paid', 'Cancelled', 'Refunded', 'Pending'],
    summary: [['total', 'Total collected', 'money'], ['Cash', 'Cash', 'money'], ['GCash', 'GCash', 'money'], ['Bank Transfer', 'Bank transfer', 'money'], ['Other', 'Other', 'money']],
    columns: [['sale_number', 'Sale', 'text', true], ['payment_date', 'Date', 'datetime'], ['payment_method', 'Method', 'text'], ['reference_number', 'Reference', 'text'], ['amount', 'Amount', 'money'], ['payment_status', 'Status', 'status']],
    note: 'Totals count paid payments unless you pick a status.'
  },
  suppliers: {
    label: 'Suppliers', dates: true, supplier: true,
    summary: [['supplierCount', 'Suppliers', 'count'], ['receivingCount', 'Deliveries', 'count'], ['totalSupplyCost', 'Total supply cost', 'money']],
    columns: [['supplier_name', 'Supplier', 'text', true], ['status', 'Status', 'status'], ['receiving_count', 'Deliveries', 'count'], ['total_supply_cost', 'Supply cost', 'money'], ['last_receiving_date', 'Last delivery', 'date']]
  }
};

const formatters = {
  money, qty, count, datetime: formatDateTime, date: formatDate,
  text: (value) => (value === null || value === undefined || value === '' ? '—' : String(value)),
  status: (value) => value
};

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function ReportsPage() {
  const [type, setType] = useState('sales');
  const [range, setRange] = useState({ preset: '30d', from: daysAgo(29), to: inputDate() });
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const config = reports[type];
  const categories = useApi('/categories', { select: (body) => body.data.categories });
  const suppliers = useApi('/suppliers', { select: (body) => body.data.suppliers });
  const query = buildQuery({
    date_from: config.dates ? range.from : '', date_to: config.dates ? range.to : '',
    category_id: config.category ? categoryId : '', supplier_id: config.supplier ? supplierId : '',
    payment_method: config.method ? method : '', status: config.status ? status : ''
  });
  const { data, loading, error } = useApi(`/reports/${type}${query}`, { areas: ['reports'], select: (body) => body.data });
  const rows = data?.rows || [];
  const pagination = usePagination(rows, 20);

  function changeType(next) {
    setType(next);
    setStatus('');
  }

  function exportCsv() {
    const header = config.columns.map(([, label]) => label);
    const lines = rows.map((row) => config.columns.map(([key, , kind]) => csvCell(kind === 'datetime' || kind === 'date' ? (row[key] ? new Date(row[key]).toISOString() : '') : row[key])).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${type}-report${config.dates && range.from ? `-${range.from}` : ''}${config.dates && range.to ? `-to-${range.to}` : ''}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const columns = config.columns.map(([key, header, kind, primary]) => ({
    key, header, primary,
    align: ['money', 'qty', 'count'].includes(kind) ? 'right' : undefined,
    render: (row) => (kind === 'status' ? <StatusBadge status={row[key]} /> : primary ? <strong>{formatters[kind](row[key])}</strong> : formatters[kind](row[key]))
  }));

  return (
    <div className="page">
      <PageHeader
        title="Reports"
        description="Sales, stock, payments, and supplier activity."
        actions={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()} disabled={!rows.length}><Icon name="print" size={16} />Print</button>
            <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} />Export CSV</button>
          </>
        )}
      />
      <div className="tab-row no-print" role="tablist" aria-label="Report type">
        {Object.entries(reports).map(([key, report]) => (
          <button type="button" role="tab" key={key} aria-selected={type === key} className={`tab${type === key ? ' is-active' : ''}`} onClick={() => changeType(key)}>{report.label}</button>
        ))}
      </div>
      <Toolbar>
        {config.dates && <DateRange {...range} onChange={setRange} />}
        {config.category && (
          <select aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">All categories</option>
            {(categories.data || []).map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}
          </select>
        )}
        {config.supplier && (
          <select aria-label="Supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">All suppliers</option>
            {(suppliers.data || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}
          </select>
        )}
        {config.method && (
          <select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="">All methods</option>
            {['Cash', 'GCash', 'Bank Transfer', 'Other'].map((name) => <option key={name}>{name}</option>)}
          </select>
        )}
        {config.status && (
          <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any status</option>
            {config.status.map((name) => <option key={name}>{name}</option>)}
          </select>
        )}
      </Toolbar>
      <Alert>{error}</Alert>
      <div className="print-only report-print-title"><strong>{config.label} report</strong><span>{config.dates && (range.from || range.to) ? `${range.from ? formatDate(range.from) : 'Start'} to ${range.to ? formatDate(range.to) : 'today'}` : `As of ${formatDateTime(new Date())}`}</span></div>
      {data?.summary && (
        <div className={`stat-grid stat-grid-${Math.min(config.summary.length, 5)} compact`}>
          {config.summary.map(([key, label, kind], index) => <StatCard key={key} label={label} value={formatters[kind](data.summary[key])} tone={index === 0 ? 'accent' : 'neutral'} />)}
        </div>
      )}
      {config.note && <p className="muted small">{config.note}</p>}
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} rowKey={(row, index) => row.id ?? row.product_code ?? `${row.sale_number || row.product_name}-${index}`} loading={loading} caption={`${config.label} report`} />
        <Pagination {...pagination} />
      </Panel>
    </div>
  );
}

const transactionTypes = [['', 'All movements'], ['SALE', 'Sales'], ['SALE_CANCELLED', 'Cancelled sales'], ['STOCK_RECEIVING', 'Stock receiving'], ['ADJUSTMENT', 'Adjustments']];

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [productId, setProductId] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const products = useApi('/products', { select: (body) => body.data.products });
  const { data, loading, error } = useApi(`/audit${buildQuery({ search: debouncedSearch, transaction_type: type, product_id: productId })}`, { areas: ['inventory-history'], select: (body) => body.data.logs });
  const rows = data || [];
  const pagination = usePagination(rows, 25);

  const reference = (log) => {
    if (log.reference_type === 'SALE') return <Link to={`/sales/${log.reference_id}`}>Sale #{log.reference_id}</Link>;
    if (log.reference_type === 'STOCK_RECEIVING') return `Delivery #${log.reference_id}`;
    return 'Manual adjustment';
  };

  const columns = [
    { key: 'product_name', header: 'Product', primary: true, render: (log) => <span className="cell-stack"><strong>{log.product_name}</strong><small>{formatDateTime(log.created_at)}</small></span> },
    { key: 'transaction_type', header: 'Movement', render: (log) => <StatusBadge status={log.transaction_type} label={titleCase(log.transaction_type)} /> },
    { key: 'quantity', header: 'Change', align: 'right', render: (log) => <MovementQuantity value={log.quantity} unit={log.unit} /> },
    { key: 'stock', header: 'Stock', align: 'right', render: (log) => `${qty(log.previous_stock)} → ${qty(log.new_stock)}` },
    { key: 'reference', header: 'Reference', render: (log) => <span className="cell-stack"><span>{reference(log)}</span>{log.reason && <small>{log.reason}</small>}</span> },
    { key: 'performed_by', header: 'By', render: (log) => <span className="cell-stack"><span>{log.performed_by}</span><small>@{log.username}</small></span> }
  ];

  return (
    <div className="page">
      <PageHeader title="Audit Trail" description="Every stock movement, who made it, and why." />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search product, reason, or person" />
        <select aria-label="Movement type" value={type} onChange={(event) => setType(event.target.value)}>
          {transactionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="Product" value={productId} onChange={(event) => setProductId(event.target.value)}>
          <option value="">All products</option>
          {(products.data || []).map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}
        </select>
      </Toolbar>
      <Alert>{error}</Alert>
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={loading} caption="Audit trail" />
        <Pagination {...pagination} />
      </Panel>
      {rows.length >= 1000 && <p className="muted small">Showing the latest 1,000 movements. Use the filters to narrow the list.</p>}
    </div>
  );
}
