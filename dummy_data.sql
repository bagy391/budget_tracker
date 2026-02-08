-- ============================================
-- BUDGET TRACKER - DUMMY DATA SCRIPT
-- ============================================
-- This script creates 6 months of realistic dummy data for a family of 3 members
-- 
-- PREREQUISITES:
-- 1. Run this query first to get your family_id and user_id:
--    SELECT id, name FROM families WHERE user_id = auth.uid();
--    SELECT id, email FROM auth.users WHERE id = auth.uid();
--
-- 2. Replace the following variables in this script:
--    - YOUR_FAMILY_ID: Your actual family ID from the families table
--    - YOUR_USER_ID: Your actual user ID (the admin)
--
-- INSTRUCTIONS:
-- 1. Update the variables below with your actual IDs
-- 2. Run this entire script in Supabase SQL Editor
-- 3. Data will be created for the last 6 months from today
-- ============================================

-- ============================================
-- STEP 1: SET YOUR IDs HERE
-- ============================================
-- Replace these with your actual IDs:
DO $$
DECLARE
    v_family_id UUID := '6cba409d-339e-4847-87b1-0d08819b043e'; -- Replace with your family ID
    v_admin_user_id UUID := 'cf2c720d-e542-452c-8a69-b847197863a9'; -- Replace with your user ID
    
    -- Generated dummy user IDs (will be created)
    v_user2_id UUID := '7b4e0f02-4c5b-4820-a2c2-852be0540b5e';
    v_user3_id UUID := '83568832-ee72-408d-a929-dcbb53d4bf11';
    
    -- Category IDs
    v_cat_food UUID := gen_random_uuid();
    v_cat_transport UUID := gen_random_uuid();
    v_cat_utilities UUID := gen_random_uuid();
    v_cat_entertainment UUID := gen_random_uuid();
    v_cat_shopping UUID := gen_random_uuid();
    v_cat_health UUID := gen_random_uuid();
    v_cat_education UUID := gen_random_uuid();
    v_cat_salary UUID := gen_random_uuid();
    v_cat_freelance UUID := gen_random_uuid();
    
    -- Payment Method IDs
    v_pm_credit UUID := gen_random_uuid();
    v_pm_debit UUID := gen_random_uuid();
    v_pm_cash UUID := gen_random_uuid();
    
    v_month_offset INT;
    v_current_date DATE;
