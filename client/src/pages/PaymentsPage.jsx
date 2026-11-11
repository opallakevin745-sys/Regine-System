import { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildQuery } from '../api';
import { useApi, useDebouncedValue, usePagination } from '../lib/hooks';
import { count, daysAgo, formatDateTime, inputDate, money } from '../lib/format';
import { Alert, DataTable, PageHeader, Pagination, Panel, SearchInput, StatCard, StatusBadge, Toolbar } from '../components/ui';
import { DateRange } from './SalesPages';

const methods = ['Cash', 'GCash', 'Bank Transfer', 'Other'];

export default function PaymentsPage() {
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ preset: '7d', from: daysAgo(6), to: inputDate() });
  const debouncedSearch = useDebouncedValue(search);
  const { data, loading, error } = useApi(`/payments${buildQuery({ search: debouncedSearch, payment_method: method, status, from: range.from, to: range.to })}`, { areas: ['payments'], select: (body) => body.data.payments });
  const rows = data || [];
  const pagination = usePagination(rows, 15);
  const paid = rows.filter((row) => row.payment_status === 'Paid');
  const totalPaid = paid.reduce((sum, row) => sum + Number(row.amount), 0);
  const byMethod = (name) => paid.filter((row) => row.payment_method === name).reduce((sum, row) => sum + Number(row.amount), 0);

  const columns = [
    { key: 'sale_number', header: 'Sale', primary: true, render: (row) => <span className="cell-stack"><Link to={`/sales/${row.sale_id}`}><strong>{row.sale_number}</strong></Link><small>{formatDateTime(row.payment_date)}</small></span> },
    { key: 'employee_name', header: 'Cashier' },
    { key: 'payment_method', header: 'Method' },
    { key: 'reference_number', header: 'Reference', render: (row) => row.reference_number || '—', hideOnMobile: true },
    { key: 'amount', header: 'Amount', align: 'right', render: (row) => <strong>{money(row.amount)}</strong> },
    { key: 'amount_tendered', header: 'Received', align: 'right', render: (row) => money(row.amount_tendered ?? row.amount), hideOnMobile: true },
    { key: 'change_amount', header: 'Change', align: 'right', render: (row) => money(row.change_amount), hideOnMobile: true },
    { key: 'payment_status', header: 'Status', render: (row) => <StatusBadge status={row.payment_status} /> }
  ];

  return (
    <div className="page">
      <PageHeader title="Payments" description="Money collected for each sale, by method." />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search sale or reference no." />
        <select aria-label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="">All methods</option>
          {methods.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select aria-label="Payment status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option>Paid</option>
          <option>Cancelled</option>
          <option>Refunded</option>
          <option>Pending</option>
        </select>
        <DateRange {...range} onChange={setRange} />
      </Toolbar>
      <Alert>{error}</Alert>
      <div className="stat-grid stat-grid-4 compact">
        <StatCard label="Total collected" value={money(totalPaid)} hint={`${count(paid.length)} paid sales`} tone="accent" />
        <StatCard label="Cash" value={money(byMethod('Cash'))} />
        <StatCard label="GCash" value={money(byMethod('GCash'))} />
        <StatCard label="Bank transfer & other" value={money(byMethod('Bank Transfer') + byMethod('Other'))} />
      </div>
      <Panel padded={false}>
        <DataTable columns={columns} rows={pagination.rows} loading={loading} caption="Payments" />
        <Pagination {...pagination} />
      </Panel>
      {rows.length >= 200 && <p className="muted small">Showing the latest 200 payments. Narrow the date range to see older records.</p>}
    </div>
  );
}
