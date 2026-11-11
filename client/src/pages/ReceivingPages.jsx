import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiRequest, buildQuery } from '../api';
import { useAction, useApi, useDebouncedValue, usePagination } from '../lib/hooks';
import { count, formatDateTime, isDecimalUnit, money, qty } from '../lib/format';
import { Alert, DataTable, Drawer, EmptyState, Feedback, Field, Loading, PageHeader, Pagination, Panel, SearchInput, StatusBadge, Toolbar } from '../components/ui';
import Icon from '../components/Icon';

export function ReceivingListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebouncedValue(search);
  const list = useApi(`/stock-receiving${buildQuery({ search: debouncedSearch, supplier_id: supplierId })}`, { areas: ['receiving'], select: (body) => body.data.receiving });
  const suppliers = useApi('/suppliers', { areas: ['suppliers'], select: (body) => body.data.suppliers });
  const detail = useApi(selected ? `/stock-receiving/${selected}` : null, { select: (body) => body.data.receiving });
  const rows = list.data || [];
  const pagination = usePagination(rows, 15);
  const flash = useLocation().state?.flash;

  const columns = [
    { key: 'receiving_number', header: 'Delivery', primary: true, render: (row) => <span className="cell-stack"><strong>{row.receiving_number}</strong><small>{formatDateTime(row.receiving_date)}</small></span> },
    { key: 'supplier_name', header: 'Supplier' },
    { key: 'reference_number', header: 'Reference', render: (row) => row.reference_number || '—', hideOnMobile: true },
    { key: 'item_count', header: 'Items', align: 'right', render: (row) => count(row.item_count) },
    { key: 'received_by_name', header: 'Received by', hideOnMobile: true },
    { key: 'total_cost', header: 'Total cost', align: 'right', render: (row) => <strong>{money(row.total_cost)}</strong> }
  ];
  const itemColumns = [
    { key: 'product_name', header: 'Product', primary: true, render: (item) => <span className="cell-stack"><strong>{item.product_name}</strong><small>{item.product_code}</small></span> },
    { key: 'quantity', header: 'Quantity', align: 'right', render: (item) => `${qty(item.quantity)} ${item.unit || ''}` },
    { key: 'unit_cost', header: 'Unit cost', align: 'right', render: (item) => money(item.unit_cost) },
    { key: 'subtotal', header: 'Amount', align: 'right', render: (item) => <strong>{money(item.subtotal)}</strong> }
  ];

  return (
    <div className="page">
      <PageHeader title="Stock Receiving" description="Deliveries from suppliers. Each one adds stock and is logged." actions={<Link className="btn btn-primary" to="/stock-receiving/new"><Icon name="plus" size={16} />New delivery</Link>} />
      <Alert tone="success">{flash}</Alert>
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search delivery, reference, supplier" />
        <select aria-label="Supplier" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
          <option value="">All suppliers</option>
          {(suppliers.data || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}
        </select>
      </Toolbar>
      <Alert>{list.error}</Alert>
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={list.loading} onRowClick={(row) => setSelected(row.id)} caption="Deliveries"
          empty={<EmptyState title="No deliveries recorded" description="Record the first delivery to add stock." action={<button type="button" className="btn btn-primary" onClick={() => navigate('/stock-receiving/new')}>New delivery</button>} />}
        />
        <Pagination {...pagination} />
      </Panel>

      <Drawer open={Boolean(selected)} title={detail.data?.receiving_number || 'Delivery'} description={detail.data ? `${detail.data.supplier_name} · ${formatDateTime(detail.data.receiving_date)}` : ''} onClose={() => setSelected(null)} size="lg">
        {detail.loading && !detail.data ? <Loading /> : detail.data && (
          <>
            <dl className="summary-list">
              <div><dt>Received by</dt><dd>{detail.data.received_by_name}</dd></div>
              <div><dt>Supplier reference</dt><dd>{detail.data.reference_number || '—'}</dd></div>
              <div><dt>Status</dt><dd><StatusBadge status={detail.data.status} /></dd></div>
            </dl>
            <DataTable columns={itemColumns} rows={detail.data.items} rowKey="product_id" caption="Delivered items" />
            <dl className="summary-list">
              <div className="summary-grand"><dt>Total cost</dt><dd>{money(detail.data.total_cost)}</dd></div>
            </dl>
          </>
        )}
        <Alert>{detail.error}</Alert>
      </Drawer>
    </div>
  );
}

