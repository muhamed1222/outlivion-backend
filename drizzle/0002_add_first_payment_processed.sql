-- Add first_payment_processed column to track referral bonus eligibility
ALTER TABLE users ADD COLUMN first_payment_processed BOOLEAN DEFAULT FALSE;