BEGIN
    -- ============================================
    -- STEP 2: CREATE ADDITIONAL FAMILY MEMBERS
    -- ============================================
    INSERT INTO family_members (family_id, user_id, role, joined_at)
    VALUES 
        (v_family_id, v_user2_id, 'member', NOW()),
        (v_family_id, v_user3_id, 'member', NOW());
    
    -- ============================================
    -- STEP 3: USE EXISTING OR CREATE CATEGORIES
    -- ============================================
    -- Check if categories exist, if not create them
    SELECT id INTO v_cat_food FROM categories WHERE family_id = v_family_id AND name = 'Food & Dining';
    IF v_cat_food IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Food & Dining', '🍔', 'expense', NOW())
        RETURNING id INTO v_cat_food;
    END IF;
    
    SELECT id INTO v_cat_transport FROM categories WHERE family_id = v_family_id AND name = 'Transportation';
    IF v_cat_transport IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Transportation', '🚗', 'expense', NOW())
        RETURNING id INTO v_cat_transport;
    END IF;
    
    SELECT id INTO v_cat_utilities FROM categories WHERE family_id = v_family_id AND name = 'Bills & Utilities';
    IF v_cat_utilities IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Bills & Utilities', '💡', 'expense', NOW())
        RETURNING id INTO v_cat_utilities;
    END IF;
    
    SELECT id INTO v_cat_entertainment FROM categories WHERE family_id = v_family_id AND name = 'Entertainment';
    IF v_cat_entertainment IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Entertainment', '🎬', 'expense', NOW())
        RETURNING id INTO v_cat_entertainment;
    END IF;
    
    SELECT id INTO v_cat_shopping FROM categories WHERE family_id = v_family_id AND name = 'Shopping';
    IF v_cat_shopping IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Shopping', '🛍️', 'expense', NOW())
        RETURNING id INTO v_cat_shopping;
    END IF;
    
    SELECT id INTO v_cat_health FROM categories WHERE family_id = v_family_id AND name = 'Healthcare';
    IF v_cat_health IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Healthcare', '🏥', 'expense', NOW())
        RETURNING id INTO v_cat_health;
    END IF;
    
    SELECT id INTO v_cat_education FROM categories WHERE family_id = v_family_id AND name = 'Education';
    IF v_cat_education IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Education', '📚', 'expense', NOW())
        RETURNING id INTO v_cat_education;
    END IF;
    
    SELECT id INTO v_cat_salary FROM categories WHERE family_id = v_family_id AND name = 'Salary';
    IF v_cat_salary IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Salary', '💰', 'income', NOW())
        RETURNING id INTO v_cat_salary;
    END IF;
    
    SELECT id INTO v_cat_freelance FROM categories WHERE family_id = v_family_id AND name = 'Freelance';
    IF v_cat_freelance IS NULL THEN
        INSERT INTO categories (id, family_id, name, icon, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Freelance', '💼', 'income', NOW())
        RETURNING id INTO v_cat_freelance;
    END IF;
    
    -- ============================================
    -- STEP 4: USE EXISTING OR CREATE PAYMENT METHODS
    -- ============================================
    SELECT id INTO v_pm_credit FROM payment_methods WHERE family_id = v_family_id AND name = 'Visa Credit Card';
    IF v_pm_credit IS NULL THEN
        INSERT INTO payment_methods (id, family_id, name, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Visa Credit Card', 'credit_card', NOW())
        RETURNING id INTO v_pm_credit;
    END IF;
    
    SELECT id INTO v_pm_debit FROM payment_methods WHERE family_id = v_family_id AND name = 'Chase Debit Card';
    IF v_pm_debit IS NULL THEN
        INSERT INTO payment_methods (id, family_id, name, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Chase Debit Card', 'bank', NOW())
        RETURNING id INTO v_pm_debit;
    END IF;
    
    SELECT id INTO v_pm_cash FROM payment_methods WHERE family_id = v_family_id AND name = 'Cash Wallet';
    IF v_pm_cash IS NULL THEN
        INSERT INTO payment_methods (id, family_id, name, type, created_at)
        VALUES (gen_random_uuid(), v_family_id, 'Cash Wallet', 'cash', NOW())
        RETURNING id INTO v_pm_cash;
    END IF;
    
    -- ============================================
    -- STEP 5: CREATE BUDGETS FOR LAST 6 MONTHS
    -- ============================================
    FOR v_month_offset IN 0..5 LOOP
        v_current_date := DATE_TRUNC('month', CURRENT_DATE) - (v_month_offset || ' months')::INTERVAL;
        
        INSERT INTO budgets (family_id, amount, start_date, end_date, created_at)
        VALUES (
            v_family_id,
            3000.00 + (RANDOM() * 500), -- Budget between $3000-$3500
            v_current_date,
            DATE_TRUNC('month', v_current_date) + INTERVAL '1 month' - INTERVAL '1 day',
            v_current_date
        );
    END LOOP;
    
    -- ============================================
    -- STEP 6: CREATE EXPENSES FOR LAST 6 MONTHS
    -- ============================================
    FOR v_month_offset IN 0..5 LOOP
        v_current_date := DATE_TRUNC('month', CURRENT_DATE) - (v_month_offset || ' months')::INTERVAL;
        
        -- Food & Dining (40-50 transactions per month)
        FOR i IN 1..45 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.33 THEN v_admin_user_id WHEN RANDOM() < 0.66 THEN v_user2_id ELSE v_user3_id END,
                CASE (RANDOM() * 10)::INT
                    WHEN 0 THEN 'Grocery Shopping'
                    WHEN 1 THEN 'Restaurant Dinner'
                    WHEN 2 THEN 'Coffee Shop'
                    WHEN 3 THEN 'Fast Food'
                    WHEN 4 THEN 'Lunch at Work'
                    WHEN 5 THEN 'Supermarket'
                    WHEN 6 THEN 'Pizza Delivery'
                    WHEN 7 THEN 'Breakfast'
                    WHEN 8 THEN 'Snacks'
                    ELSE 'Food Court'
                END,
                (RANDOM() * 90 + 10)::NUMERIC(10,2), -- $10-$100
                v_cat_food,
                CASE WHEN RANDOM() < 0.5 THEN v_pm_credit WHEN RANDOM() < 0.8 THEN v_pm_debit ELSE v_pm_cash END,
                v_current_date + (RANDOM() * 28)::INT + (RANDOM() * 24)::INT * INTERVAL '1 hour',
                v_current_date
            );
        END LOOP;
        
        -- Transportation (15-20 transactions per month)
        FOR i IN 1..18 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.5 THEN v_admin_user_id ELSE v_user2_id END,
                CASE (RANDOM() * 6)::INT
                    WHEN 0 THEN 'Gas Station'
                    WHEN 1 THEN 'Uber Ride'
                    WHEN 2 THEN 'Parking Fee'
                    WHEN 3 THEN 'Car Wash'
                    WHEN 4 THEN 'Metro Card'
                    ELSE 'Taxi'
                END,
                (RANDOM() * 70 + 5)::NUMERIC(10,2), -- $5-$75
                v_cat_transport,
                CASE WHEN RANDOM() < 0.6 THEN v_pm_credit ELSE v_pm_debit END,
                v_current_date + (RANDOM() * 28)::INT + (RANDOM() * 24)::INT * INTERVAL '1 hour',
                v_current_date
            );
        END LOOP;
        
        -- Utilities (5-8 per month)
        FOR i IN 1..6 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                v_admin_user_id,
                CASE (RANDOM() * 5)::INT
                    WHEN 0 THEN 'Electricity Bill'
                    WHEN 1 THEN 'Water Bill'
                    WHEN 2 THEN 'Internet Bill'
                    WHEN 3 THEN 'Phone Bill'
                    ELSE 'Gas Bill'
                END,
                (RANDOM() * 150 + 50)::NUMERIC(10,2), -- $50-$200
                v_cat_utilities,
                v_pm_debit,
                v_current_date + (5 + (RANDOM() * 20)::INT),
                v_current_date
            );
        END LOOP;
        
        -- Entertainment (10-15 per month)
        FOR i IN 1..12 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.4 THEN v_admin_user_id WHEN RANDOM() < 0.7 THEN v_user2_id ELSE v_user3_id END,
                CASE (RANDOM() * 8)::INT
                    WHEN 0 THEN 'Movie Tickets'
                    WHEN 1 THEN 'Netflix Subscription'
                    WHEN 2 THEN 'Concert Tickets'
                    WHEN 3 THEN 'Spotify Premium'
                    WHEN 4 THEN 'Gaming Purchase'
                    WHEN 5 THEN 'Book Purchase'
                    WHEN 6 THEN 'Streaming Service'
                    ELSE 'Sports Event'
                END,
                (RANDOM() * 80 + 10)::NUMERIC(10,2), -- $10-$90
                v_cat_entertainment,
                CASE WHEN RANDOM() < 0.7 THEN v_pm_credit ELSE v_pm_debit END,
                v_current_date + (RANDOM() * 28)::INT + (RANDOM() * 24)::INT * INTERVAL '1 hour',
                v_current_date
            );
        END LOOP;
        
        -- Shopping (8-12 per month)
        FOR i IN 1..10 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.5 THEN v_admin_user_id WHEN RANDOM() < 0.8 THEN v_user2_id ELSE v_user3_id END,
                CASE (RANDOM() * 6)::INT
                    WHEN 0 THEN 'Clothing Store'
                    WHEN 1 THEN 'Amazon Order'
                    WHEN 2 THEN 'Electronics'
                    WHEN 3 THEN 'Home Decor'
                    WHEN 4 THEN 'Shoes'
                    ELSE 'Accessories'
                END,
                (RANDOM() * 180 + 20)::NUMERIC(10,2), -- $20-$200
                v_cat_shopping,
                CASE WHEN RANDOM() < 0.8 THEN v_pm_credit ELSE v_pm_debit END,
                v_current_date + (RANDOM() * 28)::INT + (RANDOM() * 24)::INT * INTERVAL '1 hour',
                v_current_date
            );
        END LOOP;
        
        -- Healthcare (3-5 per month)
        FOR i IN 1..4 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.6 THEN v_admin_user_id ELSE v_user3_id END,
                CASE (RANDOM() * 4)::INT
                    WHEN 0 THEN 'Pharmacy'
                    WHEN 1 THEN 'Doctor Visit'
                    WHEN 2 THEN 'Dental Checkup'
                    ELSE 'Health Insurance'
                END,
                (RANDOM() * 120 + 30)::NUMERIC(10,2), -- $30-$150
                v_cat_health,
                v_pm_debit,
                v_current_date + (RANDOM() * 28)::INT,
                v_current_date
            );
        END LOOP;
        
        -- Education (2-4 per month)
        FOR i IN 1..3 LOOP
            INSERT INTO expenses (family_id, user_id, title, amount, category_id, payment_method_id, transaction_date, created_at)
            VALUES (
                v_family_id,
                v_user3_id,
                CASE (RANDOM() * 4)::INT
                    WHEN 0 THEN 'Course Fee'
                    WHEN 1 THEN 'Books'
                    WHEN 2 THEN 'Online Class'
                    ELSE 'Study Materials'
                END,
                (RANDOM() * 200 + 50)::NUMERIC(10,2), -- $50-$250
                v_cat_education,
                v_pm_credit,
                v_current_date + (RANDOM() * 28)::INT,
                v_current_date
            );
        END LOOP;
    END LOOP;
    
    -- ============================================
    -- STEP 7: CREATE INCOMES FOR LAST 6 MONTHS
    -- ============================================
    FOR v_month_offset IN 0..5 LOOP
        v_current_date := DATE_TRUNC('month', CURRENT_DATE) - (v_month_offset || ' months')::INTERVAL;
        
        -- Monthly Salaries
        INSERT INTO incomes (family_id, user_id, source, amount, date, created_at)
        VALUES 
            (v_family_id, v_admin_user_id, 'Monthly Salary - Admin', 4500.00, v_current_date + 1, v_current_date),
            (v_family_id, v_user2_id, 'Monthly Salary - Member 2', 3800.00, v_current_date + 1, v_current_date);
        
        -- Freelance work (random 1-3 per month)
        FOR i IN 1..(1 + (RANDOM() * 2)::INT) LOOP
            INSERT INTO incomes (family_id, user_id, source, amount, date, created_at)
            VALUES (
                v_family_id,
                CASE WHEN RANDOM() < 0.7 THEN v_admin_user_id ELSE v_user2_id END,
                'Freelance Project',
                (RANDOM() * 800 + 200)::NUMERIC(10,2), -- $200-$1000
                v_current_date + (5 + (RANDOM() * 20)::INT),
                v_current_date
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Dummy data created successfully for family: %', v_family_id;
    RAISE NOTICE 'Created data for 6 months with:';
    RAISE NOTICE '- 3 family members';
    RAISE NOTICE '- 9 categories (7 expense + 2 income)';
    RAISE NOTICE '- 3 payment methods';
    RAISE NOTICE '- 6 monthly budgets';
    RAISE NOTICE '- ~650 expense transactions';
    RAISE NOTICE '- ~50 income transactions';
END $$;
