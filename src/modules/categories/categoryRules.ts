export const CATEGORY_RULES = [
  {
    match: ['UBER', 'UBER RIDES'],
    category: 'Transport',
    subcategory: 'Taxi',
    essential: true
  },
  {
    match: ['RAPPI'],
    category: 'Food',
    subcategory: 'Delivery',
    essential: false
  },
  {
    match: ['NETFLIX', 'SPOTIFY', 'PRIME'],
    category: 'Subscriptions',
    subcategory: 'Streaming',
    essential: false
  },
  {
    match: ['WONG', 'PLAZA VEA'],
    category: 'Food',
    subcategory: 'Groceries',
    essential: true
  }
]
