CREATE DATABASE IF NOT EXISTS regineLechon
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE regineLechon;

CREATE TABLE IF NOT EXISTS employees (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_code VARCHAR(30) NOT NULL UNIQUE,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  position VARCHAR(50) NOT NULL,
  phone VARCHAR(30) NULL,
  hire_date DATE NOT NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_status (status),
  INDEX idx_employees_name (last_name, first_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT UNSIGNED NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Owner', 'Manager', 'Cashier', 'Staff') NOT NULL DEFAULT 'Staff',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, status),
  CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categories_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  product_code VARCHAR(30) NOT NULL UNIQUE,
  product_name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  unit VARCHAR(30) NOT NULL DEFAULT 'piece',
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_products_category_status (category_id, status),
  INDEX idx_products_stock (stock_quantity, reorder_level),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_products_prices CHECK (cost_price >= 0 AND selling_price >= 0),
  CONSTRAINT chk_products_stock CHECK (stock_quantity >= 0 AND reorder_level >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_number VARCHAR(40) NOT NULL UNIQUE,
  employee_id INT UNSIGNED NOT NULL,
  sale_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  sale_status ENUM('Completed', 'Pending', 'Cancelled') NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sales_date_status (sale_date, sale_status),
  CONSTRAINT fk_sales_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sales_totals CHECK (subtotal >= 0 AND discount >= 0 AND total_amount >= 0 AND discount <= subtotal)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sale_items_sale (sale_id),
  INDEX idx_sale_items_product (product_id),
  CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_sale_items_values CHECK (quantity > 0 AND unit_price >= 0 AND subtotal >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id INT UNSIGNED NOT NULL UNIQUE,
  payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  amount_tendered DECIMAL(12,2) NULL,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('Cash', 'GCash', 'Bank Transfer', 'Other') NOT NULL,
  reference_number VARCHAR(100) NULL,
  payment_status ENUM('Paid', 'Pending', 'Cancelled', 'Refunded') NOT NULL DEFAULT 'Paid',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_date_status (payment_date, payment_status),
  CONSTRAINT fk_payments_sale FOREIGN KEY (sale_id) REFERENCES sales(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_payments_amount CHECK (amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_code VARCHAR(30) NOT NULL UNIQUE,
  supplier_name VARCHAR(120) NOT NULL,
  contact_person VARCHAR(120) NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_suppliers_status_name (status, supplier_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_receiving (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receiving_number VARCHAR(40) NOT NULL UNIQUE,
  supplier_id INT UNSIGNED NOT NULL,
  received_by INT UNSIGNED NOT NULL,
  receiving_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reference_number VARCHAR(100) NULL,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('Completed', 'Cancelled') NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_receiving_date_status (receiving_date, status),
  CONSTRAINT fk_receiving_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_receiving_employee FOREIGN KEY (received_by) REFERENCES employees(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_receiving_cost CHECK (total_cost >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_receiving_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receiving_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_receiving_items_receiving (receiving_id),
  INDEX idx_receiving_items_product (product_id),
  CONSTRAINT fk_receiving_items_receiving FOREIGN KEY (receiving_id) REFERENCES stock_receiving(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_receiving_items_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_receiving_items_values CHECK (quantity > 0 AND unit_cost >= 0 AND subtotal >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  transaction_type ENUM('STOCK_RECEIVING', 'SALE', 'SALE_CANCELLED', 'ADJUSTMENT') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  previous_stock DECIMAL(12,3) NOT NULL,
  new_stock DECIMAL(12,3) NOT NULL,
  reference_type VARCHAR(40) NOT NULL,
  reference_id INT UNSIGNED NOT NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inventory_logs_product_date (product_id, created_at),
  INDEX idx_inventory_logs_reference (reference_type, reference_id),
  CONSTRAINT fk_inventory_logs_product FOREIGN KEY (product_id) REFERENCES products(id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;
