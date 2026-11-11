import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest, onDataChanged } from '../api';
import { useAuth } from '../context/AuthContext';

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const emptyForms = { categories: { category_name: '', description: '' }, products: { product_code: '', product_name: '', category_id: '', description: '', unit: 'piece', cost_price: '', selling_price: '', reorder_level: '' }, suppliers: { supplier_code: '', supplier_name: '', contact_person: '', phone: '', address: '' } };

function PageFrame({ title, action, children }) { return <section className="operation-page"><div className="page-heading"><div><h2>{title}</h2></div>{action}</div>{children}</section>; }
function Feedback({ error, message }) { return <>{error && <div className="inline-error">{error}</div>}{message && <div className="inline-success">{message}</div>}</>; }

export function CrudPage({ mode }) {
  const labels = { categories: ['CATEGORIES', 'Categories', 'category_name'], products: ['CATALOG', 'Products', 'product_name'], suppliers: ['PARTNERS', 'Suppliers', 'supplier_name'] };
  const [eyebrow, title] = labels[mode];
  const [rows, setRows] = useState([]); const [categories, setCategories] = useState([]); const [loading, setLoading] = useState(true); const [categoriesLoading, setCategoriesLoading] = useState(false); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [editing, setEditing] = useState(null); const [formOpen, setFormOpen] = useState(false); const [form, setForm] = useState(emptyForms[mode]);
  async function load(searchValue = '') { setLoading(true); setError(''); try { const response = await apiRequest(`/${mode}?search=${encodeURIComponent(searchValue)}`); setRows(response.data[mode]); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [mode]);
  useEffect(() => {
    if (mode !== 'products') return;
    setCategoriesLoading(true);
    apiRequest('/categories?status=Active').then((response) => setCategories(response.data.categories)).catch((requestError) => setError(requestError.message)).finally(() => setCategoriesLoading(false));
  }, [mode]);
  useEffect(() => mode === 'products' ? onDataChanged(['products'], () => load(search)) : undefined, [mode, search]);
  function updateField(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  function beginEdit(row) { setEditing(row.id); setFormOpen(true); setForm({ ...emptyForms[mode], ...row, category_id: row.category_id || '' }); setMessage(''); }
  function reset() { setEditing(null); setFormOpen(false); setForm(emptyForms[mode]); }
  async function submit(event) { event.preventDefault(); setError(''); setMessage(''); try { await apiRequest(editing ? `/${mode}/${editing}` : `/${mode}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) }); setMessage(editing ? 'Record updated.' : 'Record created.'); reset(); await load(search); } catch (requestError) { setError(requestError.message); } }
  async function toggle(row) { setError(''); setMessage(''); try { const status = row.status === 'Active' ? 'Inactive' : 'Active'; await apiRequest(`/${mode}/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setMessage(`Record ${status.toLowerCase()}.`); await load(search); } catch (requestError) { setError(requestError.message); } }
  return <PageFrame eyebrow={eyebrow} title={title} action={<button className="small-primary" onClick={() => { reset(); setFormOpen(true); setMessage(''); }}>+ Add {mode === 'categories' ? 'category' : mode === 'products' ? 'product' : 'supplier'}</button>}><Feedback error={error} message={message} /><div className="operation-layout"><div className="table-panel"><div className="table-toolbar"><input value={search} placeholder={`Search ${title.toLowerCase()}...`} onChange={(event) => { const value = event.target.value; setSearch(value); load(value); }} /></div>{loading ? <div className="empty-state">Loading records...</div> : rows.length === 0 ? <div className="empty-state"><strong>No {title.toLowerCase()} found.</strong></div> : <div className="table-scroll"><table><thead><tr>{mode === 'categories' ? <><th>Name</th><th>Description</th></> : mode === 'products' ? <><th>Code</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th></> : <><th>Code</th><th>Supplier</th><th>Contact</th><th>Phone</th></>}<th>Status</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{mode === 'categories' ? <><td><strong>{row.category_name}</strong></td><td>{row.description || '—'}</td></> : mode === 'products' ? <><td>{row.product_code}</td><td><strong>{row.product_name}</strong></td><td>{row.category_name}</td><td>{money(row.selling_price)}</td><td><span className={row.is_low_stock ? 'stock-warning' : ''}>{row.stock_quantity} {row.unit}</span></td></> : <><td>{row.supplier_code}</td><td><strong>{row.supplier_name}</strong></td><td>{row.contact_person || '—'}</td><td>{row.phone || '—'}</td></>}<td><span className={`status-badge ${row.status.toLowerCase()}`}>{row.status}</span></td><td className="row-actions"><button onClick={() => beginEdit(row)}>Edit</button><button onClick={() => toggle(row)}>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}</div>{formOpen ? <form className="form-panel" onSubmit={submit}><div className="panel-title"><h3>{editing ? 'Edit record' : 'New record'}</h3><button type="button" onClick={reset}>×</button></div>{mode === 'categories' && <><Field label="Category name" name="category_name" value={form.category_name} onChange={updateField} /><Field label="Description" name="description" value={form.description} onChange={updateField} /></>}{mode === 'products' && <><Field label="Product code" name="product_code" value={form.product_code} onChange={updateField} /><Field label="Product name" name="product_name" value={form.product_name} onChange={updateField} /><label>Category<select name="category_id" value={form.category_id} onChange={updateField}><option value="">Select category</option>{categoriesLoading ? <option value="">Loading categories...</option> : categories.map((category) => <option key={category.id} value={category.id}>{category.category_name}</option>)}</select></label><Field label="Unit" name="unit" value={form.unit} onChange={updateField} /><div className="form-two"><Field label="Cost price" name="cost_price" type="number" value={form.cost_price} onChange={updateField} /><Field label="Selling price" name="selling_price" type="number" value={form.selling_price} onChange={updateField} /></div><Field label="Reorder level" name="reorder_level" type="number" value={form.reorder_level} onChange={updateField} /><Field label="Description" name="description" value={form.description} onChange={updateField} /></>}{mode === 'suppliers' && <><Field label="Supplier code" name="supplier_code" value={form.supplier_code} onChange={updateField} /><Field label="Supplier name" name="supplier_name" value={form.supplier_name} onChange={updateField} /><Field label="Contact person" name="contact_person" value={form.contact_person} onChange={updateField} /><Field label="Phone" name="phone" value={form.phone} onChange={updateField} /><Field label="Address" name="address" value={form.address} onChange={updateField} /></>}<button className="primary-button" type="submit">{editing ? 'Save changes' : 'Create record'}<span>→</span></button></form> : null}</div></PageFrame>;
}

function Field({ label, name, value, onChange, type = 'text' }) { return <label>{label}<input name={name} type={type} value={value ?? ''} onChange={onChange} /></label>; }

export function InventoryPage() {
  const { user } = useAuth();
  const canAdjust = ['Owner', 'Manager'].includes(user?.role);
  const [rows, setRows] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [logs, setLogs] = useState(null); const [selectedProduct, setSelectedProduct] = useState(null); const [logsLoading, setLogsLoading] = useState(false); const [adjustingProduct, setAdjustingProduct] = useState(null); const [direction, setDirection] = useState('increase'); const [adjustmentAmount, setAdjustmentAmount] = useState(''); const [adjustmentReason, setAdjustmentReason] = useState(''); const [adjustmentResult, setAdjustmentResult] = useState(null); const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  async function load() { setLoading(true); try { const response = await apiRequest('/inventory'); setRows(response.data.inventory); setError(''); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }
  async function showLogs(product) { setSelectedProduct(product); setLogsLoading(true); setError(''); try { const response = await apiRequest(`/inventory/${product.id}/logs`); setLogs(response.data); } catch (requestError) { setError(requestError.message); } finally { setLogsLoading(false); } }
  function openAdjustment(product) { setAdjustingProduct(product); setDirection('increase'); setAdjustmentAmount(''); setAdjustmentReason(''); setAdjustmentResult(null); setError(''); }
  async function submitAdjustment(event) {
    event.preventDefault();
    const amount = Number(adjustmentAmount);
    if (!adjustingProduct || !Number.isFinite(amount) || amount <= 0) { setError('Enter an adjustment quantity greater than zero.'); return; }
    if (!adjustmentReason.trim()) { setError('Provide a reason for this adjustment.'); return; }
    setError(''); setAdjustmentResult(null); setAdjustmentLoading(true);
    try {
      const quantity = direction === 'increase' ? amount : -amount;
      const response = await apiRequest('/inventory/adjustments/', { method: 'POST', body: JSON.stringify({ product_id: adjustingProduct.id, quantity, reason: adjustmentReason.trim() }) });
      setAdjustmentResult(response.data.adjustment);
      setAdjustingProduct((product) => product ? { ...product, stock_quantity: response.data.adjustment.new_stock } : product);
      setSelectedProduct(adjustingProduct);
      await load();
      await showLogs(adjustingProduct);
    } catch (requestError) { setError(requestError.message); }
    finally { setAdjustmentLoading(false); }
  }
  useEffect(() => { load(); return onDataChanged(['inventory'], () => { load(); if (selectedProduct) showLogs(selectedProduct); }); }, [selectedProduct]);
  return <PageFrame eyebrow="STOCK CONTROL" title="Inventory"><Feedback error={error} />
    <div className="table-panel"><div className="table-toolbar"><span>Stock levels and reorder signals</span></div>{loading ? <div className="empty-state">Loading inventory...</div> : rows.length === 0 ? <div className="empty-state">No inventory records found.</div> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Reorder level</th><th>Stock status</th><th>History</th>{canAdjust && <th>Adjustment</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.product_name}</strong><small className="cell-subtitle">{row.product_code}</small></td><td>{row.category_name}</td><td>{row.stock_quantity} {row.unit}</td><td>{row.reorder_level}</td><td><span className={`status-badge ${row.stock_status.replaceAll(' ', '-').toLowerCase()}`}>{row.stock_status}</span></td><td><button className="text-button" onClick={() => showLogs(row)}>View history</button></td>{canAdjust && <td><button className="text-button" onClick={() => openAdjustment(row)}>Adjust stock</button></td>}</tr>)}</tbody></table></div>}</div>
    {adjustingProduct && <div className="detail-panel"><div className="panel-title"><h3>Adjust {adjustingProduct.product_name}</h3><button type="button" onClick={() => { setAdjustingProduct(null); setAdjustmentResult(null); }}>×</button></div><p>Current stock: <strong>{adjustingProduct.stock_quantity} {adjustingProduct.unit}</strong></p>{adjustmentResult ? <div className="inline-success" role="status">Stock adjusted from {adjustmentResult.previous_stock} to {adjustmentResult.new_stock} {adjustingProduct.unit}. {adjustmentResult.reason}</div> : <form className="form-panel" onSubmit={submitAdjustment}><div className="adjustment-directions" role="group" aria-label="Adjustment direction"><button className={`adjustment-direction ${direction === 'increase' ? 'is-selected increase' : ''}`} type="button" aria-pressed={direction === 'increase'} onClick={() => setDirection('increase')}>Increase</button><button className={`adjustment-direction ${direction === 'decrease' ? 'is-selected decrease' : ''}`} type="button" aria-pressed={direction === 'decrease'} onClick={() => setDirection('decrease')}>Decrease</button></div><label>Quantity<input type="number" min="0.001" step="0.001" value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} required /></label><label>Reason<input value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength="255" required /></label><button className="primary-button" type="submit" disabled={adjustmentLoading}>{adjustmentLoading ? 'Saving adjustment...' : `Submit ${direction}`}<span>→</span></button></form>}</div>}
    {logs && <div className="detail-panel"><div className="panel-title"><h3>{logs.product.product_name} history</h3><button onClick={() => { setLogs(null); setSelectedProduct(null); }}>×</button></div>{logsLoading ? <div className="empty-state">Loading inventory history...</div> : logs.logs.length ? <div className="table-scroll"><table><thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Stock change</th><th>Performed by</th></tr></thead><tbody>{logs.logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td>{log.transaction_type}</td><td className={Number(log.quantity) < 0 ? 'negative' : 'positive'}>{log.quantity}</td><td>{log.previous_stock} → {log.new_stock}</td><td>{log.performed_by}</td></tr>)}</tbody></table></div> : <div className="empty-state">No inventory movements recorded.</div>}</div>}
  </PageFrame>;
}

