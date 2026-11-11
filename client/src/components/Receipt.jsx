import { formatDateTime, money, qty } from '../lib/format';
import { StatusBadge } from './ui';

export default function Receipt({ sale }) {
  const tendered = sale.amount_tendered ?? sale.payment_amount;
  return (
    <div className="receipt print-area">
      <div className="receipt-head">
        <strong>Mutya Licios Lechon Manok</strong>
        <span>Official sales receipt</span>
      </div>
      <dl className="receipt-meta">
        <div><dt>Sale no.</dt><dd>{sale.sale_number}</dd></div>
        <div><dt>Date</dt><dd>{formatDateTime(sale.sale_date)}</dd></div>
        <div><dt>Cashier</dt><dd>{sale.employee_name}</dd></div>
        <div><dt>Status</dt><dd><StatusBadge status={sale.sale_status} /></dd></div>
      </dl>
      <table className="receipt-items">
        <thead><tr><th scope="col">Item</th><th scope="col" className="align-right">Amount</th></tr></thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id ?? item.product_id}>
              <td><strong>{item.product_name}</strong><small>{qty(item.quantity)} {item.unit} × {money(item.unit_price)}</small></td>
              <td className="align-right">{money(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="receipt-totals">
        <div><dt>Subtotal</dt><dd>{money(sale.subtotal)}</dd></div>
        {Number(sale.discount) > 0 && <div><dt>Discount</dt><dd>−{money(sale.discount)}</dd></div>}
        <div className="receipt-grand"><dt>Total</dt><dd>{money(sale.total_amount)}</dd></div>
        <div><dt>Paid via {sale.payment_method}</dt><dd>{money(tendered)}</dd></div>
        {Number(sale.change_amount) > 0 && <div><dt>Change</dt><dd>{money(sale.change_amount)}</dd></div>}
        {sale.reference_number && <div><dt>Reference</dt><dd>{sale.reference_number}</dd></div>}
      </dl>
      <p className="receipt-foot">Salamat po! Thank you for your purchase.</p>
    </div>
  );
}
