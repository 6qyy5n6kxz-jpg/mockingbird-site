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
            { name: 'Superboard', pricing_type: 'fixed', fixed_price: 150, cogs_per_batch: 95, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Breakfast Sandwich Bar', pricing_type: 'fixed', fixed_price: 140, cogs_per_batch: 100, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Pancake Bar', pricing_type: 'fixed', fixed_price: 120, cogs_per_batch: 80, servings_per_batch: 18, allow_quantity: true, max_qty: 4 },
            { name: 'Fruit & Veggie Board', pricing_type: 'fixed', fixed_price: 100, cogs_per_batch: 70, servings_per_batch: 16, allow_quantity: true, max_qty: 4 }
          ]
        },
        {
          title: 'Hot Favorites & Baked Items',
          items: [
            // Cheesy potatoes: ~0.35 lb potatoes + 1.5 oz cheese + dairy/butter.
            { name: 'Cheesy Potatoes', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.35, COMMODITY_COSTS.russet_potatoes_lb, 0.55) + (0.094 * COMMODITY_COSTS.cheddar_lb) },
            // Sausage, biscuits & gravy: 0.30 lb sausage + biscuit/flour + gravy.
            { name: 'Sausage, Biscuits & Gravy', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.sausage_lb, 0.6) },
            // French toast casserole: bread + eggs + dairy.
            { name: 'French Toast Casserole', pricing_type: 'per_person', category: 'breakfast', cogs_per_person: ((COMMODITY_COSTS.eggs_dozen / 12) * 3) + (COMMODITY_COSTS.all_purpose_flour_lb * 0.2) + 0.75 },
            // Muffin tin omelets: ~2 eggs + cheese/veg adder.
            { name: 'Muffin Tin Omelets', pricing_type: 'per_person', category: 'breakfast', cogs_per_person: ((COMMODITY_COSTS.eggs_dozen / 12) * 2) + 0.6 },
            // Muffins/breads: 1 portion baked goods.
            { name: 'Muffins & Breakfast Breads', pricing_type: 'per_person', category: 'breakfast', cogs_per_person: 0.95 }
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
            { name: 'Soup', pricing_type: 'per_person', category: 'app', cogs_per_person: 1.5 },
            { name: 'Antipasto', pricing_type: 'per_person', category: 'app', cogs_per_person: 3.1 },
            { name: 'Green or Seasonal Salad', pricing_type: 'per_person', category: 'salad', cogs_per_person: costFromPortion(0.18, COMMODITY_COSTS.spring_mix_lb, COMMODITY_COSTS.dressing_per_serving + 0.25) },
            { name: 'Superboard', pricing_type: 'fixed', fixed_price: 125, cogs_per_batch: 110, servings_per_batch: 16, allow_quantity: true, max_qty: 4 },
            { name: 'Stuffed Mushrooms', pricing_type: 'per_person', category: 'app', cogs_per_person: 2.6 },
            { name: 'Bruschetta', pricing_type: 'per_person', category: 'app', cogs_per_person: 1.6 },
            { name: 'Pasta Salad or Cole Slaw', pricing_type: 'per_person', category: 'side', cogs_per_person: 1.05 },
            { name: 'Fruit & Veggie Board', pricing_type: 'fixed', cogs_per_batch: 70, servings_per_batch: 16 }
          ]
        },
        {
          title: 'Main Courses',
          items: [
            { name: 'Baked Potato Bar', pricing_type: 'per_person', category: 'entree', cogs_per_person: 2.4 },
            { name: 'Macaroni & Cheese', pricing_type: 'per_person', category: 'entree', cogs_per_person: (COMMODITY_COSTS.pasta_lb * 0.18) + (COMMODITY_COSTS.cheddar_lb * 0.15) + 0.55 },
            { name: 'Chicken', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.45, COMMODITY_COSTS.chicken_thighs_lb, 0.45) },
            { name: 'Pulled Pork', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.45, COMMODITY_COSTS.pork_butt_lb, 0.35) },
            { name: 'Shredded Chicken', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.4, COMMODITY_COSTS.chicken_thighs_lb, 0.35) },
            { name: 'Meatballs', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.4, COMMODITY_COSTS.ground_beef_80_20_lb, 0.45) },
            { name: 'Lasagna', pricing_type: 'per_person', category: 'entree', cogs_per_person: (COMMODITY_COSTS.pasta_lb * 0.2) + (COMMODITY_COSTS.mozzarella_lb * 0.2) + COMMODITY_COSTS.marinara_per_serving + 0.55 },
            { name: 'Spaghetti & Meatballs', pricing_type: 'per_person', category: 'entree', cogs_per_person: (COMMODITY_COSTS.pasta_lb * 0.18) + (COMMODITY_COSTS.ground_beef_80_20_lb * 0.15) + COMMODITY_COSTS.marinara_per_serving + 0.4 },
            { name: 'Sloppy Joes', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.ground_beef_80_20_lb, COMMODITY_COSTS.sandwich_buns_each + 0.35) },
            { name: 'Flatbreads', pricing_type: 'per_person', category: 'entree', cogs_per_person: 2.2 }
          ]
        },
        {
          title: 'Sides',
          items: [
            { name: 'Mashed or Cheesy Potatoes', pricing_type: 'per_person', category: 'side', cogs_per_person: 1.2 },
            { name: 'Brussels Sprouts', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.brussels_sprouts_lb, 0.2) },
            { name: 'Broccoli', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.broccoli_lb, 0.15) },
            { name: 'Green Beans', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.green_beans_lb, 0.15) },
            { name: 'Carrots', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.3, COMMODITY_COSTS.carrots_lb, 0.15) },
            { name: 'Seasonal Vegetables', pricing_type: 'per_person', category: 'side', cogs_per_person: costFromPortion(0.3, 1.8, 0.15) },
            { name: 'Baked Beans', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.8 },
            { name: 'Potato Salad', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.9 },
            { name: 'Noodles', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.75 }
          ]
        }
      ]
    },
    {
      id: 'picnic',
      label: 'Picnic-Style Packages',
      sections: [
        {
          title: 'Proteins',
          items: [
            { name: 'Hot Dogs', pricing_type: 'per_person', category: 'entree', cogs_per_person: COMMODITY_COSTS.hotdog_each + COMMODITY_COSTS.sandwich_buns_each + 0.2 },
            { name: 'Brats', pricing_type: 'per_person', category: 'entree', cogs_per_person: COMMODITY_COSTS.brat_each + COMMODITY_COSTS.sandwich_buns_each + 0.25 },
            { name: 'Burgers', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.33, COMMODITY_COSTS.ground_beef_80_20_lb, COMMODITY_COSTS.sandwich_buns_each + 0.35) },
            { name: 'Chicken', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.4, COMMODITY_COSTS.chicken_thighs_lb, 0.35) },
            { name: 'Brisket', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.35, COMMODITY_COSTS.brisket_lb, 0.35) },
            { name: 'Pork Chops', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.45, COMMODITY_COSTS.pork_chops_lb, 0.3) },
            { name: 'Steaks', pricing_type: 'per_person', category: 'entree', cogs_per_person: costFromPortion(0.45, 8.0, 0.35) }
          ]
        },
        {
          title: 'Sides',
          items: [
            { name: 'Fruit & Veggie Board', pricing_type: 'fixed', fixed_price: 100, allow_quantity: true, max_qty: 4 },
            { name: 'Baked Beans', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.8 },
            { name: 'Potato Salad', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.9 },
            { name: 'Cole Slaw', pricing_type: 'per_person', category: 'side', cogs_per_person: 0.9 },
            { name: 'Pasta Salad', pricing_type: 'per_person', category: 'side', cogs_per_person: 1.1 },
            { name: 'Seasonal or Green Salad', pricing_type: 'per_person', category: 'salad', cogs_per_person: costFromPortion(0.18, COMMODITY_COSTS.spring_mix_lb, COMMODITY_COSTS.dressing_per_serving + 0.2) }
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
    computeEstimate,
    applyPricing
  };
})();
