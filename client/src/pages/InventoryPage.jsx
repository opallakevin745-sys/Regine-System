import { useMemo, useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAction, useApi, usePagination } from '../lib/hooks';
import { can } from '../lib/roles';
import { count, formatDateTime, isDecimalUnit, qty, titleCase } from '../lib/format';
import { DataTable, Drawer, EmptyState, Feedback, Field, Loading, PageHeader, Pagination, Panel, SearchInput, Segmented, StatCard, StatusBadge, Toolbar } from '../components/ui';
import Icon from '../components/Icon';

const reasons = ['Spoilage', 'Damaged item', 'Physical count correction', 'Staff meal', 'Returned to supplier', 'Found during count'];

export function MovementQuantity({ value, unit }) {
  const number = Number(value);
  return <span className={number < 0 ? 'text-danger' : 'text-success'}>{number > 0 ? '+' : ''}{qty(number)} {unit || ''}</span>;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const canAdjust = can.adjustStock(user);
  const { data, loading, error } = useApi('/inventory', { areas: ['inventory'], select: (body) => body.data.inventory });
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [historyFor, setHistoryFor] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [form, setForm] = useState({ direction: 'decrease', quantity: '', reason: reasons[0], note: '' });
  const action = useAction();

  const all = data || [];
  const active = all.filter((row) => row.status === 'Active');
  const rows = useMemo(() => all.filter((row) => (showInactive || row.status === 'Active')
    && (stockFilter === 'all' || row.stock_status === stockFilter)
    && `${row.product_name} ${row.product_code}`.toLowerCase().includes(search.trim().toLowerCase())), [all, showInactive, stockFilter, search]);
  const pagination = usePagination(rows, 20);
  const history = useApi(historyFor ? `/inventory/${historyFor.id}/logs` : null, { areas: ['inventory-history'], select: (body) => body.data });

  function openAdjust(row) {
    action.setError('');
    action.setMessage('');
    setForm({ direction: 'decrease', quantity: '', reason: reasons[0], note: '' });
    setAdjusting(row);
  }

  const amount = Number(form.quantity);
  const signed = form.direction === 'increase' ? amount : -amount;
  const projected = adjusting ? Number(adjusting.stock_quantity) + (Number.isFinite(signed) ? signed : 0) : 0;

  async function submitAdjustment(event) {
    event.preventDefault();
    if (!(amount > 0)) return action.setError('Enter a quantity greater than zero.');
    if (!isDecimalUnit(adjusting.unit) && !Number.isInteger(amount)) return action.setError(`Quantity must be a whole number of ${adjusting.unit}.`);
    if (projected < 0) return action.setError('This would make stock negative.');
    const reason = [form.reason, form.note.trim()].filter(Boolean).join(': ');
    const result = await action.run(
      () => apiRequest('/inventory/adjustments', { method: 'POST', body: JSON.stringify({ product_id: adjusting.id, quantity: signed, reason }) }),
      (response) => `${adjusting.product_name}: stock adjusted from ${qty(response.data.adjustment.previous_stock)} to ${qty(response.data.adjustment.new_stock)} ${adjusting.unit}.`
    );
    if (result) setAdjusting(null);
    return undefined;
  }

  const columns = [
    { key: 'product_name', header: 'Product', primary: true, render: (row) => <span className="cell-stack"><strong>{row.product_name}</strong><small>{row.product_code}{row.status !== 'Active' ? ' · inactive' : ''}</small></span> },
    { key: 'category_name', header: 'Category' },
    { key: 'stock_quantity', header: 'On hand', align: 'right', render: (row) => <strong>{qty(row.stock_quantity)} {row.unit}</strong> },
    { key: 'reorder_level', header: 'Reorder at', align: 'right', render: (row) => `${qty(row.reorder_level)} ${row.unit}` },
    { key: 'stock_status', header: 'Status', render: (row) => <StatusBadge status={row.stock_status} /> },
    {
      key: 'actions', header: 'Actions', actions: true,
      render: (row) => (
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistoryFor(row)}><Icon name="history" size={14} />History</button>
          {canAdjust && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAdjust(row)}><Icon name="adjust" size={14} />Adjust</button>}
        </div>
      )
    }
  ];

  const historyColumns = [
    { key: 'created_at', header: 'Date', primary: true, render: (log) => <span className="cell-stack"><strong>{titleCase(log.transaction_type)}</strong><small>{formatDateTime(log.created_at)}</small></span> },
    { key: 'quantity', header: 'Change', align: 'right', render: (log) => <MovementQuantity value={log.quantity} /> },
    { key: 'stock', header: 'Stock', align: 'right', render: (log) => `${qty(log.previous_stock)} → ${qty(log.new_stock)}` },
    { key: 'performed_by', header: 'By', render: (log) => <span className="cell-stack"><span>{log.performed_by}</span>{log.reason && <small>{log.reason}</small>}</span> }
  ];

  return (
    <div className="page">
      <PageHeader title="Inventory" description="Stock on hand, reorder warnings, and every stock movement." />
      <Feedback error={error} message={action.message} onClear={() => action.setMessage('')} />
      <div className="stat-grid stat-grid-4 compact">
        <StatCard label="Active products" value={count(active.length)} />
        <StatCard label="In stock" value={count(active.filter((row) => row.stock_status === 'In Stock').length)} />
        <StatCard label="Low stock" value={count(active.filter((row) => row.stock_status === 'Low Stock').length)} tone={active.some((row) => row.stock_status === 'Low Stock') ? 'warning' : 'neutral'} hint="At or below reorder level" />
        <StatCard label="Out of stock" value={count(active.filter((row) => row.stock_status === 'Out of Stock').length)} tone={active.some((row) => row.stock_status === 'Out of Stock') ? 'critical' : 'neutral'} hint="Needs restocking" />
      </div>
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search products" />
        <Segmented label="Stock status" value={stockFilter} onChange={setStockFilter} options={[['all', 'All'], ['In Stock', 'In stock'], ['Low Stock', 'Low'], ['Out of Stock', 'Out']]} />
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Show inactive</label>
      </Toolbar>
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={loading} caption="Inventory" />
        <Pagination {...pagination} />
      </Panel>

      <Drawer open={Boolean(historyFor)} title={historyFor ? `${historyFor.product_name} history` : ''} description={historyFor ? `On hand: ${qty(historyFor.stock_quantity)} ${historyFor.unit}` : ''} onClose={() => setHistoryFor(null)} size="lg">
        {history.loading && !history.data ? <Loading label="Loading movements…" /> : history.data?.logs?.length ? (
          <DataTable columns={historyColumns} rows={history.data.logs} caption="Stock movements" />
        ) : <EmptyState title="No stock movements yet" />}
      </Drawer>

      <Drawer
        open={Boolean(adjusting)}
        title={adjusting ? `Adjust ${adjusting.product_name}` : ''}
        description="Use for spoilage, damage, or count corrections. Every adjustment is recorded in the audit trail."
        onClose={() => setAdjusting(null)}
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setAdjusting(null)}>Cancel</button>
            <button type="submit" form="adjust-form" className="btn btn-primary" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save adjustment'}</button>
          </>
        )}
      >
        {adjusting && (
          <form id="adjust-form" className="form-grid" onSubmit={submitAdjustment}>
            {action.error && <div className="alert alert-error" role="alert"><Icon name="alert" size={16} /><span>{action.error}</span></div>}
            <Segmented label="Direction" value={form.direction} onChange={(direction) => setForm({ ...form, direction })} options={[['decrease', 'Remove stock'], ['increase', 'Add stock']]} />
            <Field label={`Quantity (${adjusting.unit})`}>
              <input type="number" inputMode="decimal" min="0" step={isDecimalUnit(adjusting.unit) ? '0.001' : '1'} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
            </Field>
            <Field label="Reason">
              <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>
                {reasons.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </Field>
            <Field label="Note (optional)"><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={150} placeholder="What happened?" /></Field>
            <dl className="summary-list">
              <div><dt>Current stock</dt><dd>{qty(adjusting.stock_quantity)} {adjusting.unit}</dd></div>
              <div className="summary-grand"><dt>After adjustment</dt><dd className={projected < 0 ? 'text-danger' : ''}>{qty(projected)} {adjusting.unit}</dd></div>
            </dl>
          </form>
        )}
      </Drawer>
    </div>
  );
}