export function NewReceivingPage() {
  const navigate = useNavigate();
  const suppliers = useApi('/suppliers?status=Active', { select: (body) => body.data.suppliers });
  const products = useApi('/products?status=Active', { areas: ['products'], select: (body) => body.data.products });
  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState({ productId: '', quantity: '', unitCost: '' });
  const action = useAction();
  const productList = products.data || [];
  const draftProduct = productList.find((product) => String(product.id) === draft.productId);
  const total = lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_cost), 0);

  function chooseProduct(productId) {
    const product = productList.find((item) => String(item.id) === productId);
    setDraft({ productId, quantity: draft.quantity, unitCost: product ? String(Number(product.cost_price)) : '' });
  }

  function addLine(event) {
    event.preventDefault();
    action.setError('');
    if (!draftProduct) return action.setError('Choose a product.');
    if (lines.some((line) => line.product_id === draftProduct.id)) return action.setError(`${draftProduct.product_name} is already on this delivery. Edit its row instead.`);
    const quantity = Number(draft.quantity);
    const unitCost = Number(draft.unitCost);
    if (!(quantity > 0)) return action.setError('Quantity must be greater than zero.');
    if (!isDecimalUnit(draftProduct.unit) && !Number.isInteger(quantity)) return action.setError(`Quantity must be a whole number of ${draftProduct.unit}.`);
    if (draft.unitCost === '' || !(unitCost >= 0)) return action.setError('Unit cost must be zero or more.');
    setLines([...lines, { product_id: draftProduct.id, product_name: draftProduct.product_name, unit: draftProduct.unit, quantity, unit_cost: unitCost }]);
    setDraft({ productId: '', quantity: '', unitCost: '' });
    return undefined;
  }

  function updateLine(productId, field, value) {
    setLines(lines.map((line) => (line.product_id === productId ? { ...line, [field]: value } : line)));
  }

  async function submit() {
    if (!supplierId) return action.setError('Choose the supplier for this delivery.');
    if (!lines.length) return action.setError('Add at least one product.');
    const bad = lines.find((line) => !(Number(line.quantity) > 0) || !(Number(line.unit_cost) >= 0));
    if (bad) return action.setError(`Check the quantity and cost for ${bad.product_name}.`);
    const result = await action.run(() => apiRequest('/stock-receiving', {
      method: 'POST',
      body: JSON.stringify({ supplier_id: Number(supplierId), reference_number: reference.trim() || undefined, items: lines.map((line) => ({ product_id: line.product_id, quantity: Number(line.quantity), unit_cost: Number(line.unit_cost) })) })
    }));
    if (result) navigate('/stock-receiving', { state: { flash: `Delivery ${result.data.receiving.receiving_number} saved: ${money(result.data.receiving.total_cost)} of stock received.` } });
    return undefined;
  }

  if ((suppliers.loading && !suppliers.data) || (products.loading && !products.data)) {
    return <div className="page"><PageHeader title="New delivery" back={{ to: '/stock-receiving', label: 'Stock receiving' }} /><Loading /></div>;
  }

  return (
    <div className="page">
      <PageHeader title="New delivery" description="Record what arrived. Stock is added when you save." back={{ to: '/stock-receiving', label: 'Stock receiving' }} />
      <Feedback error={action.error || suppliers.error || products.error} />
      <div className="receiving-layout">
        <Panel title="Delivery details">
          <div className="form-grid">
            <Field label="Supplier">
              <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                <option value="">Select supplier</option>
                {(suppliers.data || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}
              </select>
            </Field>
            <Field label="Delivery receipt / invoice no." hint="Optional"><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={100} placeholder="e.g. DR-10482" /></Field>
          </div>
          <form className="add-line-form" onSubmit={addLine}>
            <h4>Add item</h4>
            <Field label="Product">
              <select value={draft.productId} onChange={(event) => chooseProduct(event.target.value)}>
                <option value="">Select product</option>
                {productList.map((product) => <option key={product.id} value={product.id}>{product.product_name} ({qty(product.stock_quantity)} {product.unit} on hand)</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label={`Quantity${draftProduct ? ` (${draftProduct.unit})` : ''}`}><input type="number" inputMode="decimal" min="0" step={draftProduct && isDecimalUnit(draftProduct.unit) ? '0.001' : '1'} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></Field>
              <Field label="Unit cost (₱)"><input type="number" inputMode="decimal" min="0" step="0.01" value={draft.unitCost} onChange={(event) => setDraft({ ...draft, unitCost: event.target.value })} /></Field>
            </div>
            <button type="submit" className="btn btn-secondary btn-block"><Icon name="plus" size={16} />Add to delivery</button>
          </form>
        </Panel>

        <Panel title={`Items (${lines.length})`}>
          {lines.length === 0 ? <EmptyState title="No items yet" description="Add the products that came in this delivery." /> : (
            <ul className="line-list">
              {lines.map((line) => (
                <li key={line.product_id}>
                  <div className="line-list-name"><strong>{line.product_name}</strong><small>{money(Number(line.quantity) * Number(line.unit_cost))}</small></div>
                  <label className="mini-field"><span>Qty ({line.unit})</span><input type="number" inputMode="decimal" min="0" value={line.quantity} onChange={(event) => updateLine(line.product_id, 'quantity', event.target.value)} /></label>
                  <label className="mini-field"><span>Cost (₱)</span><input type="number" inputMode="decimal" min="0" step="0.01" value={line.unit_cost} onChange={(event) => updateLine(line.product_id, 'unit_cost', event.target.value)} /></label>
                  <button type="button" className="icon-button" onClick={() => setLines(lines.filter((item) => item.product_id !== line.product_id))} aria-label={`Remove ${line.product_name}`}><Icon name="trash" size={16} /></button>
                </li>
              ))}
            </ul>
          )}
          <dl className="order-totals">
            <div className="order-grand"><dt>Total cost</dt><dd>{money(total)}</dd></div>
          </dl>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={submit} disabled={action.busy || !lines.length}>{action.busy ? 'Saving…' : 'Save delivery'}</button>
        </Panel>
      </div>
    </div>
  );
}
