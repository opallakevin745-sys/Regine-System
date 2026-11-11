// Mirrors the authorizeRoles() rules in server/src/routes so the UI only offers allowed actions.
export const ROLE_GROUPS = {
  everyone: ['Owner', 'Manager', 'Cashier', 'Staff'],
  managers: ['Owner', 'Manager'],
  sellers: ['Owner', 'Manager', 'Cashier'],
  receivers: ['Owner', 'Manager', 'Staff'],
  owner: ['Owner']
};

const has = (group) => (user) => ROLE_GROUPS[group].includes(user?.role);

export const can = {
  manageCatalog: has('managers'),
  viewCosts: has('managers'),
  adjustStock: has('managers'),
  cancelSale: has('managers'),
  sell: has('sellers'),
  receiveStock: has('receivers'),
  manageEmployees: has('managers'),
  viewReports: has('managers'),
  manageUsers: has('owner')
};
