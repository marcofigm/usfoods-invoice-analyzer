-- US Foods Invoice Analyzer Database Schema
-- Run this in your Supabase SQL Editor

-- Enable RLS
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create restaurants table
CREATE TABLE restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  location VARCHAR NOT NULL,
  address TEXT,
  phone VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_master table
CREATE TABLE product_master (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_number VARCHAR NOT NULL UNIQUE,
  description VARCHAR NOT NULL,
  brand VARCHAR,
  category VARCHAR NOT NULL CHECK (category IN ('Produce', 'Protein', 'Dairy', 'Dry Goods', 'Supplies', 'Beverages')),
  pack_size VARCHAR,
  unit_type VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  document_number VARCHAR NOT NULL,
  document_type VARCHAR DEFAULT 'INVOICE',
  document_date DATE NOT NULL,
  customer_number VARCHAR,
  order_number VARCHAR,
  net_amount_after_adjustment DECIMAL(10,2),
  net_amount_before_adjustment DECIMAL(10,2),
  delivery_adjustment DECIMAL(10,2) DEFAULT 0.00,
  payment_terms VARCHAR,
  date_ordered DATE,
  date_shipped DATE,
  usf_sales_location VARCHAR,
  usf_sales_rep VARCHAR,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_line_items table
CREATE TABLE invoice_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_number VARCHAR NOT NULL,
  product_description VARCHAR NOT NULL,
  product_label VARCHAR,
  packing_size VARCHAR,
  weight DECIMAL(10,2),
  qty_ordered INTEGER,
  qty_shipped INTEGER,
  qty_adjusted INTEGER DEFAULT 0,
  pricing_unit VARCHAR,
  unit_price DECIMAL(10,4),
  extended_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create price_history table for tracking price changes
CREATE TABLE price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_number VARCHAR NOT NULL,
  restaurant_id UUID REFERENCES restaurants(id),
  price DECIMAL(10,4) NOT NULL,
  pricing_unit VARCHAR,
  invoice_date DATE NOT NULL,
  invoice_id UUID REFERENCES invoices(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create price_alerts table
CREATE TABLE price_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID REFERENCES restaurants(id),
  product_number VARCHAR NOT NULL,
  previous_price DECIMAL(10,4),
  new_price DECIMAL(10,4),
  percentage_change DECIMAL(5,2),
  alert_type VARCHAR CHECK (alert_type IN ('increase', 'decrease')),
  invoice_date DATE NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_invoices_restaurant_id ON invoices(restaurant_id);
CREATE INDEX idx_invoices_document_date ON invoices(document_date);
CREATE INDEX idx_invoices_document_number ON invoices(document_number);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_product_number ON invoice_line_items(product_number);
CREATE INDEX idx_price_history_product_number ON price_history(product_number);
CREATE INDEX idx_price_history_invoice_date ON price_history(invoice_date);
CREATE INDEX idx_price_alerts_restaurant_id ON price_alerts(restaurant_id);
CREATE INDEX idx_price_alerts_is_read ON price_alerts(is_read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_master_updated_at BEFORE UPDATE ON product_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic policies - adjust based on your auth requirements)
CREATE POLICY "Enable read access for authenticated users" ON restaurants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON product_master FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON invoice_line_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON price_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON price_alerts FOR SELECT USING (auth.role() = 'authenticated');

-- Insert sample restaurant data
INSERT INTO restaurants (name, location, address, phone) VALUES
('Los Pinos', 'Bee Caves', '11715 BEE CAVES RD, BEE CAVE, TX 78738-5011', '5125894228'),
('Los Pinos', '360', 'Sample Address for 360 Location', '5125894228');

-- Insert sample product master data based on actual invoice analysis
INSERT INTO product_master (product_number, description, brand, category, pack_size, unit_type) VALUES
('2050143', 'OIL, FRY LIQ CLEAR ZERO TRANS', 'HARVEST VL', 'Dry Goods', '35 LB', 'CS'),
('1329903', 'SALT, TABLE NOT IODZ BAG', 'MONARCH', 'Dry Goods', '25 LB', 'CS'),
('1450060', 'SYRUP, CHOC HERSHEYS BTL', 'HERSHEYS', 'Dry Goods', '24/24 OZ', 'CS'),
('1328699', 'SHORTENING, FRYG SOYBN LIQ CLR', 'HARVEST VL', 'Dry Goods', '35 LB', 'CS'),
('8004574', 'BAG, FOOD STRG 6.5X7 UTILY', 'HANDGARDS', 'Supplies', '2000 EA', 'CS'),
('9329269', 'TOMATO, WHL IN JCE PLD CND', 'HARVEST VL', 'Produce', '6/#10 CN', 'CS'),
('1028447', 'BEEF, GRND 81/19 FINE RAW REF', 'CTLMN SLCT', 'Protein', '6/10 LBA', 'LB'),
('2015881', 'TOMATO, #2 GRD RND BULK FRESH', 'PACKER', 'Produce', '25 LB', 'CS'),
('2326411', 'LETTUCE, ICBRG FRESH REF BOX', 'CROSS VALY', 'Produce', '24 EA', 'CS'),
('2739175', 'SOUR CREAM, CLTD ALL NTRL TUB', 'GLNVW FRMS', 'Dairy', '4/5 LB', 'CS'),
('3205184', 'PEPPER, CHILI PBLNO FRESH REF', 'PACKER', 'Produce', '20 LB', 'CS'),
('4332656', 'CHEESE, CHEDR MTR BLND FEATHER', 'GLNVW FRMS', 'Dairy', '4/5 LB', 'CS'),
('5838388', 'TOMATILLO, PLD FRESH REF', 'PACKER', 'Produce', '35 LB', 'CS'),
('6366090', 'PEPPER, JLP 1 1/9 BSHL FRESH', 'PACKER', 'Produce', '35 LB', 'CS'),
('7012636', 'PEPPER, BELL GRN CHO #2 GRD', 'PACKER', 'Produce', '1.1 BU', 'CS'),
('7487796', 'PEPPER, CHILI ANHIM FRESH REF', 'PACKER', 'Produce', '20 LB', 'CS'),
('8326696', 'ONION, YLW JMB 3"+ BAG FRESH', 'CROSS VALY', 'Produce', '50 LB', 'CS'),
('9357214', 'ORANGE, NAVEL OR VLNCA CHO 88', 'PACKER', 'Produce', '88 EA', 'CS'),
('7665508', 'TILAPIA, 5-7 Z FIL BNLS SHAL', 'HARBOR BNK', 'Protein', '10 LB', 'CS');