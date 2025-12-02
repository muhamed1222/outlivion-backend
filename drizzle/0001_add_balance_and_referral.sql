-- Добавление полей balance и referredBy в таблицу users
ALTER TABLE users ADD COLUMN balance INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN referred_by UUID REFERENCES users(id);

-- Создание индекса для referred_by
CREATE INDEX referred_by_idx ON users(referred_by);

