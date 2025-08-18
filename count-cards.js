const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/cards.json', 'utf8'));
const cards = Object.values(data);

// Count total red cards
const redCards = cards.filter(c => 
  c.color_identity.includes('R') && 
  c.legalities && c.legalities.commander === 'legal'
);

console.log('Total red cards legal in commander:', redCards.length);

// Count non-land red cards
const redNonLands = redCards.filter(c => 
  c.type_line && !c.type_line.toLowerCase().includes('land')
);

console.log('Red non-land cards:', redNonLands.length);

// Count cards for Norin (R or colorless, non-land)
const norinCards = cards.filter(c => 
  c.color_identity.length <= 1 && 
  (c.color_identity.length === 0 || c.color_identity[0] === 'R') &&
  c.legalities && c.legalities.commander === 'legal' &&
  c.type_line && !c.type_line.toLowerCase().includes('land')
);

console.log('Cards legal for Norin (R or colorless, non-land):', norinCards.length);

// Count pure red cards only
const pureRedCards = cards.filter(c => 
  c.color_identity.length === 1 && 
  c.color_identity[0] === 'R' &&
  c.legalities && c.legalities.commander === 'legal' &&
  c.type_line && !c.type_line.toLowerCase().includes('land')
);

console.log('Pure red non-land cards:', pureRedCards.length);

// Count colorless cards
const colorlessCards = cards.filter(c => 
  c.color_identity.length === 0 &&
  c.legalities && c.legalities.commander === 'legal' &&
  c.type_line && !c.type_line.toLowerCase().includes('land')
);

console.log('Colorless non-land cards:', colorlessCards.length);