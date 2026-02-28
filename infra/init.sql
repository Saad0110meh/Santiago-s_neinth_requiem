-- D:\DevSprint\Devsprint\infra\init.sql

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, preparing, ready, completed
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed some essential cafeteria items
INSERT INTO menu_items (name, description, price, stock_quantity) VALUES
('Beef Tehari', 'Classic campus lunch', 120.00, 50),
('Chicken Khichuri', 'Perfect for rainy days', 100.00, 40),
('Singara', 'Standard evening snack', 10.00, 200),
('Milk Tea', 'Fuel for late-night studying', 15.00, 150);

-- Add a test admin user
INSERT INTO users (student_id, name, role) VALUES
('ADMIN001', 'Cafeteria Manager', 'admin'),
('210041100', 'Test Student', 'student');