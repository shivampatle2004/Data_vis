
    CREATE TABLE sales_data (
        id SERIAL PRIMARY KEY,
        product_name VARCHAR(255),
        category VARCHAR(100),
        amount DECIMAL(10, 2),
        sale_date DATE
    );

    INSERT INTO sales_data (product_name, category, amount, sale_date) VALUES 
    ('Laptop', 'Electronics', 1200.00, '2026-01-01'),
    ('Phone', 'Electronics', 800.00, '2026-01-02'),
    ('Desk', 'Furniture', 300.00, '2026-01-03'),
    ('Chair', 'Furniture', 150.00, '2026-01-04'),
    ('Monitor', 'Electronics', 250.00, '2026-01-05');
    