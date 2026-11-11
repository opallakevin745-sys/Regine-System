import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest, buildQuery } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAction, useApi, useDebouncedValue, usePagination } from '../lib/hooks';
import { can } from '../lib/roles';
import { count, daysAgo, formatDateTime, inputDate, money, qty } from '../lib/format';
import { Alert, DataTable, Feedback, Loading, PageHeader, Pagination, Panel, SearchInput, Segmented, StatCard, StatusBadge, Toolbar } from '../components/ui';
import Receipt from '../components/Receipt';
import Icon from '../components/Icon';

export const datePresets = [
  ['today', 'Today', () => [inputDate(), inputDate()]],
  ['7d', '7 days', () => [daysAgo(6), inputDate()]],
  ['30d', '30 days', () => [daysAgo(29), inputDate()]],
  ['all', 'All', () => ['', '']]
];

export function DateRange({ preset, from, to, onChange }) {
  return (
    <div className="date-range">
      <Segmented label="Date range" value={preset} onChange={(value) => { const [nextFrom, nextTo] = datePresets.find(([key]) => key === value)[2](); onChange({ preset: value, from: nextFrom, to: nextTo }); }} options={datePresets.map(([key, label]) => [key, label])} />
      <div className="date-inputs">
        <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(event) => onChange({ preset: 'custom', from: event.target.value, to })} />
        <span aria-hidden="true">–</span>
        <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(event) => onChange({ preset: 'custom', from, to: event.target.value })} />
      </div>
    </div>
  );
}

export function SalesHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ preset: '7d', from: daysAgo(6), to: inputDate() });
  const debouncedSearch = useDebouncedValue(search);
  const { data, loading, error } = useApi(`/sales${buildQuery({ search: debouncedSearch, status, from: range.from, to: range.to })}`, { areas: ['sales'], select: (body) => body.data.sales });
  const rows = data || [];
  const pagination = usePagination(rows, 15);
  const completed = rows.filter((sale) => sale.sale_status === 'Completed');
  const completedTotal = completed.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

  const columns = [
    { key: 'sale_number', header: 'Sale', primary: true, render: (sale) => <span className="cell-stack"><Link to={`/sales/${sale.id}`}><strong>{sale.sale_number}</strong></Link><small>{formatDateTime(sale.sale_date)}</small></span> },
    { key: 'employee_name', header: 'Cashier' },
    { key: 'item_count', header: 'Items', align: 'right', render: (sale) => count(sale.item_count) },
    { key: 'payment_method', header: 'Payment', render: (sale) => sale.payment_method || '—' },
    { key: 'total_amount', header: 'Total', align: 'right', render: (sale) => <strong className={sale.sale_status === 'Cancelled' ? 'is-struck' : ''}>{money(sale.total_amount)}</strong> },
    { key: 'sale_status', header: 'Status', render: (sale) => <StatusBadge status={sale.sale_status} /> }
  ];

  return (
    <div className="page">
      <PageHeader title="Sales History" description="Every sale recorded at the counter." actions={can.sell(user) && <Link className="btn btn-primary" to="/sales/new"><Icon name="pos" size={16} />New sale</Link>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search sale no. or cashier" />
        <select aria-label="Sale status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option>Completed</option>
          <option>Cancelled</option>
          <option>Pending</option>
        </select>
        <DateRange {...range} onChange={setRange} />
      </Toolbar>
      <Alert>{error}</Alert>
      <div className="stat-grid stat-grid-3 compact">
        <StatCard label="Sales found" value={count(rows.length)} hint={rows.length >= 200 ? 'Showing the latest 200' : 'Matching the filters'} />
        <StatCard label="Completed sales total" value={money(completedTotal)} hint={`${count(completed.length)} completed`} tone="accent" />
        <StatCard label="Cancelled" value={count(rows.length - completed.length)} hint="Stock was restored" />
      </div>
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={loading} onRowClick={(sale) => navigate(`/sales/${sale.id}`)} caption="Sales" />
        <Pagination {...pagination} />
      </Panel>
    </div>
  );
}

export function SaleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: sale, loading, error, reload } = useApi(`/sales/${id}`, { areas: ['sales'], select: (body) => body.data.sale });
  const action = useAction();

  async function cancelSale() {
    if (!window.confirm(`Cancel sale ${sale.sale_number}? Stock will be restored and the payment marked cancelled.`)) return;
    const result = await action.run(() => apiRequest(`/sales/${sale.id}/cancel`, { method: 'PATCH' }), 'Sale cancelled and inventory restored.');
    if (result) reload();
  }

  if (!sale) {
    return (
      <div className="page">
        <PageHeader title="Sale details" back={{ to: '/sales', label: 'Sales history' }} />
        <Alert>{error}</Alert>
        {loading && <Loading label="Loading sale…" />}
      </div>
    );
  }

  const columns = [
    { key: 'product_name', header: 'Product', primary: true, render: (item) => <span className="cell-stack"><strong>{item.product_name}</strong><small>{item.product_code}</small></span> },
    { key: 'quantity', header: 'Quantity', align: 'right', render: (item) => `${qty(item.quantity)} ${item.unit || ''}` },
    { key: 'unit_price', header: 'Unit price', align: 'right', render: (item) => money(item.unit_price) },
    { key: 'subtotal', header: 'Amount', align: 'right', render: (item) => <strong>{money(item.subtotal)}</strong> }
  ];

  return (
    <div className="page">
      <PageHeader
        title={sale.sale_number}
        description={`${formatDateTime(sale.sale_date)} · recorded by ${sale.employee_name}`}
        back={{ to: '/sales', label: 'Sales history' }}
        actions={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} />Print receipt</button>
            {sale.sale_status === 'Completed' && can.cancelSale(user) && (
              <button type="button" className="btn btn-danger" onClick={cancelSale} disabled={action.busy}>{action.busy ? 'Cancelling…' : 'Cancel sale'}</button>
            )}
          </>
        )}
      />
      <Feedback error={action.error} message={action.message} />
      <div className="detail-grid">
        <Panel title="Items" padded={false} className="no-print">
          <DataTable columns={columns} rows={sale.items} caption="Sale items" />
        </Panel>
        <Panel title="Summary" className="no-print">
          <dl className="summary-list">
            <div><dt>Status</dt><dd><StatusBadge status={sale.sale_status} /></dd></div>
            <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
            <div><dt>Discount</dt><dd>{Number(sale.discount) > 0 ? `−${money(sale.discount)}` : money(0)}</dd></div>
            <div className="summary-grand"><dt>Total</dt><dd>{money(sale.total_amount)}</dd></div>
            <div><dt>Payment</dt><dd>{sale.payment_method} · <StatusBadge status={sale.payment_status} /></dd></div>
            <div><dt>Amount received</dt><dd>{money(sale.amount_tendered ?? sale.payment_amount)}</dd></div>
            <div><dt>Change given</dt><dd>{money(sale.change_amount)}</dd></div>
            {sale.reference_number && <div><dt>Reference no.</dt><dd>{sale.reference_number}</dd></div>}
          </dl>
          {sale.sale_status === 'Completed' && !can.cancelSale(user) && <p className="muted small">Need to void this sale? Ask a Manager or the Owner to cancel it.</p>}
        </Panel>
        <div className="print-only"><Receipt sale={sale} /></div>
      </div>
    </div>
  );
}
