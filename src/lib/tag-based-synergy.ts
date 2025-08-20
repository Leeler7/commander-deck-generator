import { CardMechanics, MechanicTag } from './card-mechanics-tagger';
import { ScryfallCard, LocalCardData } from './types';
import { calculateTribalBonus } from './tribal-analysis';

/**
 * Tag-Based Synergy Scoring System
 * Uses card tags to calculate synergy scores instead of text matching
 */

export interface TagSynergyRule {
  commanderTags: string[];  // Tags the commander must have
  cardTag: string;          // Tag the card must have
  score: number;            // Synergy score to add
  description: string;      // Why this synergy exists
}

export interface CommanderProfile {
  name: string;
  tags: string[];
  strategies: string[];
}

export class TagBasedSynergyScorer {
  private synergyRules: TagSynergyRule[] = [
    // ===========================================
    // COMPREHENSIVE SYNERGY RULES
    // Based on 200+ mechanics from our tagging system
    // ===========================================
    
    // COUNTER SYNERGIES (High Priority)
    {
      commanderTags: ['hydra_tribal', 'counter_matters', '+1/+1_counter_synergy'],
      cardTag: 'counter_doubling_all_types',
      score: 45,
      description: 'Doubling Season doubles ALL counters - perfect for counter strategies'
    },
    {
      commanderTags: ['hydra_tribal', 'counter_matters'],
      cardTag: 'counter_doubling_creature_plus_one',
      score: 42,
      description: 'Branching Evolution optimized for creature +1/+1 strategies'
    },
    {
      commanderTags: ['counter_matters', '+1/+1_counter_synergy'],
      cardTag: 'counter_doubling_plus_one_only',
      score: 38,
      description: 'Specialized +1/+1 counter doubling effects'
    },
    {
      commanderTags: ['counter_matters'],
      cardTag: 'proliferate',
      score: 25,
      description: 'Proliferate synergizes with any counter strategy'
    },
    {
      commanderTags: ['counter_matters'],
      cardTag: '+1/+1_counter_synergy',
      score: 20,
      description: 'Direct +1/+1 counter synergies'
    },
    {
      commanderTags: ['hydra_tribal', 'counter_matters'],
      cardTag: 'counter_addition_single',
      score: 15,
      description: 'Single counter additions provide incremental value'
    },
    
    // ENTER THE BATTLEFIELD SYNERGIES
    // === CRITICAL DISTINCTION: ETB Payoffs vs Self-Triggers ===
    
    // GENERIC ETB PAYOFFS - Cards that trigger when ANY creature enters (PERFECT for Norin-style commanders)
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_payoff_generic',
      score: 100,
      description: 'Generic ETB payoffs are PERFECT for ETB enablers like Norin - these cards trigger every time he enters!'
    },
    {
      commanderTags: ['etb_enabler', 'flicker_effect'],
      cardTag: 'etb_payoff_generic',
      score: 95,
      description: 'Generic ETB payoffs create massive value engines with repeated ETB effects'
    },
    