export function SalesPage() {
  const { id } = useParams(); const { user } = useAuth(); const [products, setProducts] = useState([]); const [sales, setSales] = useState([]); const [detail, setDetail] = useState(null); const [cart, setCart] = useState([]); const [selected, setSelected] = useState(''); const [quantity, setQuantity] = useState(1); const [paymentMethod, setPaymentMethod] = useState('Cash'); const [paymentAmount, setPaymentAmount] = useState(''); const [discount, setDiscount] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [submitting, setSubmitting] = useState(false); const [cancelling, setCancelling] = useState(false); const submissionLock = useRef(false); const cancellationLock = useRef(false);
  async function load() { try { const [productResponse, salesResponse] = await Promise.all([apiRequest('/products?status=Active'), apiRequest('/sales')]); setProducts(productResponse.data.products); setSales(salesResponse.data.sales); } catch (requestError) { setError(requestError.message); } }
  async function loadDetail() { if (!id) return; try { const response = await apiRequest(`/sales/${id}`); setDetail(response.data.sale); setError(''); } catch (requestError) { setError(requestError.message); } }
  useEffect(() => {
    setDetail(null);
    load();
    loadDetail();
    return onDataChanged(['products', 'sales'], () => { load(); loadDetail(); });
  }, [id]);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.selling_price) * Number(item.quantity), 0); const total = Math.max(0, subtotal - Number(discount || 0));
  function addToCart() {
    setError('');
    const product = products.find((item) => String(item.id) === String(selected));
    const requestedQuantity = Number(quantity);
    if (!product) return setError('Select an active product.');
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) return setError('Quantity must be greater than zero.');
    const existing = cart.find((item) => item.id === product.id);
    if (Number(product.stock_quantity) < requestedQuantity + Number(existing?.quantity || 0)) return setError(`Insufficient stock for ${product.product_name}.`);
    setCart((current) => existing ? current.map((item) => item.id === product.id ? { ...item, quantity: Number(item.quantity) + requestedQuantity } : item) : [...current, { ...product, quantity: requestedQuantity }]);
    setSelected(''); setQuantity(1);
  }
  async function completeSale() {
    if (submissionLock.current) return;
    setError(''); setMessage('');
    if (!cart.length) return setError('Add at least one product to the sale.');
    if (cart.some((item) => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0 || Number(item.quantity) > Number(item.stock_quantity))) return setError('Check the quantities against current product stock.');
    const discountAmount = Number(discount || 0);
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) return setError('Discount must be zero or less than the subtotal.');
    const paidAmount = Number(paymentAmount);
    if (String(paymentAmount).trim() === '' || !Number.isFinite(paidAmount) || paidAmount < total) return setError('Payment amount must cover the sale total.');
    submissionLock.current = true; setSubmitting(true);
    try {
      const response = await apiRequest('/sales', { method: 'POST', body: JSON.stringify({ items: cart.map((item) => ({ product_id: item.id, quantity: item.quantity })), discount: discountAmount, payment: { amount: paidAmount, payment_method: paymentMethod } }) });
      setMessage(`Sale ${response.data.sale.sale_number} (ID ${response.data.sale.id}) completed.`); setCart([]); setPaymentAmount(''); setDiscount(''); await load();
    } catch (requestError) { setError(requestError.message); }
    finally { submissionLock.current = false; setSubmitting(false); }
  }
  async function cancel() {
    if (cancellationLock.current || !detail || detail.sale_status !== 'Completed') return;
    if (!window.confirm('Cancel this completed sale and restore inventory?')) return;
    cancellationLock.current = true; setCancelling(true); setError(''); setMessage('');
    try {
      await apiRequest(`/sales/${detail.id}/cancel`, { method: 'PATCH' });
      setMessage('Sale cancelled and inventory restored.');
      await loadDetail();
      await load();
    } catch (requestError) { setError(requestError.message); }
    finally { cancellationLock.current = false; setCancelling(false); }
  }
  if (detail) return <PageFrame eyebrow="SALE DETAIL" title={detail.sale_number}><Link className="back-link" to="/sales">← Back to sales</Link><Feedback error={error} message={message} /><div className="detail-panel"><div className="detail-summary"><span>Sale ID <strong>{detail.id}</strong></span><span>Recorded by <strong>{detail.employee_name}</strong></span><span>{new Date(detail.sale_date).toLocaleString()}</span><span className={`status-badge ${detail.sale_status.toLowerCase()}`}>{detail.sale_status}</span>{detail.sale_status === 'Completed' && ['Owner', 'Manager'].includes(user?.role) && <button className="small-danger" onClick={cancel} disabled={cancelling}>{cancelling ? 'Cancelling...' : 'Cancel sale'}</button>}</div><DataRows rows={detail.items.map((item) => [item.product_name, `${item.quantity} × ${money(item.unit_price)}`, money(item.subtotal)])} /><div className="totals"><span>Subtotal {money(detail.subtotal)}</span><span>Discount {money(detail.discount)}</span><strong>Total {money(detail.total_amount)}</strong><span>Paid via {detail.payment_method} {money(detail.payment_amount)} · {detail.payment_status}</span></div></div></PageFrame>;
  return <PageFrame eyebrow="SALES & PAYMENTS" title="Sales"><Feedback error={error} message={message} /><div className="sales-layout"><div className="pos-panel"><h3>New sale</h3><div className="add-line"><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.product_name} · {money(product.selling_price)} · {product.stock_quantity} in stock</option>)}</select><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><button className="small-primary" onClick={addToCart}>Add</button></div>{cart.length === 0 ? <div className="empty-state">Add products to begin a sale.</div> : <div className="cart-list">{cart.map((item) => <div className="cart-line" key={item.id}><span><strong>{item.product_name}</strong><small>{item.quantity} × {money(item.selling_price)}</small></span><strong>{money(Number(item.selling_price) * Number(item.quantity))}</strong><button onClick={() => setCart(cart.filter((line) => line.id !== item.id))}>×</button></div>)}</div>}<div className="sale-total"><span>Subtotal <strong>{money(subtotal)}</strong></span><label>Discount<input type="number" min="0" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><strong>Total {money(total)}</strong></div><div className="payment-line"><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select><input type="number" min="0" placeholder="Amount paid" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /><button className="primary-button" onClick={completeSale} disabled={!cart.length || submitting}>Complete sale <span>→</span></button></div>{Number(paymentAmount) >= total && cart.length > 0 && <div className="change-note">Change due: <strong>{money(Number(paymentAmount) - total)}</strong></div>}</div><div className="table-panel"><div className="panel-title"><h3>Sales history</h3><span>Latest 200</span></div>{sales.length === 0 ? <div className="empty-state">No sales recorded yet.</div> : <div className="table-scroll"><table><thead><tr><th>Sale</th><th>Date</th><th>Total</th><th>Payment</th><th></th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>{sale.sale_number}</strong><small className="cell-subtitle">{sale.employee_name}</small></td><td>{new Date(sale.sale_date).toLocaleDateString()}</td><td>{money(sale.total_amount)}</td><td>{sale.payment_method || '—'}</td><td><Link className="text-button" to={`/sales/${sale.id}`}>View</Link></td></tr>)}</tbody></table></div>}</div></div></PageFrame>;
}

