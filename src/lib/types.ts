export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  color_identity: string[];
  colors?: string[];
  legalities: {
    commander: 'legal' | 'not_legal' | 'banned' | 'restricted';
    [format: string]: string;
  };
  prices: {
    usd?: string;
    usd_foil?: string;
    eur?: string;
    tix?: string;
  };
  edhrec_rank?: number;
  keywords?: string[];
  set?: string;
  set_name?: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
}

export interface ScryfallSearchResponse {
  object: 'list';
  total_cards: number;
  has_more: boolean;
  next_page?: string;
  data: ScryfallCard[];
}

export interface DeckCard extends ScryfallCard {
  quantity: number;
  role: CardRole | string;
  tags: string[];
  synergy_notes?: string;
  replacement_suggestion?: string;
  price_used?: number;
  price_source?: string;
}

export type CardRole = 
  | 'Commander'
  | 'Ramp'
  | 'Draw/Advantage'
  | 'Removal/Interaction'
  | 'Board Wipe'
  | 'Tutor'
  | 'Protection'
  | 'Synergy/Wincon'
  | 'Land';

export interface CardTypeWeights {
  creatures: number;      // 0-10, default 5
  artifacts: number;      // 0-10, default 5  
  enchantments: number;   // 0-10, default 5
  instants: number;       // 0-10, default 5
  sorceries: number;      // 0-10, default 5
  planeswalkers: number;  // 0-10, default 5
}

export interface DeckWeightingSystem {
  // Card Type Preferences (0-10 scale)
  card_types: CardTypeWeights;
  
  // Function Priorities (based on EDH deck building principles)
  functions: {
    win_conditions: number;    // 0-10, default 7 (7+ cards recommended)
    ramp: number;             // 0-10, default 8 (8-12 cards recommended)
    card_draw: number;        // 0-10, default 8 (8-10 cards recommended) 
    removal: number;          // 0-10, default 7 (8-10 cards recommended)
    board_wipes: number;      // 0-10, default 5 (2+ cards recommended)
    protection: number;       // 0-10, default 6 (3-4 cards recommended)
    tutors: number;          // 0-10, default 4 (1-2 cards recommended)
    recursion: number;       // 0-10, default 4 (2-3 cards recommended)
  };
  
  // Theme Priorities
  themes: {
    tribal_synergy: number;   // 0-10, default 5
    combo_potential: number;  // 0-10, default 5
    go_wide_tokens: number;   // 0-10, default 5
    go_tall_voltron: number;  // 0-10, default 5
    control_elements: number; // 0-10, default 5
    aggressive_tempo: number; // 0-10, default 5
  };
  
  // Mana Curve Preferences
  curve: {
    low_cmc_preference: number;  // 0-10, default 5 (prefer 1-3 CMC)
    mid_cmc_preference: number;  // 0-10, default 5 (prefer 4-6 CMC) 
    high_cmc_preference: number; // 0-10, default 5 (prefer 7+ CMC)
  };
}

export interface GenerationConstraints {
  total_budget: number;
  max_card_price: number; // Maximum price per individual card
  per_card_cap?: number; // Legacy field, use max_card_price instead
  prefer_cheapest: boolean;
  keywords?: string[]; // User-specified keywords/themes to emphasize
  keyword_focus?: string[]; // Legacy field, use keywords instead
  card_type_weights?: CardTypeWeights; // Card type preferences (0-10 scale)
  random_tags?: string[]; // Randomly selected tags for variety (added during generation)
}

export interface DeckComposition {
  lands: number;
  ramp: number;
  draw: number;
  removal: number;
  board_wipes: number;
  tutors: number;
  protection: number; // Added per guide recommendations (3-5 protection effects)
  synergy: number;
}

export interface GeneratedDeck {
  commander: DeckCard;
  nonland_cards: DeckCard[];
  lands: DeckCard[];
  total_price: number;
  role_breakdown: Record<CardRole, number>;
  warnings: string[];
  generation_notes: string[];
  deck_explanation: string;
  random_tags?: string[]; // Random tags selected for this generation
}

export interface PowerLevelConfig {
  tutors_allowed: number;
  fast_mana_allowed: boolean;
  combo_tolerance: 'none' | 'soft' | 'open';
  avg_mv_target: number;
  interaction_density: number;
  deck_composition: DeckComposition;
}

export interface ExportFormats {
  text: string;
  csv: string;
  archidekt_url: string;
  moxfield_url: string;
}

export interface LocalCardData {
  id: string;                    // Scryfall ID
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  color_identity: string[];
  colors?: string[];
  keywords?: string[];
  set_code: string;
  set_name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';
  collector_number: string;
  legalities: {
    commander: 'legal' | 'not_legal' | 'banned' | 'restricted';
    standard?: string;
    pioneer?: string;
    modern?: string;
    legacy?: string;
    vintage?: string;
    [format: string]: string | undefined;
  };
  prices: {
    usd?: string;
    usd_foil?: string;
    eur?: string;
    tix?: string;
  };
  edhrec_rank?: number;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
  // Metadata
  last_updated: string;          // ISO date string
  scryfall_uri: string;
  
  // Enhanced mechanics analysis
  mechanics?: CardMechanicsData;
}

export interface CardMechanicsData {
  primaryType: string;           // creature, artifact, etc.
  functionalRoles: string[];     // ramp, draw, removal, etc.
  mechanicTags: MechanicTag[];   // All detected mechanics
  synergyKeywords: string[];     // Keywords for synergy matching
  powerLevel: number;            // 1-10 estimated power level
  archetypeRelevance: string[];  // Which archetypes this fits
  lastAnalyzed: string;          // ISO date string
}

export interface MechanicTag {
  name: string;          // The mechanic name (e.g., "token_creation", "landfall", "sacrifice_outlet")
  category: string;      // Category (e.g., "resource_generation", "triggers", "activated_abilities")
  confidence: number;    // 0-1, how confident we are this applies
  evidence: string[];    // Text snippets that triggered this tag
  priority: number;      // 1-10, how important this mechanic is for the card
}

export interface DatabaseSyncStatus {
  last_full_sync: string | null;  // ISO date string
  last_incremental_sync: string | null;
  total_cards: number;
  sync_in_progress: boolean;
  sync_progress: number;         // 0-100
  last_error?: string;
}