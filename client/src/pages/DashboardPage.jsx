import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../lib/hooks';
import { can } from '../lib/roles';
import { count, daysAgo, formatTime, formatDate, money, plural, qty } from '../lib/format';
import { Alert, EmptyState, Loading, PageHeader, Panel, StatCard, StatusBadge } from '../components/ui';
import SalesChart from '../components/SalesChart';
import Icon from '../components/Icon';

function lastSevenDays(chart) {
  const byDate = new Map(chart.map((day) => [String(day.sale_date).slice(0, 10), day]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = daysAgo(6 - index);
    const day = byDate.get(date);
    return { date, total: Number(day?.total_sales || 0), transactions: Number(day?.transactions || 0) };
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useApi('/dashboard/summary', { areas: ['dashboard'] });
  const isManager = can.viewReports(user);
  const isCashier = user?.role === 'Cashier';

  const actions = (
    <>
      {can.receiveStock(user) && <Link className="btn btn-secondary" to="/stock-receiving/new"><Icon name="receiving" size={16} />Receive stock</Link>}
      {can.sell(user) && <Link className="btn btn-primary" to="/sales/new"><Icon name="pos" size={16} />New sale</Link>}
    </>
  );

  if (!data) {
    return (
      <div className="page">
        <PageHeader title="Dashboard" description="Today's business at a glance." actions={actions} />
        <Alert>{error}</Alert>
        {loading && <Loading label="Loading business metrics…" />}
      </div>
    );
  }

  const { summary, myToday, period, chart, paymentMix = [], topProducts, lowStock, recentSales } = data;
  const lowCount = Number(summary.lowStockCount);
  const outCount = Number(summary.outOfStockCount);
  const days = lastSevenDays(chart);
  const collected = paymentMix.reduce((sum, row) => sum + Number(row.amount), 0);

  const stats = isCashier
    ? [
        { label: 'My sales today', value: money(myToday?.sales), hint: `${plural(myToday?.transactions, 'transaction')} by you`, tone: 'accent' },
        { label: "Store sales today", value: money(summary.todaySales), hint: `${plural(summary.todayTransactions, 'transaction')} in total` },
        { label: 'Low stock items', value: count(lowCount), hint: lowCount ? 'At or below reorder level' : 'All items above reorder level', tone: lowCount ? 'warning' : 'neutral' },
        { label: 'Out of stock', value: count(outCount), hint: outCount ? 'Cannot be sold right now' : 'Everything is available', tone: outCount ? 'critical' : 'neutral' }
      ]
    : [
        { label: "Today's sales", value: money(summary.todaySales), hint: `${plural(summary.todayTransactions, 'completed transaction')}`, tone: 'accent' },
        { label: 'Average sale (7 days)', value: money(period.averageTransaction), hint: `${plural(period.transactions, 'sale')} this week` },
        { label: 'Low stock items', value: count(lowCount), hint: lowCount ? 'At or below reorder level' : 'All items above reorder level', tone: lowCount ? 'warning' : 'neutral' },
        { label: 'Out of stock', value: count(outCount), hint: outCount ? 'Cannot be sold right now' : 'Everything is available', tone: outCount ? 'critical' : 'neutral' },
        { label: 'Active products', value: count(summary.totalProducts), hint: 'Available in the catalog' },
        { label: 'Active employees', value: count(summary.activeEmployees), hint: 'Currently on the team' }
      ];

  return (
    <div className="page dashboard">
      <PageHeader title="Dashboard" description={`Today's business at a glance · ${formatDate(new Date())}`} actions={actions} />
      <Alert>{error}</Alert>

      <div className={`stat-grid stat-grid-${stats.length}`}>
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      <div className="dashboard-grid">
        <Panel className="chart-panel" title="Sales, last 7 days">
          <div className="hero-figure">
            <strong>{money(period.sales)}</strong>
            <span>{plural(period.transactions, 'completed sale')} · average {money(period.averageTransaction)}</span>
          </div>
          <SalesChart days={days} />
        </Panel>

        <Panel title="Today's collections" actions={can.sell(user) && <Link className="link-button" to="/payments">Payments</Link>}>
          {paymentMix.length ? (
            <ul className="metric-list">
              {paymentMix.map((row) => (
                <li key={row.payment_method}>
                  <span><strong>{row.payment_method}</strong><small>{plural(row.count, 'payment')}</small></span>
                  <b>{money(row.amount)}</b>
                </li>
              ))}
              <li className="metric-total"><span><strong>Total collected</strong></span><b>{money(collected)}</b></li>
            </ul>
          ) : <EmptyState title="No payments yet today" description="Completed sales will appear here." />}
        </Panel>
      </div>

      <div className="dashboard-grid three">
        <Panel title="Low stock" actions={<Link className="link-button" to="/inventory">Inventory</Link>}>
          {lowStock.length ? (
            <ul className="metric-list">
              {lowStock.map((item) => (
                <li key={item.id}>
                  <span><strong>{item.product_name}</strong><small>{qty(item.stock_quantity)} {item.unit} left · reorder at {qty(item.reorder_level)}</small></span>
                  <StatusBadge status={Number(item.stock_quantity) === 0 ? 'Out of Stock' : 'Low Stock'} label={Number(item.stock_quantity) === 0 ? 'Out' : 'Low'} />
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No low stock items" description="Everything is above its reorder level." />}
        </Panel>

        <Panel title="Top products, 30 days" actions={isManager && <Link className="link-button" to="/reports">Reports</Link>}>
          {topProducts.length ? (
            <ul className="metric-list">
              {topProducts.map((item, index) => (
                <li key={item.id || item.product_name}>
                  <span className="ranked"><i>{index + 1}</i><span><strong>{item.product_name}</strong><small>{qty(item.quantity_sold)} {item.unit || ''} sold</small></span></span>
                  <b>{money(item.revenue)}</b>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No sales data yet" />}
        </Panel>

        <Panel title="Recent sales" actions={can.sell(user) && <Link className="link-button" to="/sales">All sales</Link>}>
          {recentSales.length ? (
            <ul className="metric-list">
              {recentSales.slice(0, 6).map((sale) => (
                <li key={sale.id} className={can.sell(user) ? 'is-link' : ''} onClick={can.sell(user) ? () => navigate(`/sales/${sale.id}`) : undefined}>
                  <span>
                    <strong>{can.sell(user) ? <Link to={`/sales/${sale.id}`}>{sale.sale_number}</Link> : sale.sale_number}</strong>
                    <small>{sale.employee_name} · {formatTime(sale.sale_date)}{new Date(sale.sale_date).toDateString() !== new Date().toDateString() ? `, ${formatDate(sale.sale_date)}` : ''}</small>
                  </span>
                  <span className="metric-end">
                    <b className={sale.sale_status === 'Cancelled' ? 'is-struck' : ''}>{money(sale.total_amount)}</b>
                    {sale.sale_status !== 'Completed' && <StatusBadge status={sale.sale_status} />}
                  </span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No sales recorded yet" />}
        </Panel>
      </div>
    </div>
  );
}
