-- ============================================================
-- Full Delivery Zones for Hy_stepper
-- Greater Accra: zone-based flat fees per area
-- Outside Accra: base_fee + per_item_fee, with transport service
-- ============================================================

-- Add columns if they don't exist
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS per_item_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS transport_service TEXT;

-- Clear existing zones to avoid duplicates
DELETE FROM delivery_zones;

-- ============================================================
-- GREATER ACCRA ZONES (is_accra = true, per_item_fee = 0)
-- ============================================================

-- GH₵ 20 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Odorkor', true, 20.00, 0, NULL, true),
('Darkuman', true, 20.00, 0, NULL, true),
('Kwashieman', true, 20.00, 0, NULL, true),
('Nyamekye', true, 20.00, 0, NULL, true);

-- GH₵ 25 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Lapaz', true, 25.00, 0, NULL, true),
('Awoshie', true, 25.00, 0, NULL, true);

-- GH₵ 30 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Dansoman', true, 30.00, 0, NULL, true),
('Abeka', true, 30.00, 0, NULL, true),
('Tesano', true, 30.00, 0, NULL, true),
('Kaneshie', true, 30.00, 0, NULL, true),
('Bubuashie', true, 30.00, 0, NULL, true),
('Sakaman', true, 30.00, 0, NULL, true),
('Mallam', true, 30.00, 0, NULL, true),
('Sowutuom', true, 30.00, 0, NULL, true),
('Tantra Hills', true, 30.00, 0, NULL, true),
('Anyaa', true, 30.00, 0, NULL, true),
('Santa Maria', true, 30.00, 0, NULL, true),
('Abossey Okai', true, 30.00, 0, NULL, true),
('Laterbiokorshie', true, 30.00, 0, NULL, true);

-- GH₵ 35 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Adabraka', true, 35.00, 0, NULL, true),
('Dzorwulu', true, 35.00, 0, NULL, true),
('Roman Ridge', true, 35.00, 0, NULL, true),
('Abelempke', true, 35.00, 0, NULL, true),
('Chorkor', true, 35.00, 0, NULL, true),
('Mamprobi', true, 35.00, 0, NULL, true),
('Korle Bu', true, 35.00, 0, NULL, true),
('New Town', true, 35.00, 0, NULL, true),
('Kokomlemle', true, 35.00, 0, NULL, true),
('Nima', true, 35.00, 0, NULL, true),
('Maamobi', true, 35.00, 0, NULL, true),
('Kanda', true, 35.00, 0, NULL, true),
('Pig Farm', true, 35.00, 0, NULL, true),
('Taifa', true, 35.00, 0, NULL, true),
('Dome', true, 35.00, 0, NULL, true),
('Gbawe', true, 35.00, 0, NULL, true),
('McCarthy Hill', true, 35.00, 0, NULL, true),
('Weija', true, 35.00, 0, NULL, true),
('Ofankor', true, 35.00, 0, NULL, true),
('Kisseman', true, 35.00, 0, NULL, true),
('Shiashie', true, 35.00, 0, NULL, true),
('Ridge', true, 35.00, 0, NULL, true),
('West Ridge', true, 35.00, 0, NULL, true),
('North Ridge', true, 35.00, 0, NULL, true),
('South Ridge', true, 35.00, 0, NULL, true),
('Kotobabi', true, 35.00, 0, NULL, true),
('Alajo', true, 35.00, 0, NULL, true),
('Tudu', true, 35.00, 0, NULL, true),
('Circle', true, 35.00, 0, NULL, true),
('Ablekuma', true, 35.00, 0, NULL, true);