    // TRIBAL ETB PAYOFFS - Only good for matching tribal commanders
    {
      commanderTags: ['dragon_tribal', 'dragon_matters'],
      cardTag: 'etb_payoff_dragon',
      score: 85,
      description: 'Dragon ETB payoffs are excellent for dragon tribal strategies'
    },
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'etb_payoff_elf',
      score: 85,
      description: 'Elf ETB payoffs are excellent for elf tribal strategies'
    },
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'etb_payoff_goblin',
      score: 85,
      description: 'Goblin ETB payoffs are excellent for goblin tribal strategies'
    },
    {
      commanderTags: ['dinosaur_tribal', 'dinosaur_matters'],
      cardTag: 'etb_payoff_dinosaur',
      score: 90,
      description: 'Dinosaur ETB payoffs like Marauding Raptor are excellent for dinosaur tribal strategies'
    },
    // Special case: Commanders that benefit from damage to own creatures
    {
      commanderTags: ['enrage', 'damage_matters'],
      cardTag: 'etb_payoff_dinosaur',
      score: 70,
      description: 'Marauding Raptor can trigger enrage abilities on your creatures'
    },
    
    // ANTI-SYNERGY: Tribal ETB payoffs with wrong commanders
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_payoff_dragon',
      score: -20,
      description: 'Dragon-specific ETB payoffs do not work with non-dragon ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_payoff_elf',
      score: -20,
      description: 'Elf-specific ETB payoffs do not work with non-elf ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_payoff_goblin',
      score: -20,
      description: 'Goblin-specific ETB payoffs do not work with non-goblin ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_payoff_dinosaur',
      score: -100,
      description: 'Dinosaur-specific ETB payoffs like Marauding Raptor actively HARM non-dinosaur creatures'
    },
    
    // Specific high-value ETB payoff effects
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_damage_dealer',
      score: 90,
      description: 'ETB damage dealers are ESSENTIAL with ETB enablers like Norin - game-winning combo!'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_damage',
      score: 90,
      description: 'ETB damage effects are ESSENTIAL with ETB enablers like Norin - game-winning combo!'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_draw',
      score: 70,
      description: 'ETB card draw provides massive value with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_destroy',
      score: 65,
      description: 'ETB removal effects are powerful with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_token_creation',
      score: 75,
      description: 'ETB token creation multiplies board presence with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_ramp',
      score: 60,
      description: 'ETB ramp accelerates with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_tutor',
      score: 65,
      description: 'ETB tutors provide massive card advantage with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_counter_manipulation',
      score: 55,
      description: 'ETB counter effects scale with ETB enablers'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_mill',
      score: 50,
      description: 'ETB mill effects accelerate graveyard strategies'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_scry',
      score: 45,
      description: 'ETB scry provides card selection value'
    },
    // ETB SELF-TRIGGERS - Regular ETB effects (good but not perfect for ETB enablers)
    {
      commanderTags: ['etb_enabler', 'flicker_effect'],
      cardTag: 'etb_trigger_creature',
      score: 35,
      description: 'Regular ETB creatures provide some value with ETB enablers (but payoffs are better)'
    },
    {
      commanderTags: ['etb_enabler'],
      cardTag: 'etb_trigger_self',
      score: 25,
      description: 'Self-ETB effects provide moderate value with ETB enablers'
    },
    {
      commanderTags: ['etb_matters', 'flicker_strategy'],
      cardTag: 'etb_triggered_ability',
      score: 30,
      description: 'ETB abilities synergize perfectly with flicker strategies'
    },
    {
      commanderTags: ['flicker_strategy', 'exile_matters'],
      cardTag: 'flicker_ability',
      score: 35,
      description: 'Flicker effects multiply ETB value'
    },
    {
      commanderTags: ['etb_matters', 'etb_enabler'],
      cardTag: 'creature_token_creation',
      score: 5,
      description: 'Generic token creation provides minimal ETB triggers for enablers'
    },
    
    // TOKEN SYNERGIES
    {
      commanderTags: ['token_creation', 'token_matters', 'go_wide_strategy'],
      cardTag: 'token_doubling',
      score: 40,
      description: 'Token doublers exponentially increase token strategies'
    },
    {
      commanderTags: ['token_matters'],
      cardTag: 'creature_token_creation',
      score: 8,
      description: 'Generic token generators provide minimal value and board presence'
    },
    {
      commanderTags: ['token_creation'],
      cardTag: 'sacrifice_outlet',
      score: 22,
      description: 'Sacrifice outlets turn tokens into value'
    },
    {
      commanderTags: ['token_matters', 'sacrifice_strategy'],
      cardTag: 'aristocrats',
      score: 28,
      description: 'Aristocrat effects profit from token sacrifice'
    },
    
    // TRIBAL TOKEN SYNERGIES (specific tribal token creation)
    {
      commanderTags: ['elf_matters', 'tribal_elf'],
      cardTag: 'elf_token_creation',
      score: 70,
      description: 'Elf token creation is ESSENTIAL for elf-matters strategies'
    },
    {
      commanderTags: ['wolf_matters', 'tribal_wolf'],
      cardTag: 'wolf_token_creation',
      score: 70,
      description: 'Wolf token creation is ESSENTIAL for wolf-matters strategies'
    },
    {
      commanderTags: ['goblin_matters', 'tribal_goblin'],
      cardTag: 'goblin_token_creation',
      score: 70,
      description: 'Goblin token creation is ESSENTIAL for goblin-matters strategies'
    },
    
    // ARTIFACT SYNERGIES
    {
      commanderTags: ['artifact_matters', 'artifact_strategy'],
      cardTag: 'artifact_cost_reduction',
      score: 30,
      description: 'Cost reduction enables powerful artifact plays'
    },
    {
      commanderTags: ['artifact_matters'],
      cardTag: 'artifact_recursion',
      score: 25,
      description: 'Artifact recursion provides long-term value'
    },
    {
      commanderTags: ['artifact_strategy'],
      cardTag: 'artifact_token_creation',
      score: 20,
      description: 'Artifact tokens provide board presence and synergy'
    },
    {
      commanderTags: ['artifact_matters'],
      cardTag: 'equipment',
      score: 18,
      description: 'Equipment provides artifact count and utility'
    },
    
    // GRAVEYARD SYNERGIES
    {
      commanderTags: ['graveyard_matters', 'reanimator_strategy'],
      cardTag: 'self_mill',
      score: 25,
      description: 'Self-mill enables graveyard strategies'
    },
    {
      commanderTags: ['graveyard_matters'],
      cardTag: 'recursion',
      score: 28,
      description: 'Recursion extracts value from graveyard'
    },
    {
      commanderTags: ['reanimator_strategy'],
      cardTag: 'reanimation',
      score: 35,
      description: 'Reanimation is core to reanimator strategies'
    },
    {
      commanderTags: ['graveyard_matters'],
      cardTag: 'graveyard_hate',
      score: -15,
      description: 'Graveyard hate hurts graveyard-based strategies'
    },
    
    // LANDFALL AND RAMP SYNERGIES
    {
      commanderTags: ['landfall', 'land_matters'],
      cardTag: 'fetchland',
      score: 28,
      description: 'Fetchlands trigger landfall twice'
    },
    {
      commanderTags: ['landfall'],
      cardTag: 'land_ramp',
      score: 22,
      description: 'Ramp spells trigger landfall'
    },
    {
      commanderTags: ['land_matters'],
      cardTag: 'extra_land_drops',
      score: 25,
      description: 'Extra land drops accelerate land strategies'
    },
    {
      commanderTags: ['landfall', 'land_matters'],
      cardTag: 'landfall_ability',
      score: 35,
      description: 'Landfall abilities are core to land strategies'
    },
    
    // SPELL SYNERGIES
    {
      commanderTags: ['spellslinger', 'instant_sorcery_matters'],
      cardTag: 'spell_copy',
      score: 32,
      description: 'Spell copying multiplies spellslinger value'
    },
    {
      commanderTags: ['spellslinger'],
      cardTag: 'cost_reduction_instants_sorceries',
      score: 25,
      description: 'Cost reduction enables more spells per turn'
    },
    {
      commanderTags: ['instant_sorcery_matters'],
      cardTag: 'cantrip',
      score: 18,
      description: 'Cantrips provide spell count and card selection'
    },
    {
      commanderTags: ['spellslinger'],
      cardTag: 'storm',
      score: 30,
      description: 'Storm synergizes with high spell count'
    },
    
    // COMBAT SYNERGIES
    {
      commanderTags: ['voltron', 'equipment_matters'],
      cardTag: 'equipment',
      score: 30,
      description: 'Equipment is essential for voltron strategies'
    },
    {
      commanderTags: ['combat_matters', 'attack_trigger'],
      cardTag: 'extra_combat',
      score: 35,
      description: 'Extra combat multiplies attack triggers'
    },
    {
      commanderTags: ['combat_matters'],
      cardTag: 'combat_trick',
      score: 20,
      description: 'Combat tricks support aggressive strategies'
    },
    {
      commanderTags: ['voltron'],
      cardTag: 'protection_ability',
      score: 25,
      description: 'Protection preserves voltron investments'
    },
    
    // TRIBAL SYNERGIES (HEAVILY BOOSTED)
    {
      commanderTags: ['tribal', 'creature_tribal'],
      cardTag: 'lord_effect',
      score: 45,
      description: 'Lords are CRITICAL for tribal strategies'
    },
    {
      commanderTags: ['tribal', 'creature_tribal'],
      cardTag: 'tribal_anthem_shared',
      score: 50,
      description: 'Coat of Arms effects are EXCELLENT for tribal strategies - rewards tribal density'
    },
    {
      commanderTags: ['go_wide_strategy', 'token_creation'],
      cardTag: 'tribal_anthem_shared',
      score: 40,
      description: 'Shared-type anthems like Coat of Arms excel with token strategies'
    },
    
    // SPECIFIC TRIBAL SYNERGIES - Saproling/Fungus
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'saproling_tribal',
      score: 100,
      description: 'Saproling tribal cards synergize perfectly with Saproling/Fungus commanders'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'fungus_tribal',
      score: 80,
      description: 'Fungus and Saproling tribes work together synergistically'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'saproling_token_creation',
      score: 90,
      description: 'Saproling token creation is ESSENTIAL for Saproling/Fungus strategies'
    },
    
    // Additional specific tribal token synergies
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'elf_token_creation',
      score: 90,
      description: 'Elf token creation is ESSENTIAL for Elf tribal strategies'
    },
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'goblin_token_creation',
      score: 90,
      description: 'Goblin token creation is ESSENTIAL for Goblin tribal strategies'
    },
    {
      commanderTags: ['zombie_tribal', 'zombie_matters'],
      cardTag: 'zombie_token_creation',
      score: 90,
      description: 'Zombie token creation is ESSENTIAL for Zombie tribal strategies'
    },
    {
      commanderTags: ['wolf_tribal', 'wolf_matters'],
      cardTag: 'wolf_token_creation',
      score: 90,
      description: 'Wolf token creation is ESSENTIAL for Wolf tribal strategies'
    },
    {
      commanderTags: ['squirrel_tribal', 'squirrel_matters'],
      cardTag: 'squirrel_token_creation',
      score: 90,
      description: 'Squirrel token creation is ESSENTIAL for Squirrel tribal strategies'
    },
    {
      commanderTags: ['squirrel_tribal', 'squirrel_matters'],
      cardTag: 'squirrel_token_matters',
      score: 95,
      description: 'Cards with conditional Squirrel token bonuses are EXCELLENT for Squirrel strategies'
    },
    
    // ANTI-SYNERGY: Wrong tribal types with tribal commanders
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'snake_tribal',
      score: -50,
      description: 'Snake tribal cards do not synergize with Saproling/Fungus strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'insect_tribal',
      score: -30,
      description: 'Insect tribal cards have limited synergy with Saproling/Fungus strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'elf_tribal',
      score: -40,
      description: 'Elf tribal cards do not synergize with Saproling/Fungus strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'goblin_tribal',
      score: -40,
      description: 'Goblin tribal cards do not synergize with Saproling/Fungus strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'vampire_tribal',
      score: -40,
      description: 'Vampire tribal cards do not synergize with Saproling/Fungus strategies'
    },
    
    // ANTI-SYNERGY: Wrong token types with tribal token commanders (MUCH STRONGER PENALTIES)
    
    // SAPROLING/FUNGUS tribal anti-synergies
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'elf_token_creation',
      score: -120,
      description: 'Elf token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'goblin_token_creation',
      score: -120,
      description: 'Goblin token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'wolf_token_creation',
      score: -120,
      description: 'Wolf token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'vampire_token_creation',
      score: -120,
      description: 'Vampire token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'zombie_token_creation',
      score: -120,
      description: 'Zombie token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'spirit_token_creation',
      score: -120,
      description: 'Spirit token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'soldier_token_creation',
      score: -120,
      description: 'Soldier token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'human_token_creation',
      score: -120,
      description: 'Human token creation completely conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'beast_token_creation',
      score: -100,
      description: 'Beast token creation conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'insect_token_creation',
      score: -80,
      description: 'Insect token creation conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'spider_token_creation',
      score: -80,
      description: 'Spider token creation conflicts with Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'plant_token_creation',
      score: -40,
      description: 'Plant token creation not optimal for Saproling/Fungus tribal strategies'
    },
    {
      commanderTags: ['saproling_tribal', 'fungus_tribal'],
      cardTag: 'fungus_token_creation',
      score: 85,
      description: 'Fungus token creation synergizes well with Saproling/Fungus strategies'
    },
    
    // ELF tribal anti-synergies
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'goblin_token_creation',
      score: -120,
      description: 'Goblin token creation completely conflicts with Elf tribal strategies'
    },
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'saproling_token_creation',
      score: -120,
      description: 'Saproling token creation completely conflicts with Elf tribal strategies'
    },
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'zombie_token_creation',
      score: -120,
      description: 'Zombie token creation completely conflicts with Elf tribal strategies'
    },
    {
      commanderTags: ['elf_tribal', 'elf_matters'],
      cardTag: 'human_token_creation',
      score: -100,
      description: 'Human token creation conflicts with Elf tribal strategies'
    },
    
    // GOBLIN tribal anti-synergies
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'elf_token_creation',
      score: -120,
      description: 'Elf token creation completely conflicts with Goblin tribal strategies'
    },
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'saproling_token_creation',
      score: -120,
      description: 'Saproling token creation completely conflicts with Goblin tribal strategies'
    },
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'spirit_token_creation',
      score: -120,
      description: 'Spirit token creation completely conflicts with Goblin tribal strategies'
    },
    {
      commanderTags: ['goblin_tribal', 'goblin_matters'],
      cardTag: 'human_token_creation',
      score: -100,
      description: 'Human token creation conflicts with Goblin tribal strategies'
    },
    
    // ZOMBIE tribal anti-synergies
    {
      commanderTags: ['zombie_tribal', 'zombie_matters'],
      cardTag: 'elf_token_creation',
      score: -120,
      description: 'Elf token creation completely conflicts with Zombie tribal strategies'
    },
    {
      commanderTags: ['zombie_tribal', 'zombie_matters'],
      cardTag: 'goblin_token_creation',
      score: -120,
      description: 'Goblin token creation completely conflicts with Zombie tribal strategies'
    },
    {
      commanderTags: ['zombie_tribal', 'zombie_matters'],
      cardTag: 'saproling_token_creation',
      score: -120,
      description: 'Saproling token creation completely conflicts with Zombie tribal strategies'
    },
    {
      commanderTags: ['zombie_tribal', 'zombie_matters'],
      cardTag: 'human_token_creation',
      score: -80,
      description: 'Human token creation conflicts with Zombie tribal strategies'
    },
    
    // SQUIRREL tribal anti-synergies
    {
      commanderTags: ['squirrel_tribal', 'squirrel_matters'],
      cardTag: 'elf_token_creation',
      score: -120,
      description: 'Elf token creation completely conflicts with Squirrel tribal strategies'
    },
    {
      commanderTags: ['squirrel_tribal', 'squirrel_matters'],
      cardTag: 'goblin_token_creation',
      score: -120,
      description: 'Goblin token creation completely conflicts with Squirrel tribal strategies'
    },
    {
      commanderTags: ['squirrel_tribal', 'squirrel_matters'],
      cardTag: 'saproling_token_creation',
      score: -120,
      description: 'Saproling token creation completely conflicts with Squirrel tribal strategies'
    },
    {
      commanderTags: ['tribal'],
      cardTag: 'changeling',
      score: 35,
      description: 'Changelings are valuable tribal creatures'
    },
    {
      commanderTags: ['elf_tribal'],
      cardTag: 'elf_tribal',
      score: 55,
      description: 'Elf tribal synergies are ESSENTIAL'
    },
    {
      commanderTags: ['goblin_tribal'],
      cardTag: 'goblin_tribal',
      score: 55,
      description: 'Goblin tribal synergies are ESSENTIAL'
    },
    {
      commanderTags: ['dragon_tribal'],
      cardTag: 'dragon_tribal',
      score: 55,
      description: 'Dragon tribal synergies are ESSENTIAL'
    },
    
    // ENHANCED: "X MATTERS" TRIBAL SYNERGIES (for commanders that care about creature counts)
    {
      commanderTags: ['elf_matters'],
      cardTag: 'tribal_elf',
      score: 50,
      description: 'Elf tribal effects are ESSENTIAL for elf-matters commanders like Voja'
    },
    {
      commanderTags: ['wolf_matters'],
      cardTag: 'tribal_wolf',
      score: 50,
      description: 'Wolf tribal effects are ESSENTIAL for wolf-matters commanders like Voja'
    },
    {
      commanderTags: ['goblin_matters'],
      cardTag: 'tribal_goblin',
      score: 50,
      description: 'Goblin tribal effects are ESSENTIAL for goblin-matters commanders'
    },
    {
      commanderTags: ['dragon_matters'],
      cardTag: 'tribal_dragon',
      score: 50,
      description: 'Dragon tribal effects are ESSENTIAL for dragon-matters commanders'
    },
    {
      commanderTags: ['hydra_matters'],
      cardTag: 'tribal_hydra',
      score: 50,
      description: 'Hydra tribal effects are ESSENTIAL for hydra-matters commanders'
    },
    
    // SACRIFICE SYNERGIES
    {
      commanderTags: ['sacrifice_strategy', 'sacrifice_matters'],
      cardTag: 'sacrifice_outlet',
      score: 25,
      description: 'Sacrifice outlets enable sacrifice strategies'
    },
    {
      commanderTags: ['sacrifice_matters'],
      cardTag: 'aristocrats',
      score: 28,
      description: 'Aristocrat effects profit from sacrifice'
    },
    {
      commanderTags: ['sacrifice_strategy'],
      cardTag: 'death_trigger',
      score: 22,
      description: 'Death triggers provide sacrifice value'
    },
    
    // CARD DRAW AND SELECTION
    {
      commanderTags: ['card_draw_matters', 'draw_strategy'],
      cardTag: 'card_draw',
      score: 20,
      description: 'Card draw provides card advantage'
    },
    {
      commanderTags: ['draw_strategy'],
      cardTag: 'card_selection',
      score: 18,
      description: 'Card selection improves consistency'
    },
    
    // MANA AND RAMP
    {
      commanderTags: ['ramp_strategy', 'big_mana'],
      cardTag: 'mana_ramp',
      score: 22,
      description: 'Ramp enables big mana strategies'
    },
    {
      commanderTags: ['big_mana'],
      cardTag: 'x_spell',
      score: 25,
      description: 'X spells scale with available mana'
    },
    
    // CONTROL AND INTERACTION
    {
      commanderTags: ['control_strategy'],
      cardTag: 'counterspell',
      score: 20,
      description: 'Counterspells support control strategies'
    },
    {
      commanderTags: ['control_strategy'],
      cardTag: 'removal',
      score: 18,
      description: 'Removal maintains board control'
    },
    
    // PLANESWALKER SYNERGIES
    {
      commanderTags: ['planeswalker_matters', 'superfriends'],
      cardTag: 'planeswalker_loyalty_doubling',
      score: 50,
      description: 'Loyalty doubling is game-breaking for superfriends'
    },
    {
      commanderTags: ['planeswalker_matters'],
      cardTag: 'counter_doubling_all_types',
      score: 45,
      description: 'Doubling Season affects loyalty counters'
    },
    {
      commanderTags: ['superfriends'],
      cardTag: 'planeswalker_protection',
      score: 30,
      description: 'Protection keeps planeswalkers alive'
    },
    
    // LIFEGAIN SYNERGIES
    {
      commanderTags: ['lifegain_matters'],
      cardTag: 'lifegain',
      score: 20,
      description: 'Lifegain triggers lifegain-matters effects'
    },
    {
      commanderTags: ['lifegain_strategy'],
      cardTag: 'lifegain_payoff',
      score: 25,
      description: 'Lifegain payoffs convert life to advantage'
    },
    
    // GRAVEYARD HATE (Anti-synergy)
    {
      commanderTags: ['graveyard_matters', 'reanimator_strategy'],
      cardTag: 'graveyard_hate',
      score: -20,
      description: 'Graveyard hate disrupts graveyard strategies'
    },
    
    // STAX AND PRISON (Context dependent)
    {
      commanderTags: ['stax_strategy'],
      cardTag: 'stax_effect',
      score: 25,
      description: 'Stax effects support prison strategies'
    },
    
    // GLOBAL EFFECTS (Risk/Reward)
    {
      commanderTags: ['tribal', 'creature_tribal'],
      cardTag: 'global_anthem',
      score: 20,
      description: 'Global anthems like Coat of Arms help tribal decks but also benefit opponents'
    },
    
    // HARMFUL EFFECTS (Should only be used in very specific strategies)
    {
      commanderTags: ['creature_tribal', 'token_creation', 'go_wide_strategy'],
      cardTag: 'etb_payoff_dinosaur',
      score: -150,
      description: 'Cards like Marauding Raptor destroy go-wide strategies by damaging your own creatures'
    },
    {
      commanderTags: ['creature_tribal', 'token_creation', 'go_wide_strategy', 'etb_enabler'],
      cardTag: 'creature_hostile_etb',
      score: -200,
      description: 'Creature-hostile ETB effects like Aether Flash and Marauding Raptor destroy creature strategies'
    },
    
    // ===========================================
    // LEGACY RULES (keeping existing ones)
    // ===========================================
    {
      commanderTags: ['hydra_tribal', 'counter_matters'],
      cardTag: 'counter_doubling_creature_plus_one',
      score: 38,
      description: 'Branching Evolution is optimal for creature +1/+1 strategies'
    },
    {
      commanderTags: ['hydra_tribal', 'counter_matters'],
      cardTag: 'counter_doubling_plus_one_only',
      score: 35,
      description: 'Primal Vigor doubles +1/+1 counters effectively'
    },
    {
      commanderTags: ['counter_matters'],
      cardTag: 'counter_doubling_general',
      score: 30,
      description: 'Generic counter doubling is valuable'
    },
    {
      commanderTags: ['hydra_tribal', 'counter_matters'],
      cardTag: 'counter_addition_single',
      score: 12,
      description: 'Single counter additions are good but less impactful'
    },
    {
      commanderTags: ['counter_matters'],
      cardTag: 'proliferate',
      score: 18,
      description: 'Proliferate synergizes well with counter strategies'
    },
    
    // NUANCED Token synergies
    {
      commanderTags: ['token_creation', 'token_matters'],
      cardTag: 'token_doubling',
      score: 35,
      description: 'Token doublers multiply token production'
    },
    {
      commanderTags: ['token_creation'],
      cardTag: 'counter_doubling_all_types',
      score: 20,
      description: 'Doubling Season also doubles tokens, providing some value'
    },
    
    // Planeswalker synergies
    {
      commanderTags: ['planeswalker_matters', 'superfriends'],
      cardTag: 'planeswalker_loyalty_doubling',
      score: 45,
      description: 'Doubling Season doubles planeswalker loyalty - game-breaking'
    },
    {
      commanderTags: ['planeswalker_matters'],
      cardTag: 'counter_doubling_all_types',
      score: 40,
      description: 'Doubling Season affects loyalty counters'
    },
    
    // Token and sacrifice synergies
    {
      commanderTags: ['token_creation', 'sacrifice_outlet'],
      cardTag: 'aristocrats',
      score: 25,
      description: 'Aristocrats effects synergize with token sacrifice'
    },
    {
      commanderTags: ['treasure_matters'],
      cardTag: 'treasure_token_creation',
      score: 22,
      description: 'Treasure tokens provide mana and artifact synergies'
    },
    
    // Landfall synergies
    {
      commanderTags: ['landfall'],
      cardTag: 'fetchland',
      score: 20,
      description: 'Fetchlands trigger landfall twice'
    },
    {
      commanderTags: ['landfall'],
      cardTag: 'land_ramp',
      score: 15,
      description: 'Ramp spells trigger landfall'
    },
    
    // Artifact synergies
    {
      commanderTags: ['artifact_matters'],
      cardTag: 'artifact_cost_reduction',
      score: 22,
      description: 'Cost reduction is powerful for artifact strategies'
    },
    {
      commanderTags: ['artifact_matters'],
      cardTag: 'artifact_recursion',
      score: 20,
      description: 'Recursion provides value in artifact decks'
    },
    
    // Spell synergies
    {
      commanderTags: ['spellslinger', 'instant_sorcery_matters'],
      cardTag: 'spell_copy',
      score: 25,
      description: 'Copying spells multiplies value'
    },
    {
      commanderTags: ['spellslinger'],
      cardTag: 'cost_reduction_instants_sorceries',
      score: 20,
      description: 'Cost reduction enables more spells per turn'
    },
    
    // Graveyard synergies
    {
      commanderTags: ['graveyard_matters', 'reanimator'],
      cardTag: 'self_mill',
      score: 18,
      description: 'Self-mill fills the graveyard'
    },
    {
      commanderTags: ['graveyard_matters'],
      cardTag: 'recursion',
      score: 20,
      description: 'Recursion provides value from graveyard'
    },
    
    // Combat synergies
    {
      commanderTags: ['voltron', 'equipment_matters'],
      cardTag: 'equipment',
      score: 22,
      description: 'Equipment is essential for voltron strategies'
    },
    {
      commanderTags: ['combat_matters', 'attack_trigger'],
      cardTag: 'extra_combat',
      score: 28,
      description: 'Extra combat steps multiply attack triggers'
    },
    
    // Tribal synergies (generic)
    {
      commanderTags: ['tribal'],
      cardTag: 'lord_effect',
      score: 20,
      description: 'Lords buff tribal creatures'
    },
    {
      commanderTags: ['tribal'],
      cardTag: 'changeling',
      score: 15,
      description: 'Changelings count as all creature types'
    }
  ];

  /**
   * Analyze a commander and create a profile based on its comprehensive mechanics
   */
  analyzeCommander(commander: ScryfallCard | LocalCardData, mechanics: CardMechanics): CommanderProfile {
    const tags: string[] = [];
    const strategies: string[] = [];
    
    // Extract ALL tags from comprehensive mechanics
    for (const tag of mechanics.mechanicTags) {
      tags.push(tag.name);
    }
    
    // Check for specific commander types and text patterns
    const typeLine = commander.type_line.toLowerCase();
    const text = (commander.oracle_text || '').toLowerCase();
    const name = commander.name.toLowerCase();
    
    // COMPREHENSIVE STRATEGY DETECTION
    
    // Counter strategies
    if (tags.some(tag => tag.includes('counter') || tag.includes('+1/+1')) || 
        text.includes('+1/+1 counter') || text.includes('proliferate')) {
      strategies.push('counter_matters');
    }
    
    // Token strategies  
    if (tags.some(tag => tag.includes('token')) || 
        text.includes('create') && text.includes('token')) {
      strategies.push('token_creation', 'token_matters');
    }
    
    // Landfall/land strategies
    if (tags.some(tag => tag.includes('landfall') || tag.includes('land')) ||
        text.includes('landfall') || text.includes('land enters') || text.includes('land you control')) {
      strategies.push('landfall', 'land_matters');
    }
    
    // Artifact strategies
    if (tags.some(tag => tag.includes('artifact')) ||
        text.includes('artifact') || typeLine.includes('artifact')) {
      strategies.push('artifact_matters', 'artifact_strategy');
    }
    
    // Graveyard strategies
    if (tags.some(tag => tag.includes('graveyard') || tag.includes('recursion') || tag.includes('reanimation')) ||
        text.includes('graveyard') || text.includes('return') && text.includes('graveyard')) {
      strategies.push('graveyard_matters');
      if (text.includes('return') && text.includes('battlefield')) {
        strategies.push('reanimator_strategy');
      }
    }
    
    // Tribal strategies
    if (tags.some(tag => tag.includes('tribal')) || typeLine.includes('tribal')) {
      strategies.push('tribal', 'creature_tribal');
      
      // Specific tribal types
      if (typeLine.includes('elf') || name.includes('elf') || text.includes('elf')) {
        tags.push('elf_tribal');
      }
      if (typeLine.includes('goblin') || name.includes('goblin') || text.includes('goblin')) {
        tags.push('goblin_tribal');
      }
      if (typeLine.includes('dragon') || name.includes('dragon') || text.includes('dragon')) {
        tags.push('dragon_tribal');
      }
      if (typeLine.includes('hydra') || name.includes('hydra') || text.includes('hydra')) {
        tags.push('hydra_tribal');
        strategies.push('counter_matters'); // Hydras typically use +1/+1 counters
      }
    }
    
    // Equipment/Voltron strategies
    if (tags.some(tag => tag.includes('equipment') || tag.includes('voltron')) ||
        text.includes('equipment') || text.includes('attach')) {
      strategies.push('equipment_matters', 'voltron');
    }
    
    // Spellslinger strategies
    if (tags.some(tag => tag.includes('spell') || tag.includes('instant') || tag.includes('sorcery')) ||
        text.includes('instant') || text.includes('sorcery') || text.includes('spell')) {
      strategies.push('spellslinger', 'instant_sorcery_matters');
    }
    
    // Combat strategies
    if (tags.some(tag => tag.includes('combat') || tag.includes('attack')) ||
        text.includes('attack') || text.includes('combat') || text.includes('whenever') && text.includes('deals damage')) {
      strategies.push('combat_matters');
      if (text.includes('attack trigger')) {
        strategies.push('attack_trigger');
      }
    }
    
    // Sacrifice strategies
    if (tags.some(tag => tag.includes('sacrifice') || tag.includes('aristocrats')) ||
        text.includes('sacrifice') || text.includes('dies')) {
      strategies.push('sacrifice_strategy', 'sacrifice_matters');
    }
    
    // ETB/Flicker strategies
    if (tags.some(tag => tag.includes('etb') || tag.includes('flicker') || tag.includes('exile')) ||
        text.includes('enters the battlefield') || text.includes('exile') && text.includes('return')) {
      strategies.push('etb_matters');
      if (text.includes('exile') && text.includes('return')) {
        strategies.push('flicker_strategy', 'exile_matters');
      }
    }
    
    // Draw/card advantage strategies
    if (tags.some(tag => tag.includes('draw') || tag.includes('card')) ||
        text.includes('draw') && text.includes('card')) {
      strategies.push('card_draw_matters', 'draw_strategy');
    }
    
    // Ramp/big mana strategies
    if (tags.some(tag => tag.includes('ramp') || tag.includes('mana')) ||
        text.includes('add') && text.includes('mana') || text.includes('search') && text.includes('land')) {
      strategies.push('ramp_strategy');
      if (text.includes('x') || name.includes('x')) {
        strategies.push('big_mana');
      }
    }
    
    // Control strategies
    if (tags.some(tag => tag.includes('control') || tag.includes('counter') && tag.includes('spell')) ||
        text.includes('counter target') || text.includes('destroy target')) {
      strategies.push('control_strategy');
    }
    
    // Planeswalker strategies
    if (tags.some(tag => tag.includes('planeswalker')) ||
        text.includes('planeswalker') || text.includes('loyalty')) {
      strategies.push('planeswalker_matters', 'superfriends');
    }
    
    // Lifegain strategies
    if (tags.some(tag => tag.includes('lifegain') || tag.includes('life')) ||
        text.includes('gain') && text.includes('life') || text.includes('lifegain')) {
      strategies.push('lifegain_matters', 'lifegain_strategy');
    }
    
    // Stax strategies
    if (tags.some(tag => tag.includes('stax') || tag.includes('tax')) ||
        text.includes('cost') && text.includes('more') || text.includes("can't") || text.includes('prevent')) {
      strategies.push('stax_strategy');
    }
    
    // Go-wide vs go-tall detection
    if (strategies.includes('token_creation') || text.includes('creatures you control get')) {
      strategies.push('go_wide_strategy');
    }
    if (strategies.includes('voltron') || strategies.includes('equipment_matters')) {
      strategies.push('go_tall_strategy');
    }
    
    // Special commander detections
    if (name.includes('gargos')) {
      tags.push('hydra_tribal', 'fight_mechanic');
      strategies.push('counter_matters', 'creature_tribal');
    }
    
    if (name.includes('norin')) {
      tags.push('etb_enabler', 'exile_matters');
      strategies.push('etb_matters', 'flicker_strategy');
    }
    
    if (name.includes('voja')) {
      tags.push('elf_matters', 'wolf_matters');
      strategies.push('tribal', 'creature_tribal', 'counter_matters');
    }
    
    if (name.includes('slimefoot')) {
      tags.push('saproling_tribal', 'fungus_tribal', 'token_creation');
      strategies.push('tribal', 'creature_tribal', 'token_strategy');
    }
    
    // Cost reduction detection
    if (text.includes('cost') && text.includes('less')) {
      tags.push('cost_reduction');
    }
    
    // Remove duplicates
    const uniqueTags = [...new Set(tags)];
    const uniqueStrategies = [...new Set(strategies)];
    
    return {
      name: commander.name,
      tags: uniqueTags,
      strategies: uniqueStrategies
    };
  }

  /**
   * Calculate synergy score between a commander and a card using tags
   * Enhanced to support normalized tag structure with synergy weights
   */
  calculateTagSynergy(
    commanderProfile: CommanderProfile,
    cardMechanics: CardMechanics
  ): number {
    let totalSynergy = 0;
    const appliedRules: string[] = [];
    
    // Check each synergy rule
    for (const rule of this.synergyRules) {
      // Check if commander has any required tags
      const commanderMatch = rule.commanderTags.some(tag => 
        commanderProfile.tags.includes(tag) || commanderProfile.strategies.includes(tag)
      );
      
      if (!commanderMatch) continue;
      
      // Check if card has the required tag
      const matchingTag = cardMechanics.mechanicTags.find(tag => tag.name === rule.cardTag);
      
      if (matchingTag) {
        // Apply synergy weight from normalized tag structure if available
        const synergyWeight = matchingTag.synergy_weight || 1.0;
        const weightedScore = rule.score * synergyWeight;
        
        totalSynergy += weightedScore;
        appliedRules.push(`${rule.description} (weight: ${synergyWeight.toFixed(1)}, score: ${weightedScore.toFixed(1)})`);
      }
    }
    
    // ENHANCED: Tribal bonuses for creature types AND artifact tribal
    // If commander has tribal_X tags, give bonuses to X types
    const tribalTypes = ['elf', 'dwarf', 'goblin', 'dragon', 'hydra', 'wolf', 'angel', 'demon', 'vampire', 'zombie', 'human', 'wizard', 'warrior', 'beast', 'elemental', 'artifact'];
    
    for (const tribalType of tribalTypes) {
      // Check if commander has tribal tag for this type
      const commanderHasTribalTag = commanderProfile.tags.includes(`tribal_${tribalType}`) || 
                                   commanderProfile.tags.includes(`${tribalType}_matters`);
      
      if (commanderHasTribalTag) {
        let cardMatchesType = false;
        
        // For creature types, check creature_type_X
        if (tribalType !== 'artifact') {
          cardMatchesType = cardMechanics.mechanicTags.some(tag => tag.name === `creature_type_${tribalType}`);
        } else {
          // For artifact tribal, check type_artifact or artifact tags
          cardMatchesType = cardMechanics.mechanicTags.some(tag => 
            tag.name === 'type_artifact' || tag.category === 'artifacts'
          );
        }
        
        if (cardMatchesType) {
          // DYNAMIC: Use tribe-specific bonuses based on tribe rarity
          // Enhanced with synergy weights from normalized structure
          console.log('🐛 DEBUG: main tribalType before calculateTribalBonus:', { tribalType, type: typeof tribalType });
          const { baseBonus, doubleBonus } = calculateTribalBonus(tribalType);
          
          // Find matching tribal tags to get synergy weights
          const tribalTags = cardMechanics.mechanicTags.filter(tag => 
            tag.name === `creature_type_${tribalType}` || 
            (tribalType === 'artifact' && (tag.name === 'type_artifact' || tag.category === 'artifacts'))
          );
          
          // Calculate weighted tribal bonus
          const avgSynergyWeight = tribalTags.length > 0 
            ? tribalTags.reduce((sum, tag) => sum + (tag.synergy_weight || 1.0), 0) / tribalTags.length
            : 1.0;
            
          const weightedBaseBonus = baseBonus * avgSynergyWeight;
          totalSynergy += weightedBaseBonus;
          appliedRules.push(`${tribalType.charAt(0).toUpperCase() + tribalType.slice(1)} type synergy with tribal commander (+${weightedBaseBonus.toFixed(1)}, weight: ${avgSynergyWeight.toFixed(1)})`);
          
          // ADDITIONAL: Extra bonus if commander has multiple tribal indicators
          const hasMultipleTribalTags = commanderProfile.tags.includes(`tribal_${tribalType}`) && 
                                       commanderProfile.tags.includes(`${tribalType}_matters`);
          if (hasMultipleTribalTags) {
            const weightedDoubleBonus = doubleBonus * avgSynergyWeight;
            totalSynergy += weightedDoubleBonus;
            appliedRules.push(`Double tribal synergy bonus (+${weightedDoubleBonus.toFixed(1)})`);
          }
        }
      }
    }
    
    // Add baseline synergy based on matching categories with synergy weights
    let baselineSynergy = 0;
    let tagMatches = 0;
    
    for (const cardTag of cardMechanics.mechanicTags) {
      const synergyWeight = cardTag.synergy_weight || 1.0;
      
      // Direct tag matches - weighted by synergy_weight
      if (commanderProfile.tags.includes(cardTag.name)) {
        const weightedScore = (cardTag.priority * 2) * synergyWeight;
        baselineSynergy += weightedScore;
        tagMatches++;
      }
      
      // Category matches - weighted by synergy_weight  
      if (commanderProfile.strategies.some(s => cardTag.category.includes(s))) {
        const weightedScore = cardTag.priority * synergyWeight;
        baselineSynergy += weightedScore;
        tagMatches++;
      }
    }
    
    totalSynergy += baselineSynergy;
    
    // REMOVED: Power level from synergy calculation
    // Power level and EDHREC rank should be tiebreakers, not primary factors
    
    // Log high synergy cards for debugging
    if (totalSynergy >= 50 || totalSynergy <= -50) {
      console.log(`🎯 HIGH SYNERGY: ${cardMechanics.cardName} = ${totalSynergy} points`);
      if (appliedRules.length > 0) {
        console.log(`   Rules: ${appliedRules.join(', ')}`);
      }
      if (tagMatches > 5) {
        console.log(`   Baseline synergy: ${baselineSynergy} (${tagMatches} tag matches)`);
      }
    }
    
    return totalSynergy;
  }

  /**
   * Add custom synergy rules for specific commanders
   */
  addCustomRule(rule: TagSynergyRule) {
    this.synergyRules.push(rule);
  }

  /**
   * Get all applicable synergy rules for a commander
   */
  getApplicableRules(commanderProfile: CommanderProfile): TagSynergyRule[] {
    return this.synergyRules.filter(rule =>
      rule.commanderTags.some(tag =>
        commanderProfile.tags.includes(tag) || commanderProfile.strategies.includes(tag)
      )
    );
  }

  /**
   * Get detailed synergy breakdown for debugging/analysis
   */
  getDetailedSynergyBreakdown(commanderProfile: CommanderProfile, cardMechanics: CardMechanics): {
    totalScore: number;
    appliedRules: Array<{ rule: TagSynergyRule; cardTag: string; score: number }>;
    tribalBonus: number;
    unmatchedCommanderTags: string[];
    unmatchedCardTags: string[];
  } {
    const appliedRules: Array<{ rule: TagSynergyRule; cardTag: string; score: number }> = [];
    let totalScore = 0;

    // Check each synergy rule
    for (const rule of this.synergyRules) {
      const commanderMatches = rule.commanderTags.some(tag =>
        commanderProfile.tags.includes(tag) || commanderProfile.strategies.includes(tag)
      );

      if (commanderMatches) {
        const matchingCardTag = cardMechanics.mechanicTags.find(tag => tag.name === rule.cardTag);
        if (matchingCardTag) {
          // Apply synergy weight from normalized tag structure
          const synergyWeight = matchingCardTag.synergy_weight || 1.0;
          const weightedScore = rule.score * synergyWeight;
          
          appliedRules.push({
            rule,
            cardTag: matchingCardTag.name,
            score: weightedScore
          });
          totalScore += weightedScore;
        }
      }
    }

    // Calculate tribal bonus (same logic as main synergy calculation)
    let tribalBonus = 0;
    const tribalTypes = ['elf', 'dwarf', 'goblin', 'dragon', 'hydra', 'wolf', 'angel', 'demon', 'vampire', 'zombie', 'human', 'wizard', 'warrior', 'beast', 'elemental', 'artifact'];
    
    for (const tribalType of tribalTypes) {
      // Ensure tribalType is a string
      if (typeof tribalType !== 'string') {
        console.error('🐛 ERROR: tribalType is not a string:', tribalType);
        continue;
      }
      
      const commanderHasTribalTag = commanderProfile.tags.includes(`tribal_${tribalType}`) || 
                                   commanderProfile.tags.includes(`${tribalType}_matters`);
      
      if (commanderHasTribalTag) {
        let cardMatchesType = false;
        
        if (tribalType !== 'artifact') {
          cardMatchesType = cardMechanics.mechanicTags.some(tag => tag.name === `creature_type_${tribalType}`);
        } else {
          cardMatchesType = cardMechanics.mechanicTags.some(tag => 
            tag.name === 'type_artifact' || tag.category === 'artifacts'
          );
        }
        
        if (cardMatchesType) {
          try {
            const { baseBonus, doubleBonus } = calculateTribalBonus(tribalType);
            
            // Find matching tribal tags to get synergy weights
            const tribalTags = cardMechanics.mechanicTags.filter(tag => 
              tag.name === `creature_type_${tribalType}` || 
              (tribalType === 'artifact' && (tag.name === 'type_artifact' || tag.category === 'artifacts'))
            );
            
            // Calculate weighted tribal bonus
            const avgSynergyWeight = tribalTags.length > 0 
              ? tribalTags.reduce((sum, tag) => sum + (tag.synergy_weight || 1.0), 0) / tribalTags.length
              : 1.0;
              
            tribalBonus += baseBonus * avgSynergyWeight;
            
            const hasMultipleTribalTags = commanderProfile.tags.includes(`tribal_${tribalType}`) && 
                                         commanderProfile.tags.includes(`${tribalType}_matters`);
            if (hasMultipleTribalTags) {
              tribalBonus += doubleBonus * avgSynergyWeight;
            }
          } catch (error) {
            console.error('🐛 ERROR in calculateTribalBonus:', { tribalType, error });
          }
        }
      }
    }
    
    totalScore += tribalBonus;

    // Find unmatched tags for analysis
    const cardTagNames = cardMechanics.mechanicTags.map(tag => tag.name);
    const appliedCardTags = appliedRules.map(applied => applied.cardTag);
    const unmatchedCardTags = cardTagNames.filter(tag => !appliedCardTags.includes(tag));

    const allAppliedCommanderTags = appliedRules.flatMap(applied => applied.rule.commanderTags);
    const unmatchedCommanderTags = commanderProfile.tags.filter(tag => !allAppliedCommanderTags.includes(tag));

    return {
      totalScore,
      appliedRules,
      tribalBonus,
      unmatchedCommanderTags,
      unmatchedCardTags
    };
  }
}

export const tagSynergyScorer = new TagBasedSynergyScorer();