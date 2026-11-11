import { useState } from 'react';
import { apiRequest, buildQuery } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAction, useApi, useDebouncedValue, usePagination } from '../lib/hooks';
import { can } from '../lib/roles';
import { count, money, qty } from '../lib/format';
import { DataTable, Drawer, Feedback, Field, PageHeader, Pagination, Panel, SearchInput, StatusBadge, Toolbar } from '../components/ui';
import Icon from '../components/Icon';

function StatusFilter({ value, onChange }) {
  return (
    <select aria-label="Status" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All statuses</option>
      <option>Active</option>
      <option>Inactive</option>
    </select>
  );
}

/** Shared create/edit/toggle wiring for the three master-data screens. */
function useMasterRecords(resource, label) {
  const action = useAction();
  const [editing, setEditing] = useState(null);
  async function save(form, id) {
    const result = await action.run(
      () => apiRequest(id ? `/${resource}/${id}` : `/${resource}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(form) }),
      id ? `${label} updated.` : `${label} created.`
    );
    if (result) setEditing(null);
  }
  async function toggle(row, name) {
    const status = row.status === 'Active' ? 'Inactive' : 'Active';
    if (status === 'Inactive' && !window.confirm(`Deactivate ${name}? It will be hidden from new transactions.`)) return;
    await action.run(() => apiRequest(`/${resource}/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }), `${name} ${status === 'Active' ? 'activated' : 'deactivated'}.`);
  }
  return { action, editing, setEditing, save, toggle };
}

function RowActions({ row, onEdit, onToggle }) {
  return (
    <div className="row-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(row)}><Icon name="edit" size={14} />Edit</button>
      <button type="button" className={`btn btn-sm ${row.status === 'Active' ? 'btn-ghost danger' : 'btn-secondary'}`} onClick={() => onToggle(row)}>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
    </div>
  );
}

function FormDrawer({ open, title, onClose, onSubmit, busy, error, children, submitLabel }) {
  return (
    <Drawer
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="master-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </>
      )}
    >
      <form id="master-form" className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
        {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
        {children}
      </form>
    </Drawer>
  );
}

const formObject = (data) => Object.fromEntries(data.entries());

