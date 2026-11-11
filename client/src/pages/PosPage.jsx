import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api';
import { useApi } from '../lib/hooks';
import { isDecimalUnit, money, plural, qty } from '../lib/format';
import { Alert, Drawer, EmptyState, Loading, PageHeader, SearchInput, Segmented } from '../components/ui';
import Receipt from '../components/Receipt';
import Icon from '../components/Icon';

const methods = ['Cash', 'GCash', 'Bank Transfer', 'Other'];
const stepFor = (unit) => (isDecimalUnit(unit) ? 0.25 : 1);
const roundQty = (value) => Math.round(value * 1000) / 1000;

export default function PosPage() {
  const products = useApi('/products?status=Active', { areas: ['products'], select: (body) => body.data.products });
  const categories = useApi('/categories?status=Active', { areas: ['categories'], select: (body) => body.data.categories });
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [cart, setCart] = useState([]);
  const [discountMode, setDiscountMode] = useState('none');
  const [customDiscount, setCustomDiscount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const submitLock = useRef(false);
  const orderRef = useRef(null);

  const productList = products.data || [];
  // Keep cart stock figures current after another sale or delivery reloads the catalog.
  useEffect(() => {
    if (!products.data) return;
    setCart((current) => current.map((line) => {
      const fresh = products.data.find((product) => product.id === line.id);
      return fresh ? { ...line, stock_quantity: fresh.stock_quantity, selling_price: fresh.selling_price } : line;
    }));
  }, [products.data]);

  const visibleProducts = useMemo(() => productList.filter((product) => (categoryId === 'all' || String(product.category_id) === categoryId)
    && (`${product.product_name} ${product.product_code}`.toLowerCase().includes(search.trim().toLowerCase()))), [productList, categoryId, search]);

  const subtotal = cart.reduce((sum, line) => sum + Number(line.selling_price) * (Number(line.quantity) || 0), 0);
  const discount = discountMode === 'senior' ? Math.round(subtotal * 20) / 100 : discountMode === 'custom' ? Number(customDiscount || 0) : 0;
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  const paid = method === 'Cash' ? Number(tendered || 0) : total;
  const change = paid - total;

  function add(product) {
    const step = stepFor(product.unit);
    const existing = cart.find((line) => line.id === product.id);
    const nextQuantity = roundQty((Number(existing?.quantity) || 0) + step);
    if (nextQuantity > Number(product.stock_quantity)) {
      setError(`Only ${qty(product.stock_quantity)} ${product.unit} of ${product.product_name} in stock.`);
      return;
    }
    setError('');
    setCart(existing
      ? cart.map((line) => (line.id === product.id ? { ...line, quantity: nextQuantity } : line))
      : [...cart, { id: product.id, product_name: product.product_name, unit: product.unit, selling_price: product.selling_price, stock_quantity: product.stock_quantity, quantity: step }]);
  }

  function setQuantity(id, value) {
    setCart((current) => current.map((line) => (line.id === id ? { ...line, quantity: value } : line)));
  }

  function nudge(line, direction) {
    const next = roundQty((Number(line.quantity) || 0) + direction * stepFor(line.unit));
    if (next <= 0) return setCart((current) => current.filter((item) => item.id !== line.id));
    if (next > Number(line.stock_quantity)) return setError(`Only ${qty(line.stock_quantity)} ${line.unit} of ${line.product_name} in stock.`);
    setError('');
    return setQuantity(line.id, next);
  }

  function clearOrder() {
    setCart([]);
    setDiscountMode('none');
    setCustomDiscount('');
    setTendered('');
    setReference('');
    setMethod('Cash');
  }

  async function completeSale() {
    if (submitLock.current) return;
    setError('');
    if (!cart.length) return setError('Add at least one product to the order.');
    const invalid = cart.find((line) => !(Number(line.quantity) > 0) || Number(line.quantity) > Number(line.stock_quantity) || (!isDecimalUnit(line.unit) && !Number.isInteger(Number(line.quantity))));
    if (invalid) return setError(`Check the quantity for ${invalid.product_name} (in stock: ${qty(invalid.stock_quantity)} ${invalid.unit}).`);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) return setError('Discount must be between zero and the subtotal.');
    if (method === 'Cash' && (String(tendered).trim() === '' || !Number.isFinite(paid) || paid < total)) return setError('Cash received must cover the total.');

    submitLock.current = true;
    setSubmitting(true);
    try {
      const response = await apiRequest('/sales', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((line) => ({ product_id: line.id, quantity: Number(line.quantity) })),
          discount,
          payment: { amount: paid, payment_method: method, reference_number: method === 'Cash' ? undefined : reference.trim() || undefined }
        })
      });
      const detail = await apiRequest(`/sales/${response.data.sale.id}`);
      setReceipt(detail.data.sale);
      clearOrder();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const quickCash = [...new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])].filter((value) => value > 0).slice(0, 4);

  return (
    <div className="page pos-page">
      <PageHeader title="Point of Sale" description="Tap products to build the order, then take payment." actions={<Link className="btn btn-ghost" to="/sales"><Icon name="receipt" size={16} />Sales history</Link>} />
      <Alert>{products.error || categories.error}</Alert>

      <div className="pos-layout">
        <section className="pos-catalog" aria-label="Products">
          <div className="pos-filters">
            <SearchInput value={search} onChange={setSearch} placeholder="Search products or code" />
            <div className="chip-row" role="group" aria-label="Filter by category">
              <button type="button" className={`chip${categoryId === 'all' ? ' is-active' : ''}`} onClick={() => setCategoryId('all')}>All</button>
              {(categories.data || []).map((category) => (
                <button type="button" key={category.id} className={`chip${categoryId === String(category.id) ? ' is-active' : ''}`} onClick={() => setCategoryId(String(category.id))}>{category.category_name}</button>
              ))}
            </div>
          </div>
          {products.loading && !products.data ? <Loading label="Loading products…" /> : visibleProducts.length === 0 ? (
            <EmptyState title="No products match" description="Try another search or category." />
          ) : (
            <div className="product-grid">
              {visibleProducts.map((product) => {
                const stock = Number(product.stock_quantity);
                const inCart = cart.find((line) => line.id === product.id);
                const out = stock <= 0;
                return (
                  <button type="button" key={product.id} className={`product-tile${inCart ? ' in-cart' : ''}`} disabled={out} onClick={() => add(product)} aria-label={`Add ${product.product_name}, ${money(product.selling_price)}${out ? ', out of stock' : ''}`}>
                    <span className="product-tile-name">{product.product_name}</span>
                    <span className="product-tile-price">{money(product.selling_price)}<small> / {product.unit}</small></span>
                    <span className={`product-tile-stock${out ? ' is-out' : product.is_low_stock ? ' is-low' : ''}`}>{out ? 'Out of stock' : `${qty(stock)} ${product.unit} left`}</span>
                    {inCart && <span className="product-tile-count" aria-hidden="true">{qty(inCart.quantity)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="pos-order panel" id="order-panel" ref={orderRef} aria-label="Current order">
          <div className="panel-head">
            <h3>Current order</h3>
            {cart.length > 0 && <button type="button" className="link-button danger" onClick={clearOrder}>Clear</button>}
          </div>
          {cart.length === 0 ? <EmptyState title="No items yet" description="Tap a product to add it to the order." /> : (
            <ul className="cart-list">
              {cart.map((line) => (
                <li key={line.id} className="cart-line">
                  <div className="cart-line-info">
                    <strong>{line.product_name}</strong>
                    <small>{money(line.selling_price)} / {line.unit}</small>
                  </div>
                  <div className="stepper">
                    <button type="button" onClick={() => nudge(line, -1)} aria-label={`Decrease ${line.product_name}`}><Icon name="minus" size={14} /></button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={stepFor(line.unit)}
                      value={line.quantity}
                      onChange={(event) => setQuantity(line.id, event.target.value)}
                      aria-label={`Quantity of ${line.product_name}`}
                    />
                    <button type="button" onClick={() => nudge(line, 1)} aria-label={`Increase ${line.product_name}`}><Icon name="plus" size={14} /></button>
                  </div>
                  <b className="cart-line-total">{money(Number(line.selling_price) * (Number(line.quantity) || 0))}</b>
                  <button type="button" className="icon-button" onClick={() => setCart((current) => current.filter((item) => item.id !== line.id))} aria-label={`Remove ${line.product_name}`}><Icon name="trash" size={16} /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="order-section">
            <span className="field-label">Discount</span>
            <Segmented label="Discount" value={discountMode} onChange={setDiscountMode} options={[['none', 'None'], ['senior', 'Senior / PWD 20%'], ['custom', 'Custom']]} />
            {discountMode === 'custom' && (
              <input type="number" inputMode="decimal" min="0" step="0.01" value={customDiscount} onChange={(event) => setCustomDiscount(event.target.value)} placeholder="Discount amount (₱)" aria-label="Custom discount amount" />
            )}
          </div>

          <dl className="order-totals">
            <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 && <div><dt>Discount</dt><dd>−{money(discount)}</dd></div>}
            <div className="order-grand"><dt>Total</dt><dd>{money(total)}</dd></div>
          </dl>

          <div className="order-section">
            <span className="field-label">Payment method</span>
            <Segmented label="Payment method" value={method} onChange={setMethod} options={methods} />
            {method === 'Cash' ? (
              <>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={tendered} onChange={(event) => setTendered(event.target.value)} placeholder="Cash received (₱)" aria-label="Cash received" />
                {total > 0 && (
                  <div className="chip-row">
                    {quickCash.map((value) => <button type="button" key={value} className="chip" onClick={() => setTendered(String(value))}>{value === total ? 'Exact' : money(value)}</button>)}
                  </div>
                )}
              </>
            ) : (
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={`${method} reference no. (optional)`} aria-label="Payment reference number" maxLength={100} />
            )}
          </div>

          {method === 'Cash' && tendered !== '' && cart.length > 0 && (
            <div className={`change-due${change < 0 ? ' is-short' : ''}`}>
              <span>{change < 0 ? 'Amount short' : 'Change due'}</span>
              <strong>{money(Math.abs(change))}</strong>
            </div>
          )}

          <Alert>{error}</Alert>
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={completeSale} disabled={!cart.length || submitting}>
            {submitting ? 'Processing…' : `Complete sale · ${money(total)}`}
          </button>
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="pos-mobile-bar">
          <span><strong>{money(total)}</strong><small>{plural(cart.length, 'item')}</small></span>
          <button type="button" className="btn btn-primary" onClick={() => orderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Review &amp; pay</button>
        </div>
      )}

      <Drawer
        open={Boolean(receipt)}
        title="Sale completed"
        description={receipt ? `${receipt.sale_number} · change ${money(receipt.change_amount)}` : ''}
        onClose={() => setReceipt(null)}
        size="sm"
        footer={receipt && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Icon name="print" size={16} />Print</button>
            <Link className="btn btn-secondary" to={`/sales/${receipt.id}`}>View sale</Link>
            <button type="button" className="btn btn-primary" onClick={() => setReceipt(null)}>New sale</button>
          </>
        )}
      >
        {receipt && <Receipt sale={receipt} />}
      </Drawer>
    </div>
  );
}
