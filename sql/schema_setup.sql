-- SQL Setup Script for E-Commerce Sales Database Schema
-- You can run this in your Supabase SQL Editor or via SQL Workbench.

-- Drop tables if they already exist (in reverse dependency order)
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS state_regions CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- 1. Customers Table
CREATE TABLE customers (
    customer_index INT PRIMARY KEY,
    customer_names VARCHAR(255) NOT NULL
);

-- 2. Products Table
CREATE TABLE products (
    product_index INT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL
);

-- 3. Regions Table
CREATE TABLE regions (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    county VARCHAR(255),
    state_code VARCHAR(10),
    state VARCHAR(100),
    type VARCHAR(100),
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    area_code INT,
    population INT,
    households INT,
    median_income NUMERIC(15, 2),
    land_area NUMERIC(18, 2),
    water_area NUMERIC(18, 2),
    time_zone VARCHAR(100)
);

-- 4. State Regions Table
CREATE TABLE state_regions (
    state_code VARCHAR(10) PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL
);

-- 5. Sales Orders Table
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    order_date DATE NOT NULL,
    customer_name_index INT REFERENCES customers(customer_index),
    channel VARCHAR(50),
    currency_code VARCHAR(10),
    warehouse_code VARCHAR(50),
    delivery_region_index INT REFERENCES regions(id),
    product_description_index INT REFERENCES products(product_index),
    order_quantity INT NOT NULL,
    unit_price NUMERIC(15, 4) NOT NULL,
    line_total NUMERIC(15, 4) NOT NULL,
    total_unit_cost NUMERIC(15, 4) NOT NULL
);

-- Indexing for performance and joining (important for queries later)
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_name_index);
CREATE INDEX idx_sales_orders_product ON sales_orders(product_description_index);
CREATE INDEX idx_sales_orders_region ON sales_orders(delivery_region_index);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
