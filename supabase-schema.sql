-- Supabase schema for Commander Deck Generator
-- Project ID: bykbnagijmxtfpkaflae

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cards table (main card data)
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    mana_cost TEXT,
    cmc NUMERIC,
    type_line TEXT,
    oracle_text TEXT,
    flavor_text TEXT,
    power TEXT,
    toughness TEXT,
    loyalty TEXT,
    color_identity JSONB DEFAULT '[]'::jsonb,
    colors JSONB DEFAULT '[]'::jsonb,
    keywords JSONB DEFAULT '[]'::jsonb,
    set_code TEXT,
    set_name TEXT,
    rarity TEXT,
    collector_number TEXT,
    legalities JSONB DEFAULT '{}'::jsonb,
    prices JSONB DEFAULT '{}'::jsonb,
    edhrec_rank INTEGER,
    image_uris JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scryfall_uri TEXT,
    
    -- Mechanics data (flattened from nested structure)
    primary_type TEXT,
    functional_roles JSONB DEFAULT '[]'::jsonb,
    synergy_keywords JSONB DEFAULT '[]'::jsonb,
    power_level NUMERIC DEFAULT 5,
    archetype_relevance JSONB DEFAULT '[]'::jsonb,
    last_analyzed TIMESTAMP WITH TIME ZONE,
    
    -- Indexes for performance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tags table (normalized for better queries)
CREATE TABLE card_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
    tag_name TEXT NOT NULL,
    tag_category TEXT,
    confidence NUMERIC,
    priority INTEGER,
    evidence JSONB DEFAULT '[]'::jsonb,
    is_manual BOOLEAN DEFAULT FALSE, -- Track manually added tags
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync status tracking
CREATE TABLE database_sync_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    last_full_sync TIMESTAMP WITH TIME ZONE,
    last_incremental_sync TIMESTAMP WITH TIME ZONE,
    total_cards INTEGER DEFAULT 0,
    sync_in_progress BOOLEAN DEFAULT FALSE,
    sync_progress INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tag blacklist
CREATE TABLE tag_blacklist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tag_name TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cards_name ON cards(name);
CREATE INDEX idx_cards_type_line ON cards(type_line);
CREATE INDEX idx_cards_color_identity ON cards USING GIN(color_identity);
CREATE INDEX idx_cards_colors ON cards USING GIN(colors);
CREATE INDEX idx_cards_legalities ON cards USING GIN(legalities);
CREATE INDEX idx_cards_cmc ON cards(cmc);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_set_code ON cards(set_code);
CREATE INDEX idx_cards_power_level ON cards(power_level);

CREATE INDEX idx_card_tags_card_id ON card_tags(card_id);
CREATE INDEX idx_card_tags_tag_name ON card_tags(tag_name);
CREATE INDEX idx_card_tags_category ON card_tags(tag_category);
CREATE INDEX idx_card_tags_manual ON card_tags(is_manual);

-- Full text search on card text
CREATE INDEX idx_cards_oracle_text_fts ON cards USING gin(to_tsvector('english', oracle_text));
CREATE INDEX idx_cards_name_fts ON cards USING gin(to_tsvector('english', name));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cards_updated_at 
    BEFORE UPDATE ON cards 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for easier queries
CREATE VIEW cards_with_tags AS
SELECT 
    c.*,
    COALESCE(
        json_agg(
            json_build_object(
                'name', ct.tag_name,
                'category', ct.tag_category,
                'confidence', ct.confidence,
                'priority', ct.priority,
                'evidence', ct.evidence,
                'is_manual', ct.is_manual
            )
        ) FILTER (WHERE ct.tag_name IS NOT NULL),
        '[]'::json
    ) as mechanic_tags
FROM cards c
LEFT JOIN card_tags ct ON c.id = ct.card_id
GROUP BY c.id;

-- Helper functions
CREATE OR REPLACE FUNCTION search_cards_by_name(search_term TEXT, result_limit INTEGER DEFAULT 20)
RETURNS TABLE(
    id UUID,
    name TEXT,
    type_line TEXT,
    mana_cost TEXT,
    cmc NUMERIC,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.type_line,
        c.mana_cost,
        c.cmc,
        similarity(c.name, search_term) as similarity_score
    FROM cards c
    WHERE c.name ILIKE '%' || search_term || '%'
       OR to_tsvector('english', c.name) @@ plainto_tsquery('english', search_term)
    ORDER BY similarity_score DESC, c.name
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (optional, for admin access)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE database_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_blacklist ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access (adjust based on your auth needs)
CREATE POLICY "Allow read access to cards" ON cards FOR SELECT USING (true);
CREATE POLICY "Allow read access to card_tags" ON card_tags FOR SELECT USING (true);

-- Admin policies (you'll need to set up proper auth)
-- CREATE POLICY "Allow admin full access to cards" ON cards FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
-- CREATE POLICY "Allow admin full access to card_tags" ON card_tags FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Insert initial sync status
INSERT INTO database_sync_status (total_cards) VALUES (0);