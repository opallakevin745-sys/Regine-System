import { useState } from 'react';
import { apiRequest, buildQuery } from '../api';
import { useAuth } from '../context/AuthContext';
import { useAction, useApi, useDebouncedValue } from '../lib/hooks';
import { formatDate, formatDateTime, inputDate } from '../lib/format';
import { DataTable, Drawer, Feedback, Field, PageHeader, Panel, SearchInput, StatusBadge, Toolbar } from '../components/ui';
import Icon from '../components/Icon';

function DrawerForm({ id, open, title, description, onClose, onSubmit, busy, error, submitLabel, children }) {
  return (
    <Drawer
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form={id} className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        </>
      )}
    >
      <form id={id} className="form-grid" onSubmit={(event) => { event.preventDefault(); onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries())); }}>
        {error && <div className="alert alert-error" role="alert"><Icon name="alert" size={16} /><span>{error}</span></div>}
        {children}
      </form>
    </Drawer>
  );
}

// ---- Employees ------------------------------------------------------------------------------------------
export function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const debouncedSearch = useDebouncedValue(search);
  const { data, loading, error } = useApi(`/employees${buildQuery({ search: debouncedSearch, status })}`, { areas: ['employees'], select: (body) => body.data.employees });
  const action = useAction();
  const rows = data || [];

  async function save(form) {
    const result = await action.run(
      () => apiRequest(editing.id ? `/employees/${editing.id}` : '/employees', { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(form) }),
      editing.id ? 'Employee updated.' : 'Employee added.'
    );
    if (result) setEditing(null);
  }

  async function toggle(row) {
    const next = row.status === 'Active' ? 'Inactive' : 'Active';
    const warning = next === 'Inactive' && row.username ? ` Their login (${row.username}) will also be deactivated.` : '';
    if (next === 'Inactive' && !window.confirm(`Deactivate ${row.first_name} ${row.last_name}?${warning}`)) return;
    await action.run(() => apiRequest(`/employees/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }), `${row.first_name} ${row.last_name} is now ${next.toLowerCase()}.`);
  }

  const columns = [
    { key: 'name', header: 'Employee', primary: true, render: (row) => <span className="cell-stack"><strong>{row.first_name} {row.last_name}</strong><small>{row.employee_code}</small></span> },
    { key: 'position', header: 'Position' },
    { key: 'account', header: 'Login', render: (row) => (row.username ? <span className="cell-stack"><span>{row.username}</span><small>{row.role}{row.user_status === 'Inactive' ? ' · inactive' : ''}</small></span> : <span className="muted">No account</span>) },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    { key: 'hire_date', header: 'Hired', render: (row) => formatDate(row.hire_date), hideOnMobile: true },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: 'Actions', actions: true,
      render: (row) => (
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { action.setError(''); setEditing(row); }}><Icon name="edit" size={14} />Edit</button>
          {row.role !== 'Owner' && <button type="button" className={`btn btn-sm ${row.status === 'Active' ? 'btn-ghost danger' : 'btn-secondary'}`} onClick={() => toggle(row)}>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</button>}
        </div>
      )
    }
  ];

  return (
    <div className="page">
      <PageHeader title="Employees" description="The team behind the counter, kitchen, and stockroom." actions={<button type="button" className="btn btn-primary" onClick={() => { action.setError(''); setEditing({ hire_date: inputDate() }); }}><Icon name="plus" size={16} />Add employee</button>} />
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or code" />
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </Toolbar>
      <Feedback error={error || (!editing && action.error)} message={action.message} />
      <Panel padded={false}>
        <DataTable columns={columns} rows={rows} loading={loading} caption="Employees" />
      </Panel>
      <DrawerForm id="employee-form" open={Boolean(editing)} title={editing?.id ? `Edit ${editing.first_name} ${editing.last_name}` : 'New employee'} onClose={() => setEditing(null)} onSubmit={save} busy={action.busy} error={action.error} submitLabel={editing?.id ? 'Save changes' : 'Add employee'}>
        {editing && (
          <>
            <div className="form-row">
              <Field label="Employee code"><input name="employee_code" defaultValue={editing.employee_code} required maxLength={30} placeholder="EMP-0009" /></Field>
              <Field label="Hire date"><input name="hire_date" type="date" defaultValue={String(editing.hire_date || '').slice(0, 10)} required /></Field>
            </div>
            <div className="form-row">
              <Field label="First name"><input name="first_name" defaultValue={editing.first_name} required maxLength={80} /></Field>
              <Field label="Last name"><input name="last_name" defaultValue={editing.last_name} required maxLength={80} /></Field>
            </div>
            <div className="form-row">
              <Field label="Position"><input name="position" defaultValue={editing.position} required maxLength={50} list="position-options" /></Field>
              <Field label="Phone"><input name="phone" type="tel" defaultValue={editing.phone || ''} maxLength={30} /></Field>
            </div>
            <datalist id="position-options">{['Store Manager', 'Cashier', 'Inventory Staff', 'Head Cook', 'Roaster', 'Helper'].map((value) => <option key={value} value={value} />)}</datalist>
          </>
        )}
      </DrawerForm>
    </div>
  );
}

// ---- User accounts ------------------------------------------------------------------------------------------
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const users = useApi('/users', { areas: ['users'], select: (body) => body.data.users });
  const employees = useApi('/employees?status=Active', { areas: ['employees', 'users'], select: (body) => body.data.employees });
  const [mode, setMode] = useState(null);
  const [target, setTarget] = useState(null);
  const action = useAction();
  const available = (employees.data || []).filter((employee) => !employee.user_id);

  function open(nextMode, row = null) {
    action.setError('');
    setTarget(row);
    setMode(nextMode);
  }
  const close = () => setMode(null);

  async function create(form) {
    const result = await action.run(() => apiRequest('/users', { method: 'POST', body: JSON.stringify(form) }), `Account ${form.username} created.`);
    if (result) close();
  }
  async function update(form) {
    const result = await action.run(() => apiRequest(`/users/${target.id}`, { method: 'PUT', body: JSON.stringify(form) }), `Account ${form.username} updated.`);
    if (result) close();
  }
  async function reset(form) {
    if (form.new_password !== form.confirm_password) return action.setError('The two passwords do not match.');
    const result = await action.run(() => apiRequest(`/users/${target.id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: form.new_password }) }), `Password for ${target.username} was reset.`);
    if (result) close();
    return undefined;
  }
  async function toggle(row) {
    const next = row.status === 'Active' ? 'Inactive' : 'Active';
    if (next === 'Inactive' && !window.confirm(`Deactivate ${row.username}? They will be signed out and unable to log in.`)) return;
    await action.run(() => apiRequest(`/users/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }), `${row.username} is now ${next.toLowerCase()}.`);
  }

  const columns = [
    { key: 'name', header: 'Employee', primary: true, render: (row) => <span className="cell-stack"><strong>{row.first_name} {row.last_name}</strong><small>{row.employee_code} · {row.position}</small></span> },
    { key: 'username', header: 'Username' },
    { key: 'role', header: 'Role', render: (row) => <span className="role-tag">{row.role}</span> },
    { key: 'last_login', header: 'Last login', render: (row) => (row.last_login ? formatDateTime(row.last_login) : 'Never') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions', header: 'Actions', actions: true,
      render: (row) => (row.role === 'Owner' ? <span className="muted small">Protected{row.id === currentUser?.id ? ' (you)' : ''}</span> : (
        <div className="row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => open('edit', row)}><Icon name="edit" size={14} />Edit</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => open('reset', row)}>Reset password</button>
          <button type="button" className={`btn btn-sm ${row.status === 'Active' ? 'btn-ghost danger' : 'btn-secondary'}`} onClick={() => toggle(row)}>{row.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
        </div>
      ))
    }
  ];

  return (
    <div className="page">
      <PageHeader title="User Accounts" description="Logins and roles. Only the Owner can manage accounts." actions={<button type="button" className="btn btn-primary" onClick={() => open('create')}><Icon name="plus" size={16} />New account</button>} />
      <Feedback error={users.error || employees.error || (!mode && action.error)} message={action.message} />
      <Panel padded={false}>
        <DataTable columns={columns} rows={users.data || []} loading={users.loading} caption="User accounts" />
      </Panel>
      <div className="role-guide">
        <div><strong>Manager</strong><span>Everything except user accounts: catalog, stock adjustments, cancellations, reports, audit.</span></div>
        <div><strong>Cashier</strong><span>Point of sale, sales history, payments; read-only products, categories, inventory, suppliers.</span></div>
        <div><strong>Staff</strong><span>Stock receiving plus read-only products, categories, inventory, suppliers.</span></div>
      </div>

      <DrawerForm id="user-create" open={mode === 'create'} title="New account" description="Give an employee a login." onClose={close} onSubmit={create} busy={action.busy} error={action.error} submitLabel="Create account">
        <Field label="Employee" hint={available.length ? 'Active employees without a login' : 'Every active employee already has a login'}>
          <select name="employee_id" required defaultValue="">
            <option value="">Select employee</option>
            {available.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name} · {employee.position}</option>)}
          </select>
        </Field>
        <Field label="Username"><input name="username" required maxLength={50} autoCapitalize="none" autoComplete="off" /></Field>
        <Field label="Password" hint="At least 8 characters"><input name="password" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <Field label="Role">
          <select name="role" defaultValue="Cashier">
            <option>Cashier</option>
            <option>Staff</option>
            <option>Manager</option>
          </select>
        </Field>
      </DrawerForm>

      <DrawerForm id="user-edit" open={mode === 'edit'} title={target ? `Edit ${target.username}` : ''} onClose={close} onSubmit={update} busy={action.busy} error={action.error} submitLabel="Save changes">
        {target && (
          <>
            <Field label="Username"><input name="username" defaultValue={target.username} required maxLength={50} autoCapitalize="none" /></Field>
            <Field label="Role">
              <select name="role" defaultValue={target.role}>
                <option>Cashier</option>
                <option>Staff</option>
                <option>Manager</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={target.status}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </Field>
          </>
        )}
      </DrawerForm>

      <DrawerForm id="user-reset" open={mode === 'reset'} title={target ? `Reset password for ${target.username}` : ''} description="Share the new password with the employee privately." onClose={close} onSubmit={reset} busy={action.busy} error={action.error} submitLabel="Reset password">
        <Field label="New password" hint="At least 8 characters"><input name="new_password" type="password" required minLength={8} autoComplete="new-password" /></Field>
        <Field label="Confirm new password"><input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" /></Field>
      </DrawerForm>
    </div>
  );
}