// ---- Products ------------------------------------------------------------------------------------
export function ProductsPage() {
  const { user } = useAuth();
  const manage = can.manageCatalog(user);
  const showCost = can.viewCosts(user);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState(manage ? '' : 'Active');
  const [lowOnly, setLowOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const products = useApi(`/products${buildQuery({ search: debouncedSearch, category_id: categoryId, status, low_stock: lowOnly ? 'true' : '' })}`, { areas: ['products'], select: (body) => body.data.products });
  const categories = useApi('/categories', { areas: ['categories'], select: (body) => body.data.categories });
  const { action, editing, setEditing, save, toggle } = useMasterRecords('products', 'Product');
  const rows = products.data || [];
  const pagination = usePagination(rows, 15);
  const activeCategories = (categories.data || []).filter((category) => category.status === 'Active' || String(category.id) === String(editing?.category_id));

  const columns = [
    { key: 'product_name', header: 'Product', primary: true, render: (row) => <span className="cell-stack"><strong>{row.product_name}</strong><small>{row.product_code}</small></span> },
    { key: 'category_name', header: 'Category' },
    { key: 'selling_price', header: 'Price', align: 'right', render: (row) => <strong>{money(row.selling_price)}</strong> },
    ...(showCost ? [{ key: 'cost_price', header: 'Cost', align: 'right', render: (row) => money(row.cost_price), hideOnMobile: true }] : []),
    { key: 'stock_quantity', header: 'Stock', align: 'right', render: (row) => <span className={Number(row.is_low_stock) ? 'text-warning' : ''}>{qty(row.stock_quantity)} {row.unit}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(manage ? [{ key: 'actions', header: 'Actions', actions: true, render: (row) => <RowActions row={row} onEdit={setEditing} onToggle={(item) => toggle(item, item.product_name)} /> }] : [])
  ];

  function submit(data) {
    save(formObject(data), editing?.id);
  }

  const margin = editing ? Number(editing.selling_price || 0) - Number(editing.cost_price || 0) : 0;

  return (
    <div className="page">
      <PageHeader title="Products" description="Everything sold at the counter, with live stock levels." actions={manage && <button type="button" className="btn btn-primary" onClick={() => setEditing({ unit: 'piece' })}><Icon name="plus" size={16} />Add product</button>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or code" />
        <select aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {(categories.data || []).map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}
        </select>
        <StatusFilter value={status} onChange={setStatus} />
        <label className="check"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />Low stock only</label>
      </Toolbar>
      <Feedback error={products.error || action.error} message={action.message} />
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={products.loading} caption="Products" />
        <Pagination {...pagination} />
      </Panel>
      {!manage && <p className="muted small">Product details can be changed by a Manager or the Owner.</p>}

      <FormDrawer open={Boolean(editing)} title={editing?.id ? `Edit ${editing.product_name}` : 'New product'} onClose={() => { setEditing(null); action.setError(''); }} onSubmit={submit} busy={action.busy} error={action.error} submitLabel={editing?.id ? 'Save changes' : 'Create product'}>
        {editing && (
          <>
            <div className="form-row">
              <Field label="Product code"><input name="product_code" defaultValue={editing.product_code} required maxLength={30} /></Field>
              <Field label="Unit" hint="piece, kg, cup, bottle…"><input name="unit" defaultValue={editing.unit} list="unit-options" maxLength={30} /></Field>
            </div>
            <datalist id="unit-options">{['piece', 'kg', 'cup', 'bottle', 'can', 'pack', 'stick', 'tray', 'glass', 'bundle'].map((unit) => <option key={unit} value={unit} />)}</datalist>
            <Field label="Product name"><input name="product_name" defaultValue={editing.product_name} required maxLength={120} /></Field>
            <Field label="Category">
              <select name="category_id" defaultValue={editing.category_id || ''} required>
                <option value="">Select category</option>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="Cost price (₱)"><input name="cost_price" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={editing.cost_price} required onChange={(event) => setEditing({ ...editing, cost_price: event.target.value })} /></Field>
              <Field label="Selling price (₱)"><input name="selling_price" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={editing.selling_price} required onChange={(event) => setEditing({ ...editing, selling_price: event.target.value })} /></Field>
            </div>
            {editing.cost_price !== undefined && editing.selling_price !== undefined && (
              <p className={`muted small ${margin < 0 ? 'text-danger' : ''}`}>Margin per {editing.unit || 'unit'}: {money(margin)}</p>
            )}
            <Field label="Reorder level" hint="Warn when stock falls to this level"><input name="reorder_level" type="number" inputMode="decimal" min="0" step="0.001" defaultValue={editing.reorder_level ?? 0} required /></Field>
            <Field label="Description"><textarea name="description" defaultValue={editing.description || ''} rows={3} maxLength={255} /></Field>
            {editing.id && <p className="muted small">Stock changes only through sales, stock receiving, and inventory adjustments.</p>}
          </>
        )}
      </FormDrawer>
    </div>
  );
}

// ---- Categories ------------------------------------------------------------------------------------
export function CategoriesPage() {
  const { user } = useAuth();
  const manage = can.manageCatalog(user);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const categories = useApi(`/categories${buildQuery({ search: debouncedSearch, status })}`, { areas: ['categories', 'products'], select: (body) => body.data.categories });
  const { action, editing, setEditing, save, toggle } = useMasterRecords('categories', 'Category');
  const rows = categories.data || [];

  const columns = [
    { key: 'category_name', header: 'Category', primary: true, render: (row) => <strong>{row.category_name}</strong> },
    { key: 'description', header: 'Description', render: (row) => row.description || '—' },
    { key: 'product_count', header: 'Products', align: 'right', render: (row) => count(row.product_count) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(manage ? [{ key: 'actions', header: 'Actions', actions: true, render: (row) => <RowActions row={row} onEdit={setEditing} onToggle={(item) => toggle(item, item.category_name)} /> }] : [])
  ];

  return (
    <div className="page">
      <PageHeader title="Categories" description="How products are grouped on the menu and in reports." actions={manage && <button type="button" className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Add category</button>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories" />
        <StatusFilter value={status} onChange={setStatus} />
      </Toolbar>
      <Feedback error={categories.error || action.error} message={action.message} />
      <Panel padded={false}>
        <DataTable columns={columns} rows={rows} loading={categories.loading} caption="Categories" />
      </Panel>
      <FormDrawer open={Boolean(editing)} title={editing?.id ? `Edit ${editing.category_name}` : 'New category'} onClose={() => { setEditing(null); action.setError(''); }} onSubmit={(data) => save(formObject(data), editing?.id)} busy={action.busy} error={action.error} submitLabel={editing?.id ? 'Save changes' : 'Create category'}>
        {editing && (
          <>
            <Field label="Category name"><input name="category_name" defaultValue={editing.category_name} required maxLength={100} /></Field>
            <Field label="Description"><textarea name="description" defaultValue={editing.description || ''} rows={3} maxLength={255} /></Field>
          </>
        )}
      </FormDrawer>
    </div>
  );
}

// ---- Suppliers ------------------------------------------------------------------------------------
export function SuppliersPage() {
  const { user } = useAuth();
  const manage = can.manageCatalog(user);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const suppliers = useApi(`/suppliers${buildQuery({ search: debouncedSearch, status })}`, { areas: ['suppliers'], select: (body) => body.data.suppliers });
  const { action, editing, setEditing, save, toggle } = useMasterRecords('suppliers', 'Supplier');
  const rows = suppliers.data || [];

  const columns = [
    { key: 'supplier_name', header: 'Supplier', primary: true, render: (row) => <span className="cell-stack"><strong>{row.supplier_name}</strong><small>{row.supplier_code}</small></span> },
    { key: 'contact_person', header: 'Contact', render: (row) => row.contact_person || '—' },
    { key: 'phone', header: 'Phone', render: (row) => (row.phone ? <a href={`tel:${row.phone.replaceAll(' ', '')}`}>{row.phone}</a> : '—') },
    { key: 'address', header: 'Address', render: (row) => row.address || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(manage ? [{ key: 'actions', header: 'Actions', actions: true, render: (row) => <RowActions row={row} onEdit={setEditing} onToggle={(item) => toggle(item, item.supplier_name)} /> }] : [])
  ];

  return (
    <div className="page">
      <PageHeader title="Suppliers" description="Who delivers chickens, meat, drinks, and provisions." actions={manage && <button type="button" className="btn btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={16} />Add supplier</button>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or code" />
        <StatusFilter value={status} onChange={setStatus} />
      </Toolbar>
      <Feedback error={suppliers.error || action.error} message={action.message} />
      <Panel padded={false}>
        <DataTable columns={columns} rows={rows} loading={suppliers.loading} caption="Suppliers" />
      </Panel>
      <FormDrawer open={Boolean(editing)} title={editing?.id ? `Edit ${editing.supplier_name}` : 'New supplier'} onClose={() => { setEditing(null); action.setError(''); }} onSubmit={(data) => save(formObject(data), editing?.id)} busy={action.busy} error={action.error} submitLabel={editing?.id ? 'Save changes' : 'Create supplier'}>
        {editing && (
          <>
            <div className="form-row">
              <Field label="Supplier code"><input name="supplier_code" defaultValue={editing.supplier_code} required maxLength={30} /></Field>
              <Field label="Phone"><input name="phone" type="tel" defaultValue={editing.phone || ''} maxLength={30} /></Field>
            </div>
            <Field label="Supplier name"><input name="supplier_name" defaultValue={editing.supplier_name} required maxLength={120} /></Field>
            <Field label="Contact person"><input name="contact_person" defaultValue={editing.contact_person || ''} maxLength={120} /></Field>
            <Field label="Address"><textarea name="address" defaultValue={editing.address || ''} rows={2} maxLength={255} /></Field>
          </>
        )}
      </FormDrawer>
    </div>
  );
}