-- GH₵ 40 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Osu', true, 40.00, 0, NULL, true),
('Labone', true, 40.00, 0, NULL, true),
('Cantonments', true, 40.00, 0, NULL, true),
('East Legon', true, 40.00, 0, NULL, true),
('Airport Residential Area', true, 40.00, 0, NULL, true),
('Madina', true, 40.00, 0, NULL, true),
('East Airport', true, 40.00, 0, NULL, true),
('Teshie', true, 40.00, 0, NULL, true),
('Nungua', true, 40.00, 0, NULL, true),
('Spintex', true, 40.00, 0, NULL, true),
('Jamestown', true, 40.00, 0, NULL, true),
('Pokuase', true, 40.00, 0, NULL, true),
('North Legon', true, 40.00, 0, NULL, true),
('Ashaley Botwe', true, 40.00, 0, NULL, true),
('Haatso', true, 40.00, 0, NULL, true),
('Bawaleshie', true, 40.00, 0, NULL, true),
('West Hills', true, 40.00, 0, NULL, true),
('Kwabenya', true, 40.00, 0, NULL, true),
('Adjiringanor', true, 40.00, 0, NULL, true),
('Adenta', true, 40.00, 0, NULL, true),
('Batsona', true, 40.00, 0, NULL, true),
('Teshie Nungua', true, 40.00, 0, NULL, true),
('Labadi', true, 40.00, 0, NULL, true),
('Tseaddo', true, 40.00, 0, NULL, true),
('Burma Camp', true, 40.00, 0, NULL, true),
('Agbogba', true, 40.00, 0, NULL, true),
('Manet Junction', true, 40.00, 0, NULL, true),
('Legon Campus', true, 40.00, 0, NULL, true),
('Westland', true, 40.00, 0, NULL, true),
('Ashongman Estate', true, 40.00, 0, NULL, true);

-- GH₵ 45 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Amasaman', true, 45.00, 0, NULL, true),
('Frafraha', true, 45.00, 0, NULL, true),
('Sakumono', true, 45.00, 0, NULL, true),
('Klagon', true, 45.00, 0, NULL, true),
('Lashibi', true, 45.00, 0, NULL, true),
('Old Ashongman', true, 45.00, 0, NULL, true);

-- GH₵ 50 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('East Legon Hills', true, 50.00, 0, NULL, true),
('Tema (Comm. 1-20)', true, 50.00, 0, NULL, true),
('Ashaiman', true, 50.00, 0, NULL, true),
('Kasoa', true, 50.00, 0, NULL, true),
('Tuba', true, 50.00, 0, NULL, true),
('Oyarifa', true, 50.00, 0, NULL, true),
('Oyibi', true, 50.00, 0, NULL, true),
('Lakeside', true, 50.00, 0, NULL, true),
('Amrahia', true, 50.00, 0, NULL, true),
('Abokobi', true, 50.00, 0, NULL, true),
('Ashieyie', true, 50.00, 0, NULL, true);

-- GH₵ 60 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Santeo', true, 60.00, 0, NULL, true),
('Katamanso', true, 60.00, 0, NULL, true),
('Ayi Mensah', true, 60.00, 0, NULL, true);

-- GH₵ 70 Zone
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Tema (Comm. 21-25)', true, 70.00, 0, NULL, true),
('Michel Camp', true, 70.00, 0, NULL, true),
('Afienya', true, 70.00, 0, NULL, true),
('Dawhenye', true, 70.00, 0, NULL, true);

-- ============================================================
-- OUTSIDE ACCRA REGIONS (is_accra = false)
-- base_fee + per_item_fee per item
-- ============================================================
-- Outside Accra pricing: 1 item = GH₵60, 2 items = GH₵65 (capped), 3+ items = contact us
-- Transport: STC (Berekum, Cape Coast, Takoradi, Tarkwa, Techiman), VIP (Kumasi, Sunyani), OA (Bolga, Tamale, Wa)
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service, is_active) VALUES
('Berekum', false, 60.00, 5.00, 'STC', true),
('Bolgatanga', false, 60.00, 5.00, 'OA', true),
('Cape Coast', false, 60.00, 5.00, 'STC', true),
('Kumasi', false, 60.00, 5.00, 'VIP', true),
('Sunyani', false, 60.00, 5.00, 'VIP', true),
('Takoradi', false, 60.00, 5.00, 'STC', true),
('Tarkwa', false, 60.00, 5.00, 'STC', true),
('Tamale', false, 60.00, 5.00, 'OA', true),
('Techiman', false, 60.00, 5.00, 'STC', true),
('Wa', false, 60.00, 5.00, 'OA', true);
