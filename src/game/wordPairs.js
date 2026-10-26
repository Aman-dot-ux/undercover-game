/**
 * Curated local dataset of 150+ high-quality Undercover word pairs.
 * Designed to be closely related yet subtly distinct for engaging clues and deduction.
 */

export const WORD_PAIRS = [
  // ==================== FOOD & DRINKS (35 pairs) ====================
  { civilian: "Mango", undercover: "Papaya", category: "Food" },
  { civilian: "Cappuccino", undercover: "Latte", category: "Food" },
  { civilian: "Pizza", undercover: "Calzone", category: "Food" },
  { civilian: "Sushi", undercover: "Sashimi", category: "Food" },
  { civilian: "Pancake", undercover: "Waffle", category: "Food" },
  { civilian: "Croissant", undercover: "Brioche", category: "Food" },
  { civilian: "Butter", undercover: "Margarine", category: "Food" },
  { civilian: "Lemonade", undercover: "Limeade", category: "Food" },
  { civilian: "Taco", undercover: "Burrito", category: "Food" },
  { civilian: "Orange", undercover: "Tangerine", category: "Food" },
  { civilian: "Ketchup", undercover: "Tomato Sauce", category: "Food" },
  { civilian: "Hot Dog", undercover: "Sausage", category: "Food" },
  { civilian: "Donut", undercover: "Bagel", category: "Food" },
  { civilian: "Espresso", undercover: "Americano", category: "Food" },
  { civilian: "Cupcake", undercover: "Muffin", category: "Food" },
  { civilian: "Ice Cream", undercover: "Gelato", category: "Food" },
  { civilian: "Popcorn", undercover: "Nachos", category: "Food" },
  { civilian: "Chocolate", undercover: "Fudge", category: "Food" },
  { civilian: "Peach", undercover: "Nectarine", category: "Food" },
  { civilian: "Broccoli", undercover: "Cauliflower", category: "Food" },
  { civilian: "Spaghetti", undercover: "Fettuccine", category: "Food" },
  { civilian: "Ramen", undercover: "Udon", category: "Food" },
  { civilian: "Cookie", undercover: "Biscuit", category: "Food" },
  { civilian: "Milkshake", undercover: "Smoothie", category: "Food" },
  { civilian: "Cheddar", undercover: "Parmesan", category: "Food" },
  { civilian: "French Fries", undercover: "Potato Wedges", category: "Food" },
  { civilian: "Jam", undercover: "Marmalade", category: "Food" },
  { civilian: "Onion", undercover: "Shallot", category: "Food" },
  { civilian: "Watermelon", undercover: "Cantaloupe", category: "Food" },
  { civilian: "Peanut Butter", undercover: "Nutella", category: "Food" },
  { civilian: "Green Tea", undercover: "Black Tea", category: "Food" },
  { civilian: "Brownie", undercover: "Chocolate Cake", category: "Food" },
  { civilian: "Samosa", undercover: "Spring Roll", category: "Food" },
  { civilian: "Hummus", undercover: "Guacamole", category: "Food" },
  { civilian: "Apple", undercover: "Pear", category: "Food" },

  // ==================== ANIMALS & NATURE (30 pairs) ====================
  { civilian: "Cheetah", undercover: "Leopard", category: "Animals" },
  { civilian: "Dolphin", undercover: "Porpoise", category: "Animals" },
  { civilian: "Crow", undercover: "Raven", category: "Animals" },
  { civilian: "Alligator", undercover: "Crocodile", category: "Animals" },
  { civilian: "Frog", undercover: "Toad", category: "Animals" },
  { civilian: "Butterfly", undercover: "Moth", category: "Animals" },
  { civilian: "Horse", undercover: "Donkey", category: "Animals" },
  { civilian: "Rabbit", undercover: "Hare", category: "Animals" },
  { civilian: "Llama", undercover: "Alpaca", category: "Animals" },
  { civilian: "Turtle", undercover: "Tortoise", category: "Animals" },
  { civilian: "Seal", undercover: "Sea Lion", category: "Animals" },
  { civilian: "Bee", undercover: "Wasp", category: "Animals" },
  { civilian: "Eagle", undercover: "Falcon", category: "Animals" },
  { civilian: "Wolf", undercover: "Coyote", category: "Animals" },
  { civilian: "Hamster", undercover: "Guinea Pig", category: "Animals" },
  { civilian: "Octopus", undercover: "Squid", category: "Animals" },
  { civilian: "Goat", undercover: "Sheep", category: "Animals" },
  { civilian: "Grizzly Bear", undercover: "Black Bear", category: "Animals" },
  { civilian: "Penguin", undercover: "Puffin", category: "Animals" },
  { civilian: "Camel", undercover: "Dromedary", category: "Animals" },
  { civilian: "Monkey", undercover: "Chimpanzee", category: "Animals" },
  { civilian: "Stork", undercover: "Heron", category: "Animals" },
  { civilian: "Lobster", undercover: "Crab", category: "Animals" },
  { civilian: "Gorilla", undercover: "Orangutan", category: "Animals" },
  { civilian: "Swan", undercover: "Goose", category: "Animals" },
  { civilian: "Whale", undercover: "Orca", category: "Animals" },
  { civilian: "Zebra", undercover: "Donkey", category: "Animals" },
  { civilian: "Fox", undercover: "Jackal", category: "Animals" },
  { civilian: "Panther", undercover: "Jaguar", category: "Animals" },
  { civilian: "Pigeon", undercover: "Dove", category: "Animals" },

  // ==================== OBJECTS & TOOLS (30 pairs) ====================
  { civilian: "Backpack", undercover: "Duffel Bag", category: "Objects" },
  { civilian: "Guitar", undercover: "Ukulele", category: "Objects" },
  { civilian: "Lantern", undercover: "Candle", category: "Objects" },
  { civilian: "Pencil", undercover: "Pen", category: "Objects" },
  { civilian: "Pillow", undercover: "Cushion", category: "Objects" },
  { civilian: "Curtain", undercover: "Blinds", category: "Objects" },
  { civilian: "Helmet", undercover: "Cap", category: "Objects" },
  { civilian: "Mirror", undercover: "Glass", category: "Objects" },
  { civilian: "Sofa", undercover: "Armchair", category: "Objects" },
  { civilian: "Blanket", undercover: "Quilt", category: "Objects" },
  { civilian: "Scarf", undercover: "Shawl", category: "Objects" },
  { civilian: "Boot", undercover: "Shoe", category: "Objects" },
  { civilian: "Spoon", undercover: "Fork", category: "Objects" },
  { civilian: "Watch", undercover: "Clock", category: "Objects" },
  { civilian: "Cup", undercover: "Mug", category: "Objects" },
  { civilian: "Umbrella", undercover: "Raincoat", category: "Objects" },
  { civilian: "Laptop", undercover: "Tablet", category: "Objects" },
  { civilian: "Earphones", undercover: "Headphones", category: "Objects" },
  { civilian: "Keyboard", undercover: "Typewriter", category: "Objects" },
  { civilian: "Suitcase", undercover: "Briefcase", category: "Objects" },
  { civilian: "Candle", undercover: "Flashlight", category: "Objects" },
  { civilian: "Ladder", undercover: "Stairs", category: "Objects" },
  { civilian: "Bucket", undercover: "Tub", category: "Objects" },
  { civilian: "Envelope", undercover: "Postcard", category: "Objects" },
  { civilian: "Toothbrush", undercover: "Hairbrush", category: "Objects" },
  { civilian: "Vase", undercover: "Pot", category: "Objects" },
  { civilian: "Ruler", undercover: "Tape Measure", category: "Objects" },
  { civilian: "Scissors", undercover: "Knife", category: "Objects" },
  { civilian: "Diary", undercover: "Notebook", category: "Objects" },
  { civilian: "Wallet", undercover: "Purse", category: "Objects" },

  // ==================== PLACES & GEOGRAPHY (25 pairs) ====================
  { civilian: "Island", undercover: "Peninsula", category: "Places" },
  { civilian: "Castle", undercover: "Palace", category: "Places" },
  { civilian: "Desert", undercover: "Tundra", category: "Places" },
  { civilian: "Library", undercover: "Bookstore", category: "Places" },
  { civilian: "Ocean", undercover: "Sea", category: "Places" },
  { civilian: "River", undercover: "Stream", category: "Places" },
  { civilian: "Mountain", undercover: "Hill", category: "Places" },
  { civilian: "Hotel", undercover: "Motel", category: "Places" },
  { civilian: "Village", undercover: "Town", category: "Places" },
  { civilian: "Lagoon", undercover: "Bay", category: "Places" },
  { civilian: "Forest", undercover: "Jungle", category: "Places" },
  { civilian: "Cave", undercover: "Tunnel", category: "Places" },
  { civilian: "Zoo", undercover: "Safari Park", category: "Places" },
  { civilian: "Museum", undercover: "Art Gallery", category: "Places" },
  { civilian: "Cinema", undercover: "Theater", category: "Places" },
  { civilian: "Beach", undercover: "Lake Coast", category: "Places" },
  { civilian: "Airport", undercover: "Train Station", category: "Places" },
  { civilian: "Cafe", undercover: "Bakery", category: "Places" },
  { civilian: "Amusement Park", undercover: "Water Park", category: "Places" },
  { civilian: "Supermarket", undercover: "Grocery Store", category: "Places" },
  { civilian: "Gym", undercover: "Stadium", category: "Places" },
  { civilian: "Harbor", undercover: "Marina", category: "Places" },
  { civilian: "Valley", undercover: "Canyon", category: "Places" },
  { civilian: "Boutique", undercover: "Department Store", category: "Places" },
  { civilian: "Bridge", undercover: "Pier", category: "Places" },

  // ==================== SPORTS & ACTIVITIES (20 pairs) ====================
  { civilian: "Tennis", undercover: "Badminton", category: "Sports" },
  { civilian: "Snowboarding", undercover: "Skiing", category: "Sports" },
  { civilian: "Surfing", undercover: "Skateboarding", category: "Sports" },
  { civilian: "Baseball", undercover: "Cricket", category: "Sports" },
  { civilian: "Rugby", undercover: "American Football", category: "Sports" },
  { civilian: "Boxing", undercover: "Kickboxing", category: "Sports" },
  { civilian: "Cycling", undercover: "Spinning", category: "Sports" },
  { civilian: "Kayaking", undercover: "Canoeing", category: "Sports" },
  { civilian: "Jogging", undercover: "Sprinting", category: "Sports" },
  { civilian: "Swimming", undercover: "Diving", category: "Sports" },
  { civilian: "Snooker", undercover: "Pool", category: "Sports" },
  { civilian: "Archery", undercover: "Shooting", category: "Sports" },
  { civilian: "Hiking", undercover: "Trekking", category: "Sports" },
  { civilian: "Bowling", undercover: "Bocce", category: "Sports" },
  { civilian: "Golf", undercover: "Mini Golf", category: "Sports" },
  { civilian: "Ice Skating", undercover: "Roller Skating", category: "Sports" },
  { civilian: "Rock Climbing", undercover: "Bouldering", category: "Sports" },
  { civilian: "Karate", undercover: "Taekwondo", category: "Sports" },
  { civilian: "Pilates", undercover: "Yoga", category: "Sports" },
  { civilian: "Volleyball", undercover: "Beach Volleyball", category: "Sports" },

  // ==================== MOVIES & ENTERTAINMENT (20 pairs) ====================
  { civilian: "Director", undercover: "Producer", category: "Movies" },
  { civilian: "Actor", undercover: "Stunt Double", category: "Movies" },
  { civilian: "Marvel", undercover: "DC Comics", category: "Movies" },
  { civilian: "Anime", undercover: "Cartoon", category: "Movies" },
  { civilian: "Sequel", undercover: "Prequel", category: "Movies" },
  { civilian: "Hero", undercover: "Vigilante", category: "Movies" },
  { civilian: "Comedy", undercover: "Parody", category: "Movies" },
  { civilian: "Horror", undercover: "Thriller", category: "Movies" },
  { civilian: "Docuseries", undercover: "Biopic", category: "Movies" },
  { civilian: "Soundtrack", undercover: "Score", category: "Movies" },
  { civilian: "Cinema", undercover: "Drive-In", category: "Movies" },
  { civilian: "Vampire", undercover: "Werewolf", category: "Movies" },
  { civilian: "Alien", undercover: "Monster", category: "Movies" },
  { civilian: "Spy", undercover: "Detective", category: "Movies" },
  { civilian: "Trailer", undercover: "Teaser", category: "Movies" },
  { civilian: "Script", undercover: "Storyline", category: "Movies" },
  { civilian: "Oscar", undercover: "Golden Globe", category: "Movies" },
  { civilian: "Premiere", undercover: "Festival", category: "Movies" },
  { civilian: "Broadway", undercover: "Musical", category: "Movies" },
  { civilian: "Sci-Fi", undercover: "Fantasy", category: "Movies" }
];

export const CATEGORIES = ["Random", "Food", "Animals", "Objects", "Places", "Sports", "Movies", "Mixed"];

/**
 * Get a random word pair, optionally filtered by category.
 * If the category is Random or Mixed, picks from all pairs.
 */
export function getRandomWordPair(category = "Random", usedPairs = new Set()) {
  let pool = WORD_PAIRS;

  if (category && category !== "Random" && category !== "Mixed") {
    const filtered = WORD_PAIRS.filter(p => p.category.toLowerCase() === category.toLowerCase());
    if (filtered.length > 0) {
      pool = filtered;
    }
  }

  // Filter out recently used pairs if pool has enough options
  const unused = pool.filter(p => !usedPairs.has(`${p.civilian}:${p.undercover}`));
  const targetPool = unused.length > 0 ? unused : pool;

  const selected = targetPool[Math.floor(Math.random() * targetPool.length)];

  // Randomly swap civilian and undercover roles so either word can be civilian
  const shouldSwap = Math.random() < 0.5;
  return {
    civilian: shouldSwap ? selected.undercover : selected.civilian,
    undercover: shouldSwap ? selected.civilian : selected.undercover,
    category: selected.category,
    pairId: `${selected.civilian}:${selected.undercover}`
  };
}