function DataRows({ rows }) { return <div className="detail-items">{rows.map((row, index) => <div key={index}><strong>{row[0]}</strong><span>{row[1]}</span><b>{row[2]}</b></div>)}</div>; }

export function ReceivingPage() {
  const [suppliers, setSuppliers] = useState([]); const [products, setProducts] = useState([]); const [receiving, setReceiving] = useState([]); const [supplierId, setSupplierId] = useState(''); const [selected, setSelected] = useState(''); const [quantity, setQuantity] = useState(1); const [unitCost, setUnitCost] = useState(''); const [items, setItems] = useState([]); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false);
  async function load() { setLoading(true); try { const [supplierResponse, productResponse, receivingResponse] = await Promise.all([apiRequest('/suppliers?status=Active'), apiRequest('/products?status=Active'), apiRequest('/stock-receiving')]); setSuppliers(supplierResponse.data.suppliers); setProducts(productResponse.data.products); setReceiving(receivingResponse.data.receiving); setError(''); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }
  useEffect(() => { load(); return onDataChanged(['receiving', 'products'], load); }, []);
  function addItem() {
    setError(''); setMessage('');
    if (!suppliers.some((supplier) => String(supplier.id) === String(supplierId))) return setError('Select a valid active supplier.');
    const product = products.find((item) => String(item.id) === String(selected));
    if (!product) return setError('Select a valid active product.');
    if (items.some((item) => item.product_id === product.id)) return setError('A product can only be added once per receiving.');
    const amount = Number(quantity); const cost = Number(unitCost);
    if (String(quantity).trim() === '' || !Number.isFinite(amount) || amount <= 0) return setError('Quantity must be greater than zero.');
    if (String(unitCost).trim() === '' || !Number.isFinite(cost) || cost < 0) return setError('Unit cost must be zero or greater.');
    setItems([...items, { product_id: product.id, product_name: product.product_name, quantity: amount, unit_cost: cost }]); setSelected(''); setQuantity(1); setUnitCost('');
  }
  async function submit() {
    if (submitting) return;
    setError(''); setMessage('');
    if (!suppliers.some((supplier) => String(supplier.id) === String(supplierId))) return setError('Select a valid active supplier.');
    if (!items.length || items.some((item) => !products.some((product) => product.id === item.product_id))) return setError('Add valid active products before completing receiving.');
    setSubmitting(true);
    try { const response = await apiRequest('/stock-receiving', { method: 'POST', body: JSON.stringify({ supplier_id: supplierId, items: items.map(({ product_id, quantity, unit_cost }) => ({ product_id, quantity, unit_cost })) }) }); setMessage(`Receiving ${response.data.receiving.receiving_number} completed.`); setItems([]); setSupplierId(''); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }
  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  if (submitting) return <PageFrame eyebrow="INBOUND STOCK" title="Stock receiving"><Feedback error={error} message={message} /><div className="empty-state">Saving stock receiving...</div></PageFrame>;
  if (loading) return <PageFrame eyebrow="INBOUND STOCK" title="Stock receiving"><Feedback error={error} message={message} /><div className="empty-state">Loading receiving, suppliers, and active products...</div></PageFrame>;
  return <PageFrame eyebrow="INBOUND STOCK" title="Stock receiving"><Feedback error={error} message={message} /><div className="receiving-layout"><div className="pos-panel"><h3>New receiving</h3><label>Supplier<select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Select supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.supplier_name}</option>)}</select></label><div className="add-line"><select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.product_name}</option>)}</select><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" /><input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="Cost" /><button className="small-primary" onClick={addItem}>Add</button></div>{items.length ? <div className="cart-list">{items.map((item, index) => <div className="cart-line" key={`${item.product_id}-${index}`}><span><strong>{item.product_name}</strong><small>{item.quantity} × {money(item.unit_cost)}</small></span><strong>{money(item.quantity * item.unit_cost)}</strong><button onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div> : <div className="empty-state">Add received products to begin.</div>}<div className="sale-total"><strong>Total cost {money(total)}</strong></div><button className="primary-button" disabled={!supplierId || !items.length} onClick={submit}>Complete receiving <span>→</span></button></div><div className="table-panel"><div className="panel-title"><h3>Receiving history</h3><span>Latest 200</span></div>{receiving.length === 0 ? <div className="empty-state">No receiving records yet.</div> : <div className="table-scroll"><table><thead><tr><th>Receiving</th><th>Supplier</th><th>Date</th><th>Total cost</th></tr></thead><tbody>{receiving.map((row) => <tr key={row.id}><td><strong>{row.receiving_number}</strong></td><td>{row.supplier_name}</td><td>{new Date(row.receiving_date).toLocaleDateString()}</td><td>{money(row.total_cost)}</td></tr>)}</tbody></table></div>}</div></div></PageFrame>;
}

export function PaymentsPage() {
  const [rows, setRows] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { const response = await apiRequest('/payments'); setRows(response.data.payments); setError(''); } catch (requestError) { setError(requestError.message); } finally { setLoading(false); } }
  useEffect(() => { load(); return onDataChanged(['payments'], load); }, []);
  return <PageFrame eyebrow="PAYMENT RECORDS" title="Payments"><Feedback error={error} /><div className="table-panel">{loading ? <div className="empty-state">Loading payments...</div> : rows.length === 0 ? <div className="empty-state">No payments recorded yet.</div> : <div className="table-scroll"><table><thead><tr><th>Sale</th><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.sale_number}</td><td>{new Date(row.payment_date).toLocaleString()}</td><td>{row.payment_method}</td><td>{money(row.amount)}</td><td><span className="status-badge paid">{row.payment_status}</span></td></tr>)}</tbody></table></div>}</div></PageFrame>;
}
