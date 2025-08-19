SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('cards', 'card_tags') AND data_type = 'integer';
