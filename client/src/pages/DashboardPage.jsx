import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, onDataChanged } from '../api';

const money = (value) => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const cards = [['todaySales', "Today's Sales", 'sales'], ['todayTransactions', "Today's Transactions", 'products'], ['totalProducts', 'Total Products', 'stock'], ['lowStockCount', 'Low Stock Items', 'employees'], ['outOfStockCount', 'Out of Stock', 'sales'], ['activeEmployees', 'Active Employees', 'products']];

export default function DashboardPage() {
  const [data, setData] = useState(null); const [error, setError] = useState('');
  useEffect(() => {
    async function load() {
      try { const response = await apiRequest('/dashboard/summary'); setData(response.data); setError(''); }
      catch (requestError) { setError(requestError.message); }
    }
    load();
    return onDataChanged(['dashboard'], load);
  }, []);
  return <section className="dashboard"><div className="page-heading"><div><h2>Dashboard</h2></div></div>{error && <div className="inline-error">{error}</div>}{!data ? <div className="empty-state">Loading business metrics...</div> : <><div className="stat-grid">{cards.map(([key, label, tone]) => <article className={`stat-card ${tone}`} key={key}><div className="stat-top"><span>{label}</span><b>↗</b></div><strong>{key === 'todaySales' ? money(data.summary[key]) : data.summary[key]}</strong><small>Real database data</small></article>)}</div><div className="dashboard-grid"><article className="welcome-panel"><span className="eyebrow light">LAST 7 DAYS</span><h3>{money(data.period.sales)}<br /><i>in completed sales.</i></h3><p>{data.period.transactions} completed transactions · Average {money(data.period.averageTransaction)}</p><div className="chart-bars">{data.chart.map((day) => <span key={day.sale_date} style={{ height: `${Math.max(8, Math.min(100, Number(day.total_sales) / Math.max(1, ...data.chart.map((item) => Number(item.total_sales))) * 100))}%` }} title={`${day.sale_date}: ${money(day.total_sales)}`} />)}</div></article><article className="activity-panel"><div className="panel-title"><h3>Low stock</h3><Link to="/inventory">View all</Link></div>{data.lowStock.length ? data.lowStock.map((item) => <div className="dashboard-row" key={item.id}><span><strong>{item.product_name}</strong><small>{item.stock_quantity} {item.unit} left · reorder at {item.reorder_level}</small></span><b>{item.stock_quantity === 0 ? 'Out' : 'Low'}</b></div>) : <div className="empty-state"><strong>No low stock items</strong><small>Everything is above reorder level.</small></div>}</article></div><div className="dashboard-grid lower"><article className="activity-panel"><div className="panel-title"><h3>Top products</h3><Link to="/reports">Reports</Link></div>{data.topProducts.length ? data.topProducts.map((item) => <div className="dashboard-row" key={item.product_name}><span><strong>{item.product_name}</strong><small>{item.quantity_sold} sold</small></span><b>{money(item.revenue)}</b></div>) : <div className="empty-state">No sales data available.</div>}</article><article className="activity-panel"><div className="panel-title"><h3>Recent sales</h3><Link to="/sales">View all</Link></div>{data.recentSales.length ? data.recentSales.slice(0, 5).map((sale) => <div className="dashboard-row" key={sale.id}><span><strong>{sale.sale_number}</strong><small>{sale.employee_name} · {new Date(sale.sale_date).toLocaleDateString()}</small></span><b>{money(sale.total_amount)}</b></div>) : <div className="empty-state">No sales data available.</div>}</article></div></>}</section>;
}
