(function () {
  'use strict';

  // Pricing engine for the private menu builder.
  // Update COMMODITY_COSTS with local pricing (Northwest Ohio) and adjust yields below.
  // Costs should reflect raw food cost (COGS). Sell prices are derived using PRICING_CONSTANTS.

  const PRICING_CONSTANTS = {
    DEFAULT_FOOD_WASTE_PCT: 0.1,
    DEFAULT_LABOR_OVERHEAD_MULTIPLIER: 2.4,
    DEFAULT_SALES_TAX_PCT: 0.07,
    DEFAULT_GRATUITY_PCT: 0.18,
    DEFAULT_TAX_PCT: 0,
    DEFAULT_ROUNDING: {
      perPerson: 1,
      fixed: 5
    }
  };

  const COMMODITY_COSTS = {
    // Toledo-area proxies (update as needed):
    chicken_thighs_lb: 3.12, // Walmart proxy
    pork_butt_lb: 2.09, // GFS proxy
    ground_beef_80_20_lb: 4.75, // Walmart proxy
    russet_potatoes_lb: 0.65, // Walmart proxy
    mozzarella_lb: 3.46, // Walmart proxy
    cheddar_lb: 3.75, // Walmart proxy
    eggs_dozen: 2.96, // Walmart proxy
    all_purpose_flour_lb: 0.48, // Walmart proxy
    pasta_lb: 1.25, // Walmart proxy
    marinara_per_serving: 0.55, // Walmart proxy
    sandwich_buns_each: 0.18, // Walmart proxy
    broccoli_lb: 1.97, // Walmart proxy
    green_beans_lb: 1.80, // Walmart proxy
    carrots_lb: 0.91, // Walmart proxy
    brussels_sprouts_lb: 2.50, // Walmart proxy
    brisket_lb: 6.50, // GFS proxy
    pork_chops_lb: 3.50, // Walmart proxy
    sausage_lb: 3.25, // Walmart proxy
    spring_mix_lb: 3.6, // Walmart proxy
    dressing_per_serving: 0.35, // Walmart proxy
    butter_lb: 3.5, // Walmart proxy
    hotdog_each: 0.6, // Walmart proxy
    brat_each: 0.95 // Walmart proxy
  };

  const roundTo = (value, increment) => {
    if (!increment) return value;
    return Math.round(value / increment) * increment;
  };

  const sellFromCogs = (cogs, type) => {
    const withWaste = cogs * (1 + PRICING_CONSTANTS.DEFAULT_FOOD_WASTE_PCT);
    const sell = withWaste * PRICING_CONSTANTS.DEFAULT_LABOR_OVERHEAD_MULTIPLIER;
    const rounding = type === 'fixed'
      ? PRICING_CONSTANTS.DEFAULT_ROUNDING.fixed
      : PRICING_CONSTANTS.DEFAULT_ROUNDING.perPerson;
    return roundTo(sell, rounding);
  };

  const costFromPortion = (lbs, costPerLb, extra = 0) => (lbs * costPerLb) + extra;

  const costPerPersonFromBatch = (batchCost, servings) => {
    if (!servings || !Number.isFinite(batchCost)) return 0;
    return batchCost / servings;
  };

  // Assumptions (per person unless noted):
  // - Chicken: ~0.45 lb raw thighs + $0.45 seasoning/sauce.
  // - Pulled pork: ~0.45 lb raw portion + sauce.
  // - Cheesy potatoes: 0.35 lb potatoes + 1.5 oz cheese + dairy/butter.
  // - Boards/stations: fixed bundles (see servings_per_batch).
  const RAW_MENUS = [
    {
      id: 'brunch',
      label: 'Brunch',
      sections: [
        {
          title: 'Boards & Stations',
          items: [
            { name: 'Superboard', pricing_type: 'fixed', fixed_price: 125, cogs_per_batch: 95, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Fruit/Veggie Superboard', pricing_type: 'fixed', fixed_price: 125, cogs_per_batch: 95, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Breakfast Sandwich Bar', pricing_type: 'fixed', fixed_price: 300, cogs_per_batch: 100, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Pancake Bar', pricing_type: 'fixed', fixed_price: 110, cogs_per_batch: 80, servings_per_batch: 18, allow_quantity: true, max_qty: 4 }
          ]
        },
        {
          title: 'Hot Favorites & Baked Items',
          items: [
            { name: 'Cheesy Potatoes', pricing_type: 'per_person', per_person_price: 3, category: 'side', cogs_per_person: 0.81, serving: '½ cup' },
            { name: 'Sausage, Biscuits & Gravy', pricing_type: 'per_person', per_person_price: 3, category: 'entree', cogs_per_person: 0.79, serving: '1 biscuit + ½ cup gravy' },
            { name: 'French Toast Casserole', pricing_type: 'per_person', per_person_price: 6, category: 'breakfast', cogs_per_person: 1.58, serving: '1 square (1/12 pan) + syrup' },
            { name: 'Muffin Tin Omelets', pricing_type: 'per_person', per_person_price: 4.5, category: 'breakfast', cogs_per_person: 1.16, serving: '2 mini omelets' },
            { name: 'Muffins & Breakfast Breads', pricing_type: 'per_person', per_person_price: 2.5, category: 'breakfast', cogs_per_person: 0.3, serving: '1 muffin or slice' }
          ]
        }
      ]
    },
    {
      id: 'lunch_dinner',
      label: 'Lunch & Dinner',
      sections: [
        {
          title: 'Appetizers & Salads',
          items: [
            { name: 'Soup', pricing_type: 'fixed', fixed_price: 75, allow_quantity: true, max_qty: 4, category: 'app', cogs_per_person: 1.5 },
            { name: 'Antipasto', pricing_type: 'per_person', per_person_price: 6, category: 'app', cogs_per_person: 3.1 },
            { name: 'Seasonal Salad', pricing_type: 'per_person', per_person_price: 4.25, category: 'salad', cogs_per_person: 1.14, serving: '1½ cups' },
            { name: 'Superboard', pricing_type: 'fixed', fixed_price: 125, cogs_per_batch: 110, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Stuffed Mushrooms', pricing_type: 'per_person', per_person_price: 3.25, category: 'app', cogs_per_person: 0.83, serving: '2 mushrooms' },
            { name: 'Bruschetta', pricing_type: 'per_person', per_person_price: 3.5, category: 'app', cogs_per_person: 0.95, serving: '2 pieces' },
            { name: 'Pasta Salad', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.65, serving: '½ cup' },
            { name: 'Cole Slaw', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.45, serving: '½ cup' },
            { name: 'Fruit & Veggie Board', pricing_type: 'fixed', fixed_price: 95, cogs_per_batch: 70, servings_per_batch: 16 }
          ]
        },
        {
          title: 'Main Courses',
          items: [
            { name: 'Baked Potato Bar', pricing_type: 'per_person', per_person_price: 4.75, category: 'entree', cogs_per_person: 1.26, serving: '1 potato + toppings' },
            { name: 'Macaroni & Cheese', pricing_type: 'per_person', per_person_price: 3.5, category: 'entree', cogs_per_person: 0.80, serving: '1 cup' },
            { name: 'Chicken', pricing_type: 'per_person', per_person_price: 5.75, category: 'entree', cogs_per_person: 1.55, serving: '5 oz cooked' },
            { name: 'Pulled Pork', pricing_type: 'per_person', per_person_price: 7.5, category: 'entree', cogs_per_person: 2.04, serving: '4 oz meat + bun + sauce' },
            { name: 'Shredded Chicken', pricing_type: 'per_person', per_person_price: 4.25, category: 'entree', cogs_per_person: 1.15, serving: '4½ oz meat + bun' },
            { name: 'Meatballs', pricing_type: 'per_person', per_person_price: 5.75, category: 'entree', cogs_per_person: 1.55, serving: '4 meatballs + sauce' },
            { name: 'Lasagna', pricing_type: 'per_person', per_person_price: 6.25, category: 'entree', cogs_per_person: 1.70, serving: '1 square (1/12 pan)' },
            { name: 'Spaghetti & Meatballs', pricing_type: 'per_person', per_person_price: 7.25, category: 'entree', cogs_per_person: 1.92, serving: '1 cup pasta + 3 meatballs' },
            { name: 'Sloppy Joes', pricing_type: 'per_person', per_person_price: 5, category: 'entree', cogs_per_person: 1.34, serving: '1 sandwich' },
            { name: 'Flatbreads', pricing_type: 'per_person', per_person_price: 10, category: 'entree', cogs_per_person: 2.2 }
          ]
        },
        {
          title: 'Sides',
          items: [
            { name: 'Mashed Potatoes', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.20, serving: '½ cup' },
            { name: 'Cheesy Potatoes', pricing_type: 'per_person', per_person_price: 3, category: 'side', cogs_per_person: 0.81, serving: '½ cup' },
            { name: 'Brussels Sprouts', pricing_type: 'per_person', per_person_price: 3, category: 'side', cogs_per_person: 0.76, serving: '3 oz roasted' },
            { name: 'Broccoli', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.42, serving: '3½ oz' },
            { name: 'Green Beans', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.50, serving: '3½ oz' },
            { name: 'Carrots', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.32, serving: '3½ oz' },
            { name: 'Seasonal Vegetables', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.62, serving: '3½ oz' },
            { name: 'Baked Beans', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.51, serving: '½ cup' },
            { name: 'Potato Salad', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.41, serving: '½ cup' },
            { name: 'Noodles', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.54, serving: '½ cup' }
          ]
        }
      ]
    },
    {
      id: 'picnic',
      label: 'Picnic-Style',
      sections: [
        {
          title: 'Proteins',
          items: [
            { name: 'Hot Dogs', pricing_type: 'per_person', per_person_price: 3.5, category: 'entree', cogs_per_person: 0.79, serving: '1 hot dog + bun' },
            { name: 'Brats', pricing_type: 'per_person', per_person_price: 5.5, category: 'entree', cogs_per_person: 1.45, serving: '1 brat + bun' },
            { name: 'Burgers', pricing_type: 'per_person', per_person_price: 9.75, category: 'entree', cogs_per_person: 2.64, serving: '⅓ lb burger + bun' },
            { name: 'Chicken', pricing_type: 'per_person', per_person_price: 5.75, category: 'entree', cogs_per_person: 1.55, serving: '5 oz cooked' },
            { name: 'Brisket', pricing_type: 'per_person', per_person_price: 24, category: 'entree', cogs_per_person: 6.52, serving: '5 oz sliced' },
            { name: 'Pork Chops', pricing_type: 'per_person', per_person_price: 7, category: 'entree', cogs_per_person: 1.85, serving: '1 bone-in chop (8 oz)' },
            { name: 'Steaks', pricing_type: 'per_person', per_person_price: 28, category: 'entree', cogs_per_person: 7.63, serving: '8 oz sirloin' }
          ]
        },
        {
          title: 'Sides',
          items: [
            { name: 'Baked Beans', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.51, serving: '½ cup' },
            { name: 'Potato Salad', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.41, serving: '½ cup' },
            { name: 'Cole Slaw', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.45, serving: '½ cup' },
            { name: 'Pasta Salad', pricing_type: 'per_person', per_person_price: 2.5, category: 'side', cogs_per_person: 0.65, serving: '½ cup' },
            { name: 'Seasonal Salad', pricing_type: 'per_person', per_person_price: 4.25, category: 'salad', cogs_per_person: 1.14, serving: '1½ cups' }
          ]
        }
      ]
    }
  ];

  const PER_PERSON_FLOORS = {
    side: 3,
    salad: 4,
    app: 4,
    entree: 8,
    breakfast: 3
  };

  const MIN_FIXED_PRICE = 140;

  const applyPricing = (menus) => {
    return (menus || []).map((menu) => ({
      ...menu,
      sections: (menu.sections || []).map((section) => ({
        ...section,
        items: (section.items || []).map((item) => {
          const next = { ...item };
          const pricingType = next.pricing_type || next.pricingType || (Number.isFinite(Number(next.fixed_price)) ? 'fixed' : 'per_person');
          const ingredientCost = Number.isFinite(Number(next.cogs_per_person))
            ? Number(next.cogs_per_person)
            : (Number.isFinite(Number(next.ingredient_cost_per_serving)) ? Number(next.ingredient_cost_per_serving) : null);
          const batchCost = Number.isFinite(Number(next.cogs_per_batch)) ? Number(next.cogs_per_batch) : null;
          const servings = Number.isFinite(Number(next.servings_per_batch)) ? Number(next.servings_per_batch) : null;
          if (pricingType === 'per_person') {
            if (!Number.isFinite(Number(next.per_person_price)) && Number.isFinite(ingredientCost)) {
              const rawSell = sellFromCogs(ingredientCost, 'per_person');
              const floor = PER_PERSON_FLOORS[next.category] || 0;
              next.per_person_price = Math.max(rawSell, floor);
            }
            if (!Number.isFinite(Number(next.cogs_per_person)) && Number.isFinite(ingredientCost)) {
              next.cogs_per_person = ingredientCost;
            }
          } else {
            if (!Number.isFinite(Number(next.fixed_price))) {
              const derived = Number.isFinite(batchCost)
                ? batchCost
                : (Number.isFinite(ingredientCost) && Number.isFinite(servings)
                  ? ingredientCost * servings
                  : null);
              if (Number.isFinite(derived)) {
                next.fixed_price = Math.max(sellFromCogs(derived, 'fixed'), MIN_FIXED_PRICE);
              }
            }
            if (!Number.isFinite(Number(next.cogs_per_batch)) && Number.isFinite(batchCost)) {
              next.cogs_per_batch = batchCost;
            }
            if (!Number.isFinite(Number(next.servings_per_batch)) && Number.isFinite(servings)) {
              next.servings_per_batch = servings;
            }
          }
          next.pricing_type = pricingType;
          return next;
        })
      }))
    }));
  };

  const MENUS = applyPricing(RAW_MENUS);
  const BEVERAGE_ADDONS = [];

  // Central event-planning prices. Food-item prices remain with MENUS above.
  const EVENT_PRICING = Object.freeze({
    venue: Object.freeze({ rental: 250, deposit: 100 }),
    taxRate: 0.07,
    serviceChargeRate: 0.18,
    beverages: Object.freeze({
      sangria: Object.freeze({ label: 'Sangria growler', price: 18, guide: 'Approximately 10 servings' }),
      mimosas: Object.freeze({ label: 'Mimosa / sparkling-wine bottle', price: 18, guide: 'Approximately 5 glasses' }),
      lemonade: Object.freeze({ label: 'Lemonade pitcher', price: 15, guide: 'Approximately 5 servings' }),
      icedTea: Object.freeze({ label: 'Iced tea pitcher', price: 15, guide: 'Approximately 5 servings' }),
      coffee: Object.freeze({ label: 'Coffee service', price: 15, guide: '' })
    }),
    enhancements: Object.freeze({
      photoBooth: Object.freeze({ label: 'Digital Photo Booth', price: 200 }),
      uplighting: Object.freeze({ label: 'Uplighting', price: 100 }),
      partyAudio: Object.freeze({ label: 'Indoor & Outdoor Party Audio', price: 75 }),
      liveMusicHourly: Object.freeze({ label: 'Live Music by A Change of Plans', price: 100 }),
      wineCanvas: Object.freeze({
        mini: Object.freeze({ label: 'Mini Painting Experience', price: 20 }),
        standard: Object.freeze({ label: 'Standard Painting Experience', price: 30 }),
        full: Object.freeze({ label: 'Full Painting Experience', price: 40 }),
        minimumPainters: 8
      })
    })
  });

  const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

  const computeEventEstimate = ({
    foodSubtotal = 0,
    hostedBeverageSubtotal = 0,
    enhancementItems = []
  } = {}) => {
    const food = Math.max(0, Number(foodSubtotal) || 0);
    const beverages = Math.max(0, Number(hostedBeverageSubtotal) || 0);
    const foodAndBeverageSubtotal = roundMoney(food + beverages);
    // Existing site assumption: tax applies to food and beverages only.
    const taxAmount = roundMoney(foodAndBeverageSubtotal * EVENT_PRICING.taxRate);
    const serviceChargeAmount = roundMoney(foodAndBeverageSubtotal * EVENT_PRICING.serviceChargeRate);
    const enhancementsSubtotal = roundMoney((enhancementItems || []).reduce((sum, item) => (
      sum + Math.max(0, Number(item?.amount) || 0)
    ), 0));
    const estimatedTotal = roundMoney(
      EVENT_PRICING.venue.rental +
      foodAndBeverageSubtotal +
      taxAmount +
      serviceChargeAmount +
      enhancementsSubtotal
    );
    return {
      venueRental: EVENT_PRICING.venue.rental,
      reservationDeposit: EVENT_PRICING.venue.deposit,
      foodSubtotal: food,
      hostedBeverageSubtotal: beverages,
      foodAndBeverageSubtotal,
      taxAmount,
      serviceChargeAmount,
      enhancementsSubtotal,
      estimatedTotal,
      remainingAfterDeposit: roundMoney(Math.max(0, estimatedTotal - EVENT_PRICING.venue.deposit))
    };
  };

  const computeEstimate = ({ guestCount, selections = [], addons = [] }) => {
    const guests = Number.isFinite(Number(guestCount)) ? Number(guestCount) : 0;
    let fixedSellTotal = 0;
    let perPersonSellTotal = 0;
    let fixedFoodCost = 0;
    let perPersonFoodCost = 0;
    let hasSelections = false;

    selections.forEach((item) => {
      const qty = item.qty || 1;
      if (qty > 0) hasSelections = true;
      const pricingType = item.pricingType || item.pricing_type || (Number.isFinite(item.fixedPrice) ? 'fixed' : 'per_person');
      if (pricingType === 'fixed' || Number.isFinite(item.fixedPrice) || Number.isFinite(item.fixed_price)) {
        const sell = Number.isFinite(item.fixedPrice) ? item.fixedPrice : Number(item.fixed_price) || 0;
        const cogs = Number.isFinite(item.cogsPerBatch) ? item.cogsPerBatch : Number(item.cogs_per_batch) || 0;
        fixedSellTotal += sell * qty;
        fixedFoodCost += cogs * qty;
      } else {
        const sell = Number.isFinite(item.perPerson) ? item.perPerson : Number(item.per_person_price) || 0;
        const cogs = Number.isFinite(item.cogsPerPerson) ? item.cogsPerPerson : Number(item.cogs_per_person) || 0;
        perPersonSellTotal += sell * qty;
        perPersonFoodCost += cogs * qty * guests;
      }
    });

    addons.forEach((addon) => {
      const qty = addon.qty || 1;
      if (qty > 0) hasSelections = true;
      const fixed = Number(addon.fixed_price);
      const perPerson = Number(addon.per_person_price);
      if (Number.isFinite(fixed)) fixedSellTotal += fixed * qty;
      if (Number.isFinite(perPerson)) perPersonSellTotal += perPerson * qty;
    });

    const subtotal = fixedSellTotal + (perPersonSellTotal * guests);
    const taxAmount = hasSelections
      ? Math.round(subtotal * PRICING_CONSTANTS.DEFAULT_SALES_TAX_PCT)
      : 0;
    const gratuityAmount = hasSelections
      ? Math.round(subtotal * PRICING_CONSTANTS.DEFAULT_GRATUITY_PCT)
      : 0;
    const sellTotal = subtotal + taxAmount + gratuityAmount;
    const foodCostTotal = fixedFoodCost + perPersonFoodCost;
    return {
      sellTotal,
      subtotal,
      taxAmount,
      gratuityAmount,
      total: sellTotal,
      foodCostTotal,
      fixedSellTotal,
      perPersonSellTotal
    };
  };

  window.PrivateMenuPricing = {
    PRICING_CONSTANTS,
    COMMODITY_COSTS,
    MENUS,
    BEVERAGE_ADDONS,
    EVENT_PRICING,
    computeEstimate,
    computeEventEstimate,
    applyPricing
  };
})();
