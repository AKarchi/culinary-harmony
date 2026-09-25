const supabaseUrl = "https://qslnjphuawmhsgimudem.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbG5qcGh1YXdtaHNnaW11ZGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MjYxMzgsImV4cCI6MjEwNDQwMjEzOH0.O3Z6pasa2yYXJc72Vhn5jYVNuyMoWQ2fslMSfVBGeFA";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentCategory = "",
  selectedDish = null,
  currentPortion = 2,
  basePortion = 2;
let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
let recentlyViewed = JSON.parse(localStorage.getItem("recentlyViewed")) || [];
let recipeNotes = JSON.parse(localStorage.getItem("recipeNotes")) || {};
let allRecipes = [],
  currentRecipes = [];
let plateSelected = false,
  isOnFavoritesPage = false;
let cookingStepIndex = 0,
  cookingSteps = [];
let timerInterval = null;
let timerSeconds = 0;
let timerRunning = false;
let timerTargetTime = null;
let checkedIngredients = new Set(),
  completedSteps = new Set();
let originalIngredients = [];
let cookingDoneSteps = new Set();
let currentMealType = "all";
let currentCuisine = "all";
let mealFilterVisible = false;
let activeScroll = null;

const mealTypes = [
  { id: "breakfast", label: "Breakfast", labelJp: "朝食", icon: "🌅" },
  { id: "brunch", label: "Brunch", labelJp: "ブランチ", icon: "☕" },
  { id: "lunch", label: "Lunch", labelJp: "昼食", icon: "🍱" },
  { id: "merienda", label: "Snack", labelJp: "間食", icon: "🍵" },
  { id: "dinner", label: "Dinner", labelJp: "夕食", icon: "🌙" },
  { id: "dessert", label: "Dessert", labelJp: "デザート", icon: "🍰" },
  { id: "drinks", label: "Drinks", labelJp: "飲み物", icon: "🍶" },
];

const cuisines = [
  { id: "all", label: "All Cuisines", flag: "🌍" },
  { id: "Japanese", label: "Japanese", flag: "🇯🇵" },
  { id: "Chinese", label: "Chinese", flag: "🇨🇳" },
  { id: "Filipino", label: "Filipino", flag: "🇵🇭" },
  { id: "Korean", label: "Korean", flag: "🇰🇷" },
  { id: "Thai", label: "Thai", flag: "🇹🇭" },
];

const chefTips = [
  "Always taste as you cook — your palate is your best tool.",
  "Let meat rest after cooking for juicier results.",
  "Mise en place: prepare all ingredients before you start.",
  "A pinch of salt enhances sweetness in desserts.",
  "Room temperature ingredients blend more smoothly.",
  "Don't overcrowd the pan — it steams instead of sears.",
  "Fresh herbs at the end brighten any dish.",
  "Acid (lemon, vinegar) balances rich flavors.",
  "Sharp knives are safer than dull ones.",
  "Patience is the secret ingredient in slow-cooked meals.",
];

const RECIPE_CATEGORIES = [
  "breakfast",
  "brunch",
  "lunch",
  "dinner",
  "snacks",
  "desserts",
  "drinks",
];

const lanternQuotes = [
  {
    quote:
      "You're the ADOBO to my everything — savory, steady, and impossible to forget.",
  },
  { quote: "We're a PERFECT BLEND — not too sweet, not too bitter, just us." },
  { quote: "WOK this way — I'll follow you anywhere, even into the kitchen." },
  { quote: "I'm SOY into you — no soy sauce required, just your smile." },
  {
    quote:
      "You had me at TARAON — because every meal tastes better when it's with you.",
  },
];

document.addEventListener("DOMContentLoaded", () => {
  initSplash();
  initPlates();
  initNavbar();
  createSpiceParticles();
  loadRecipes();
  initLogoAnimation();
  window.addEventListener("scroll", handleScroll);
  document.addEventListener("keydown", handleKeyboard);

  const cuisineSelect = document.getElementById("recipeCuisine");
  const customCuisineInput = document.getElementById("customCuisine");

  if (cuisineSelect && customCuisineInput) {
    cuisineSelect.addEventListener("change", function () {
      if (this.value === "Other") {
        customCuisineInput.style.display = "block";
        customCuisineInput.required = true;
      } else {
        customCuisineInput.style.display = "none";
        customCuisineInput.required = false;
        customCuisineInput.value = "";
      }
    });
  }
});

async function loadRecipes() {
  showLoader(true);
  try {
    const fetchPromises = RECIPE_CATEGORIES.map((category) =>
      fetch(`data/${category}.json`).then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${category}.json`);
        return response.json();
      }),
    );
    const allCategoryData = await Promise.all(fetchPromises);
    allRecipes = [];

    allCategoryData.forEach((categoryRecipes, index) => {
      const categoryType = RECIPE_CATEGORIES[index];
      let normalizedCategory =
        categoryType.charAt(0).toUpperCase() + categoryType.slice(1);
      if (categoryType === "snacks") normalizedCategory = "Snack";
      if (categoryType === "desserts") normalizedCategory = "Dessert";

      categoryRecipes.forEach((recipe) => {
        let cleanImagePath = recipe.image;
        if (cleanImagePath && cleanImagePath.startsWith("/")) {
          cleanImagePath = cleanImagePath.substring(1);
        }

        allRecipes.push({
          ...recipe,
          idMeal: recipe.id,
          strMeal: recipe.name,
          strMealThumb: cleanImagePath,
          strArea: recipe.cuisine,
          strCategory: normalizedCategory,
          strInstructions: Array.isArray(recipe.instructions)
            ? recipe.instructions.join("\n")
            : recipe.instructions,
          difficulty: recipe.difficulty,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          mood: recipe.mood,
          servings: recipe.servings,
          chefTip: recipe.tips,
          ...convertIngredients(recipe.ingredients),
        });
      });
    });

    currentRecipes = [...allRecipes];
    showLoader(false);
    renderFeatured();
    renderRecentlyViewed();
    console.log(`✅ Loaded ${allRecipes.length} recipes from JSON files`);
  } catch (error) {
    console.error("❌ Error loading JSON files:", error);
    console.log("⚠️ Using fallback recipes instead");
    generateFallbackRecipes();
    showLoader(false);
    renderFeatured();
    renderRecentlyViewed();
  }
}

function convertIngredients(ingredients) {
  const result = {};
  if (Array.isArray(ingredients)) {
    ingredients.forEach((ing, idx) => {
      result[`strIngredient${idx + 1}`] = ing.name || "";
      result[`strMeasure${idx + 1}`] = ing.measure || "";
    });
  }
  return result;
}

function generateFallbackRecipes() {
  allRecipes = [
    {
      idMeal: "jp1",
      strMeal: "Japanese Breakfast Set",
      strMealThumb:
        "https://images.unsplash.com/photo-1553621042-f6e147245475?w=500",
      strArea: "Japanese",
      strCategory: "Breakfast",
      difficulty: "medium",
      prepTime: 20,
      cookTime: 15,
      mood: "healthy",
      strInstructions:
        "Grill salmon until cooked.\nCook rice in rice cooker.\nPrepare miso soup.\nArrange with pickles and nori.\nServe immediately.",
      strIngredient1: "Salmon",
      strMeasure1: "200g",
      strIngredient2: "Rice",
      strMeasure2: "2 cups",
      strIngredient3: "Miso paste",
      strMeasure3: "2 tbsp",
      strIngredient4: "Nori",
      strMeasure4: "2 sheets",
      strIngredient5: "Pickles",
      strMeasure5: "100g",
    },
    {
      idMeal: "jp2",
      strMeal: "Chicken Teriyaki",
      strMealThumb:
        "https://images.unsplash.com/photo-1569058242567-93de6f36f8e6?w=500",
      strArea: "Japanese",
      strCategory: "Lunch",
      difficulty: "easy",
      prepTime: 10,
      cookTime: 15,
      mood: "quick",
      strInstructions:
        "Mix soy sauce, mirin, and sugar.\nCook chicken until browned.\nPour sauce over chicken and simmer until thick.\nServe with steamed rice.",
      strIngredient1: "Chicken thighs",
      strMeasure1: "500g",
      strIngredient2: "Soy sauce",
      strMeasure2: "3 tbsp",
      strIngredient3: "Mirin",
      strMeasure3: "2 tbsp",
      strIngredient4: "Sugar",
      strMeasure4: "1 tbsp",
      strIngredient5: "Ginger",
      strMeasure5: "1 tsp",
    },
    {
      idMeal: "jp3",
      strMeal: "Matcha Latte",
      strMealThumb:
        "https://images.unsplash.com/photo-1515823662972-da6a2e4d3114?w=500",
      strArea: "Japanese",
      strCategory: "Drinks",
      difficulty: "easy",
      prepTime: 5,
      cookTime: 5,
      mood: "quick",
      strInstructions:
        "Sift matcha powder.\nAdd hot water and whisk.\nSteam milk until frothy.\nPour milk over matcha.",
      strIngredient1: "Matcha powder",
      strMeasure1: "2 tsp",
      strIngredient2: "Hot water",
      strMeasure2: "1/4 cup",
      strIngredient3: "Milk",
      strMeasure3: "1 cup",
      strIngredient4: "Honey",
      strMeasure4: "1 tbsp",
    },
    {
      idMeal: "jp4",
      strMeal: "Mochi Ice Cream",
      strMealThumb:
        "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500",
      strArea: "Japanese",
      strCategory: "Dessert",
      difficulty: "hard",
      prepTime: 30,
      cookTime: 10,
      mood: "impressive",
      strInstructions:
        "Mix glutinous rice flour and sugar.\nAdd water and microwave.\nWrap ice cream balls in mochi.\nFreeze for 1 hour.",
      strIngredient1: "Glutinous rice flour",
      strMeasure1: "1 cup",
      strIngredient2: "Sugar",
      strMeasure2: "1/4 cup",
      strIngredient3: "Water",
      strMeasure3: "1 cup",
      strIngredient4: "Ice cream",
      strMeasure4: "1 pint",
      strIngredient5: "Cornstarch",
      strMeasure5: "for dusting",
    },
    {
      idMeal: "th1",
      strMeal: "Pad Thai",
      strMealThumb:
        "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=500",
      strArea: "Thai",
      strCategory: "Lunch",
      difficulty: "medium",
      prepTime: 20,
      cookTime: 15,
      mood: "impressive",
      strInstructions:
        "Soak rice noodles.\nStir-fry shrimp and tofu.\nAdd noodles and sauce.\nToss with peanuts and lime.",
      strIngredient1: "Rice noodles",
      strMeasure1: "200g",
      strIngredient2: "Shrimp",
      strMeasure2: "200g",
      strIngredient3: "Tofu",
      strMeasure3: "100g",
      strIngredient4: "Tamarind paste",
      strMeasure4: "2 tbsp",
      strIngredient5: "Peanuts",
      strMeasure5: "1/4 cup",
    },
    {
      idMeal: "th2",
      strMeal: "Mango Sticky Rice",
      strMealThumb:
        "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500",
      strArea: "Thai",
      strCategory: "Dessert",
      difficulty: "easy",
      prepTime: 10,
      cookTime: 30,
      mood: "comfort",
      strInstructions:
        "Cook sticky rice in coconut milk.\nLet stand 30 minutes.\nSlice ripe mango.\nServe rice with mango.",
      strIngredient1: "Sticky rice",
      strMeasure1: "1 cup",
      strIngredient2: "Coconut milk",
      strMeasure2: "1 cup",
      strIngredient3: "Sugar",
      strMeasure3: "2 tbsp",
      strIngredient4: "Mango",
      strMeasure4: "2 ripe",
      strIngredient5: "Salt",
      strMeasure5: "1/4 tsp",
    },
    {
      idMeal: "ph1",
      strMeal: "Chicken Adobo",
      strMealThumb:
        "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=500",
      strArea: "Filipino",
      strCategory: "Dinner",
      difficulty: "easy",
      prepTime: 10,
      cookTime: 40,
      mood: "comfort",
      strInstructions:
        "Marinate chicken in soy sauce, vinegar, garlic.\nSauté garlic.\nAdd chicken and brown.\nSimmer 40 mins.",
      strIngredient1: "Chicken",
      strMeasure1: "1kg",
      strIngredient2: "Soy sauce",
      strMeasure2: "1/2 cup",
      strIngredient3: "Vinegar",
      strMeasure3: "1/2 cup",
      strIngredient4: "Garlic",
      strMeasure4: "6 cloves",
      strIngredient5: "Bay leaves",
      strMeasure5: "3",
    },
    {
      idMeal: "kr1",
      strMeal: "Bibimbap",
      strMealThumb:
        "https://images.unsplash.com/photo-1580651315530-69c8e10225cb?w=500",
      strArea: "Korean",
      strCategory: "Lunch",
      difficulty: "medium",
      prepTime: 30,
      cookTime: 20,
      mood: "healthy",
      strInstructions:
        "Cook rice.\nSauté vegetables.\nFry egg.\nArrange over rice with gochujang.",
      strIngredient1: "Rice",
      strMeasure1: "2 cups",
      strIngredient2: "Spinach",
      strMeasure2: "1 cup",
      strIngredient3: "Carrots",
      strMeasure3: "2",
      strIngredient4: "Bean sprouts",
      strMeasure4: "1 cup",
      strIngredient5: "Gochujang",
      strMeasure5: "2 tbsp",
    },
  ];
  currentRecipes = [...allRecipes];
}

function getDifficulty(r) {
  const steps = (r.strInstructions || "").split(".").length;
  const ingredients = Object.keys(r).filter(
    (k) => k.startsWith("strIngredient") && r[k],
  ).length;
  if (steps <= 5 && ingredients <= 6) return "easy";
  if (steps <= 10 && ingredients <= 12) return "medium";
  return "hard";
}
function getPrepTime(r) {
  return Math.floor(Math.random() * 15) + 5;
}
function getCookTime(r) {
  return Math.floor(Math.random() * 40) + 15;
}
function getMood(r) {
  const moods = ["quick", "comfort", "healthy", "impressive", "budget"];
  return moods[Math.floor(Math.random() * moods.length)];
}

function filterRecipesByCategory(category) {
  const categoryMap = {
    breakfast: "Breakfast",
    brunch: "Brunch",
    lunch: "Lunch",
    merienda: "Snack",
    dinner: "Dinner",
    dessert: "Dessert",
    drinks: "Drinks",
  };
  const mealCategory = categoryMap[category];
  if (mealCategory) {
    currentRecipes = allRecipes.filter((r) => r.strCategory === mealCategory);
  } else {
    currentRecipes = [...allRecipes];
  }
  if (currentRecipes.length === 0) currentRecipes = allRecipes.slice(0, 10);
}

function filterByMood(mood, btn) {
  document
    .querySelectorAll(".mood-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentRecipes = allRecipes.filter((r) => r.mood === mood);
  if (currentRecipes.length === 0) currentRecipes = allRecipes.slice(0, 8);
  showBrowsePage(false, currentRecipes);
  showToast(`Showing ${mood} recipes`, "success");
}

function renderFeatured() {
  if (allRecipes.length === 0) return;
  const dayIndex = new Date().getDate() % allRecipes.length;
  const featured = allRecipes[dayIndex];
  const cuisine =
    cuisines.find((c) => c.label === featured.strArea) || cuisines[0];
  const section = document.getElementById("featuredSection");
  section.innerHTML = "";
  const card = document.createElement("div");
  card.className = "featured-card";
  card.onclick = () => showRecipe(featured);
  card.innerHTML = `<div class="featured-image" style="background-image:url('${featured.strMealThumb}')"><div class="featured-badge">✨ Daily Featured</div></div><div class="featured-content"><div class="featured-label">Today's Recommendation</div><h2 class="featured-title">${featured.strMeal}</h2><p class="featured-desc">A delicious ${featured.strArea || "Asian"} dish perfect for today. Simple to make, full of authentic flavor.</p><div class="featured-meta"><div class="meta-item"><span class="icon">⏱️</span><span>${featured.prepTime || 10}+${featured.cookTime || 20} min</span></div><div class="meta-item"><span class="icon">🔥</span><span class="difficulty-badge difficulty-${featured.difficulty}">${featured.difficulty}</span></div><div class="meta-item"><span class="icon">${cuisine.flag}</span><span>${featured.strArea || "International"}</span></div></div><button class="featured-cta" onclick="event.stopPropagation();showRecipe(allRecipes[${dayIndex}])">View Recipe →</button></div>`;
  section.appendChild(card);
}

function addToRecentlyViewed(recipe) {
  recentlyViewed = recentlyViewed.filter((r) => r.idMeal !== recipe.idMeal);
  recentlyViewed.unshift(recipe);
  if (recentlyViewed.length > 6) recentlyViewed = recentlyViewed.slice(0, 6);
  localStorage.setItem("recentlyViewed", JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

function renderRecentlyViewed() {
  const section = document.getElementById("recentlySection");
  const grid = document.getElementById("recentlyGrid");
  if (recentlyViewed.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  grid.innerHTML = recentlyViewed
    .map(
      (r) =>
        `<div class="recently-card" onclick='showRecipeById("${r.idMeal}")'><div class="recently-img" style="background-image:url('${r.strMealThumb}')"></div><div class="recently-name">${r.strMeal}</div></div>`,
    )
    .join("");
}

function showRecipeById(id) {
  const recipe = allRecipes.find((r) => r.idMeal === id);
  if (recipe) showRecipe(recipe);
}

function parseQuantity(qty) {
  if (!qty) return 0;
  qty = qty.trim().toLowerCase();
  if (qty.includes("/") && !qty.includes(" ")) {
    const parts = qty.split("/");
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  const mixedMatch = qty.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    return (
      parseInt(mixedMatch[1]) +
      parseInt(mixedMatch[2]) / parseInt(mixedMatch[3])
    );
  }
  const num = parseFloat(qty);
  return isNaN(num) ? 0 : num;
}

function formatQuantity(num) {
  if (num === 0) return "";
  num = Math.round(num * 100) / 100;
  if (Number.isInteger(num)) return num.toString();
  if (Math.abs(num - 0.5) < 0.01) return "1/2";
  if (Math.abs(num - 0.25) < 0.01) return "1/4";
  if (Math.abs(num - 0.75) < 0.01) return "3/4";
  if (Math.abs(num - 0.33) < 0.01) return "1/3";
  if (Math.abs(num - 0.67) < 0.01) return "2/3";
  return num.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function showRecipe(recipe) {
  if (!recipe) {
    showToast("Recipe not found", "error");
    return;
  }
  selectedDish = recipe;
  basePortion = recipe.servings || 2;
  currentPortion = basePortion;
  checkedIngredients = new Set();
  completedSteps = new Set();
  cookingDoneSteps = new Set();
  const modal = document.getElementById("recipeModal");
  const book = document.getElementById("recipeBook");
  document.getElementById("recipeTitle").textContent = recipe.strMeal;

  let imagePath = recipe.strMealThumb;
  if (imagePath && imagePath.startsWith("/")) {
    imagePath = imagePath.substring(1);
  }

  const recipeImageEl = document.getElementById("recipeImage");
  const testImg = new Image();
  testImg.onload = () => {
    recipeImageEl.style.backgroundImage = `url('${imagePath}')`;
  };
  testImg.onerror = () => {
    console.warn("Image failed:", imagePath);
    recipeImageEl.style.backgroundImage =
      "linear-gradient(135deg, var(--beige) 0%, var(--rice-paper) 100%)";
  };
  testImg.src = imagePath;

  const cuisine =
    cuisines.find((c) => c.label === recipe.strArea) || cuisines[0];
  document.getElementById("recipeCuisine").innerHTML =
    `<span class="flag">${cuisine.flag}</span><span>${recipe.strArea || "International"}</span>`;
  document.getElementById("recipeMetaRow").innerHTML = `
    <div class="meta-chip">⏱️ Prep: ${recipe.prepTime || 10} min</div>
    <div class="meta-chip">🔥 Cook: ${recipe.cookTime || 20} min</div>
    <div class="meta-chip difficulty-badge difficulty-${recipe.difficulty}">${recipe.difficulty}</div>
    <div class="meta-chip">🍽️ ${recipe.strCategory || "Main"}</div>
  `;

  originalIngredients = [];
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = recipe[`strIngredient${i}`];
    const measure = recipe[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      const qty = parseQuantity(measure);
      originalIngredients.push({
        name: ingredient.trim(),
        originalQty: qty,
        originalMeasure: (measure || "").trim(),
      });
      ingredients.push({
        name: ingredient.trim(),
        measure: (measure || "").trim(),
        qty: qty,
      });
    }
  }

  renderIngredients(ingredients);

  const instructions = (recipe.strInstructions || "")
    .split("\n")
    .filter((s) => s.trim());
  document.getElementById("instructionList").innerHTML = instructions
    .map(
      (inst, idx) =>
        `<li class="instruction-item" onclick="toggleStep(${idx},this)">
      <div class="step-number">${idx + 1}</div>
      <span>${inst}</span>
    </li>`,
    )
    .join("");

  cookingSteps = instructions;
  updateProgress();

  document.getElementById("chefTip").textContent =
    recipe.chefTip || chefTips[Math.floor(Math.random() * chefTips.length)];

  const notesKey = recipe.idMeal;
  document.getElementById("recipeNotes").value = recipeNotes[notesKey] || "";
  document.getElementById("recipeNotes").oninput = (e) => {
    recipeNotes[notesKey] = e.target.value;
    localStorage.setItem("recipeNotes", JSON.stringify(recipeNotes));
  };

  renderRelatedRecipes(recipe);
  createSteam();
  updateStarButton();
  updatePortionDisplay();

  modal.style.display = "flex";
  setTimeout(() => book.classList.add("open"), 100);

  anime({
    targets: ".recipe-book",
    rotateY: [-20, 0],
    translateX: [-50, 0],
    opacity: [0, 1],
    duration: 1000,
    easing: "easeOutQuad",
  });
  anime({
    targets: ".recipe-badge",
    scale: [0.8, 1],
    opacity: [0, 1],
    duration: 600,
    easing: "easeOutElastic(1, .6)",
    delay: 300,
  });

  addToRecentlyViewed(recipe);
  cookingStepIndex = 0;
}

function renderIngredients(ingredients) {
  document.getElementById("ingredientList").innerHTML = ingredients
    .map(
      (ing, idx) =>
        `<li class="ingredient-item" onclick="toggleIngredient(${idx},this)"><div class="ingredient-check"></div><span class="ingredient-qty">${ing.measure}</span><span>${ing.name}</span></li>`,
    )
    .join("");
}

function createSteam() {
  const container = document.getElementById("steamContainer");
  container.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const p = document.createElement("div");
    p.className = "steam-particle";
    p.style.left = 10 + i * 20 + "%";
    p.style.animationDelay = i * 0.5 + "s";
    container.appendChild(p);
  }
}

function renderRelatedRecipes(current) {
  const related = allRecipes
    .filter(
      (r) =>
        r.idMeal !== current.idMeal &&
        (r.strArea === current.strArea ||
          r.strCategory === current.strCategory),
    )
    .slice(0, 3);
  const grid = document.getElementById("relatedGrid");
  if (related.length === 0) {
    document.getElementById("relatedSection").style.display = "none";
    return;
  }
  document.getElementById("relatedSection").style.display = "block";
  grid.innerHTML = related
    .map(
      (r) =>
        `<div class="related-card" onclick='showRecipeById("${r.idMeal}")'><div class="related-img" style="background-image:url('${r.strMealThumb}')"></div><div class="related-name">${r.strMeal}</div></div>`,
    )
    .join("");
}

function closeRecipe() {
  const modal = document.getElementById("recipeModal");
  const book = document.getElementById("recipeBook");
  anime({
    targets: ".recipe-book",
    rotateY: [0, 20],
    translateX: [0, 50],
    opacity: [1, 0],
    duration: 600,
    easing: "easeInQuad",
    complete: () => {
      modal.style.display = "none";
      book.classList.remove("open");
    },
  });
}

function toggleIngredient(idx, el) {
  if (checkedIngredients.has(idx)) {
    checkedIngredients.delete(idx);
    el.classList.remove("checked");
  } else {
    checkedIngredients.add(idx);
    el.classList.add("checked");
  }
}

function toggleStep(idx, el) {
  if (completedSteps.has(idx)) {
    completedSteps.delete(idx);
    el.classList.remove("completed");
  } else {
    completedSteps.add(idx);
    el.classList.add("completed");
  }
  updateProgress();
  if (completedSteps.size === cookingSteps.length && cookingSteps.length > 0) {
    showToast("🎉 Recipe complete! Enjoy your meal!", "success");
    launchConfetti();
  }
}

function updateProgress() {
  const total = cookingSteps.length;
  const done = completedSteps.size;
  const pct = total > 0 ? (done / total) * 100 : 0;
  document.getElementById("progressFill").style.width = pct + "%";
}

function adjustPortion(delta) {
  const newPortion = Math.max(1, currentPortion + delta);
  if (newPortion === currentPortion) return;
  const ratio = newPortion / basePortion;
  currentPortion = newPortion;
  updatePortionDisplay();
  const scaledIngredients = originalIngredients.map((ing) => {
    const newQty = ing.originalQty * ratio;
    return { name: ing.name, measure: formatQuantity(newQty), qty: newQty };
  });
  const items = document.querySelectorAll(".ingredient-item");
  anime({
    targets: items,
    translateX: [-10, 0],
    opacity: [0.5, 1],
    duration: 400,
    delay: anime.stagger(30),
    easing: "easeOutQuad",
  });
  renderIngredients(scaledIngredients);
  showToast(
    `Adjusted to ${currentPortion} serving${currentPortion > 1 ? "s" : ""}`,
    "success",
  );
}

function updatePortionDisplay() {
  document.getElementById("portionCount").textContent = currentPortion;
}

function toggleStar() {
  if (!selectedDish) return;
  const index = favorites.findIndex((f) => f.idMeal === selectedDish.idMeal);
  if (index > -1) {
    favorites.splice(index, 1);
    showToast("Removed from favorites", "");
  } else {
    favorites.push(selectedDish);
    showToast("⭐ Added to favorites!", "success");
    launchConfetti();
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  updateStarButton();
  if (isOnFavoritesPage) {
    currentRecipes = [...favorites];
    renderDishes();
  }
}

function updateStarButton() {
  const btn = document.getElementById("starBtn");
  const isFavorited = favorites.some((f) => f.idMeal === selectedDish?.idMeal);
  btn.textContent = isFavorited ? "★" : "☆";
  btn.classList.toggle("active", isFavorited);
}

function openTimer() {
  const modal = document.getElementById("timerModal");
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("active"), 10);
}

function openTimerFromCooking() {
  const modal = document.getElementById("timerModal");
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("active"), 10);
  updateTimerDisplay();
}

function closeTimer() {
  const modal = document.getElementById("timerModal");
  modal.classList.remove("active");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
}

function setTimer(minutes) {
  console.log("Setting timer:", minutes, "minutes =", minutes * 60, "seconds");
  timerSeconds = minutes * 60;
  timerTargetTime = Date.now() + timerSeconds * 1000;
  updateTimerDisplay();
  updateSmallTimerDisplay();
  showToast(`Timer set to ${minutes} min`, "success");
}

function startTimer() {
  if (timerRunning) return;
  if (timerSeconds <= 0) {
    showToast("Set a time first!", "error");
    return;
  }

  timerTargetTime = Date.now() + timerSeconds * 1000;
  timerRunning = true;
  updateTimerButtonState();

  timerInterval = setInterval(() => {
    const remaining = Math.ceil((timerTargetTime - Date.now()) / 1000);

    if (remaining <= 0) {
      timerSeconds = 0;
      updateTimerDisplay();
      updateSmallTimerDisplay();
      timerComplete();
    } else {
      timerSeconds = remaining;
      updateTimerDisplay();
      updateSmallTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerTargetTime = null;
  updateTimerButtonState();
}
function resetTimer() {
  pauseTimer();
  timerSeconds = 0;
  timerTargetTime = null;
  updateTimerDisplay();
  updateSmallTimerDisplay();
  updateTimerButtonState();
}
function timerComplete() {
  pauseTimer();
  playTimerDing();
  showToast("⏰ Timer complete!", "success");
  const timerBtn = document.querySelector(".cooking-timer-btn");
  if (timerBtn) {
    timerBtn.style.animation = "pulse 0.5s ease-in-out 3";
    setTimeout(() => {
      timerBtn.style.animation = "";
    }, 1500);
  }
}
function playTimerDing() {
  const audio = document.getElementById("timerDingSound");
  if (audio) {
    audio.play().catch((e) => {
      console.log("Audio play failed:", e);
    });
  }
}
function updateTimerDisplay() {
  const display = document.getElementById("timerDisplay");
  if (display) {
    display.textContent = formatTime(timerSeconds);
  }
}
function updateSmallTimerDisplay() {
  const display = document.getElementById("timerDisplaySmall");
  const timerBtn = document.querySelector(".cooking-timer-btn");

  if (display && timerBtn) {
    if (timerSeconds > 0) {
      display.textContent = formatTime(timerSeconds);
      display.style.display = "inline";
      timerBtn.classList.add("active");
    } else {
      display.style.display = "none";
      timerBtn.classList.remove("active");
    }
  }
}
function updateTimerButtonState() {
  const startBtn = document.querySelector(".timer-btn.start");
  const pauseBtn = document.querySelector(".timer-btn.pause");

  if (startBtn && pauseBtn) {
    if (timerRunning) {
      startBtn.style.display = "none";
      pauseBtn.style.display = "inline-block";
    } else {
      startBtn.style.display = "inline-block";
      pauseBtn.style.display = "none";
    }
  }
}
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}
function playTimerSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => {
      osc.frequency.value = 1000;
    }, 200);
    setTimeout(() => {
      osc.frequency.value = 1200;
    }, 400);
    setTimeout(() => {
      osc.stop();
    }, 600);
  } catch (e) {}
}

function toggleCookingMode() {
  if (cookingSteps.length === 0) return;
  document.getElementById("cookingMode").classList.add("active");
  if (selectedDish && selectedDish.strMealThumb) {
    document.getElementById("cookingRecipeThumb").style.backgroundImage =
      `url(${selectedDish.strMealThumb})`;
  }
  cookingStepIndex = 0;
  cookingDoneSteps = new Set();
  renderCookingStep();
  anime({
    targets: "#cookingMode",
    opacity: [0, 1],
    duration: 500,
    easing: "easeOutQuad",
  });
  anime({
    targets: ".cooking-step-display",
    translateY: [30, 0],
    opacity: [0, 1],
    duration: 600,
    delay: 200,
    easing: "easeOutQuad",
  });
}

function exitCookingMode() {
  anime({
    targets: "#cookingMode",
    opacity: [1, 0],
    duration: 300,
    easing: "easeInQuad",
    complete: () => {
      document.getElementById("cookingMode").classList.remove("active");
    },
  });
}

function viewFullImage() {
  if (!selectedDish || !selectedDish.strMealThumb) return;
  document.getElementById("fullImage").src = selectedDish.strMealThumb;
  document.getElementById("fullImageModal").classList.add("active");
}

function closeFullImage() {
  document.getElementById("fullImageModal").classList.remove("active");
}

function toggleMarkDone() {
  const btn = document.getElementById("markDoneBtn");
  if (cookingDoneSteps.has(cookingStepIndex)) {
    cookingDoneSteps.delete(cookingStepIndex);
    btn.classList.remove("done");
    document.getElementById("markDoneText").textContent = "Mark as Done";
  } else {
    cookingDoneSteps.add(cookingStepIndex);
    btn.classList.add("done");
    document.getElementById("markDoneText").textContent = "Done ✓";
    anime({
      targets: btn,
      scale: [1, 1.1, 1],
      duration: 400,
      easing: "easeOutElastic(1, .6)",
    });
  }
  updateCookingDots();
  if (cookingDoneSteps.size === cookingSteps.length) {
    showToast(" All steps completed!", "success");
    setTimeout(() => launchConfetti(), 300);
  }
}

function renderCookingStep() {
  const total = cookingSteps.length;
  const progressPct = (cookingStepIndex / total) * 100;
  document.getElementById("cookingProgressTopFill").style.width =
    progressPct + "%";
  document.getElementById("counterCurrent").textContent = cookingStepIndex + 1;
  document.getElementById("counterTotal").textContent = total;
  document.getElementById("stepCurrentNum").textContent = cookingStepIndex + 1;
  document.getElementById("stepTotalNum").textContent = total;
  if (cookingStepIndex >= total) {
    document.getElementById("cookingStepDisplay").innerHTML =
      `<div class="cooking-complete"><div class="cooking-complete-icon"></div><div class="cooking-complete-title">All Done!</div><div class="cooking-complete-text">Your dish is ready! Enjoy your meal.</div><div class="cooking-controls"><button class="cooking-btn primary" onclick="exitCookingMode()">✕ Exit Cooking Mode</button></div></div>`;
    launchConfetti();
    return;
  }
  const display = document.getElementById("cookingStepDisplay");
  if (!document.getElementById("cookingStepText")) {
    display.innerHTML = `<div class="cooking-step-label">Current Step</div><div class="cooking-step-number">Step <span class="step-current" id="stepCurrentNum">${cookingStepIndex + 1}</span> of <span class="step-total" id="stepTotalNum">${total}</span></div><div class="cooking-step-text" id="cookingStepText">Loading...</div><button class="cooking-mark-done" id="markDoneBtn" onclick="toggleMarkDone()"><span class="check-box"></span><span id="markDoneText">Mark as Done</span></button><div class="cooking-controls"><button class="cooking-btn" id="prevCookingBtn" onclick="prevCookingStep()">← Previous</button><button class="cooking-btn primary" id="nextCookingBtn" onclick="nextCookingStep()">Next Step →</button><button class="cooking-btn" onclick="exitCookingMode()">✕ Exit</button></div><div class="cooking-progress-dots" id="cookingDots"></div>`;
  }
  const stepText = document.getElementById("cookingStepText");
  anime({
    targets: stepText,
    opacity: [0, 1],
    translateY: [10, 0],
    duration: 400,
    easing: "easeOutQuad",
  });
  stepText.textContent = cookingSteps[cookingStepIndex];
  const prevBtn = document.getElementById("prevCookingBtn");
  if (prevBtn) prevBtn.disabled = cookingStepIndex === 0;
  const nextBtn = document.getElementById("nextCookingBtn");
  if (nextBtn) {
    nextBtn.textContent =
      cookingStepIndex === total - 1 ? "Finish ✓" : "Next Step →";
  }
  updateMarkDoneButton();
  updateCookingDots();
}

function updateMarkDoneButton() {
  const btn = document.getElementById("markDoneBtn");
  const text = document.getElementById("markDoneText");
  if (!btn || !text) return;
  if (cookingDoneSteps.has(cookingStepIndex)) {
    btn.classList.add("done");
    text.textContent = "Done ✓";
  } else {
    btn.classList.remove("done");
    text.textContent = "Mark as Done";
  }
}

function updateCookingDots() {
  const dots = document.getElementById("cookingDots");
  if (!dots) return;
  dots.innerHTML = cookingSteps
    .map((_, i) => {
      let cls = "cooking-dot";
      if (i === cookingStepIndex) cls += " active";
      else if (cookingDoneSteps.has(i)) cls += " done";
      return `<div class="${cls}" onclick="jumpToStep(${i})" title="Step ${i + 1}"></div>`;
    })
    .join("");
}

function jumpToStep(index) {
  if (index < 0 || index >= cookingSteps.length) return;
  cookingStepIndex = index;
  renderCookingStep();
  anime({
    targets: ".cooking-step-text",
    opacity: [0, 1],
    translateX: [20, 0],
    duration: 400,
    easing: "easeOutQuad",
  });
}

function nextCookingStep() {
  if (cookingStepIndex < cookingSteps.length) {
    cookingStepIndex++;
    renderCookingStep();
    anime({
      targets: ".cooking-step-display",
      translateX: [30, 0],
      opacity: [0.7, 1],
      duration: 400,
      easing: "easeOutQuad",
    });
  }
}

function prevCookingStep() {
  if (cookingStepIndex > 0) {
    cookingStepIndex--;
    renderCookingStep();
    anime({
      targets: ".cooking-step-display",
      translateX: [-30, 0],
      opacity: [0.7, 1],
      duration: 400,
      easing: "easeOutQuad",
    });
  }
}

function launchConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const particles = [];
  const colors = ["#C41E3A", "#D4AF37", "#FFB7C5", "#00A86B", "#E34234"];
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 5 + 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    });
  }
  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });
    frame++;
    if (frame < 180) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

function showToast(message, type = "") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icons = { success: "✅", error: "❌", "": "ℹ️" };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function printRecipe() {
  window.print();
  showToast("Print dialog opened", "success");
}
async function shareRecipe() {
  if (navigator.share && selectedDish) {
    try {
      await navigator.share({
        title: selectedDish.strMeal,
        text: `Check out this recipe: ${selectedDish.strMeal}`,
        url: window.location.href,
      });
    } catch (e) {}
  } else {
    navigator.clipboard.writeText(
      `${selectedDish.strMeal} - ${window.location.href}`,
    );
    showToast("Link copied to clipboard!", "success");
  }
}

function showFavorites() {
  isOnFavoritesPage = true;
  showBrowsePage(true);
}

function setActiveNavButton(page) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (activeBtn) {
    activeBtn.classList.add("active");
    anime({
      targets: activeBtn,
      scale: [1, 1.08, 1],
      duration: 400,
      easing: "easeOutElastic(1, .6)",
    });
    anime({
      targets: activeBtn.querySelectorAll(".nav-btn-jp, .nav-btn-en"),
      translateY: [5, 0],
      opacity: [0.5, 1],
      duration: 300,
      delay: anime.stagger(50),
      easing: "easeOutQuad",
    });
  }
}

function showBrowsePage(isFavorites = false, customRecipes = null) {
  document.getElementById("main-container").style.display = "none";
  document.getElementById("upload-page").style.display = "none";
  document.getElementById("community-page").style.display = "none";
  document.getElementById("browse-page").style.display = "block";
  document.getElementById("spin-btn").classList.remove("visible");
  document.getElementById("quickSpinContainer").style.opacity = "0";
  const titleEl = document.getElementById("browseTitle");
  const subtitleEl = document.getElementById("browseSubtitle");
  const searchBar = document.getElementById("searchBarContainer");
  const filterBar = document.getElementById("cuisineFilter");
  if (isFavorites) {
    titleEl.textContent = "お気に入り | Your Favorites";
    subtitleEl.textContent = "Your saved homemade recipes collection";
    searchBar.style.display = "none";
    filterBar.style.display = "none";
    currentRecipes = [...favorites];
    setActiveNavButton("favorites");
  } else {
    isOnFavoritesPage = false;
    titleEl.textContent = "レシピを探す | Explore Recipes";
    subtitleEl.textContent = "Discover homemade culinary treasures from Asia";
    searchBar.style.display = "block";
    filterBar.style.display = "flex";
    initCuisineFilters();
    currentRecipes = customRecipes || [...allRecipes];
    setActiveNavButton("browse");
  }
  renderDishes();
  anime({
    targets: "#browse-page",
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 800,
    easing: "easeOutQuad",
  });
}

function showMainPage() {
  isOnFavoritesPage = false;
  document.getElementById("browse-page").style.display = "none";
  document.getElementById("upload-page").style.display = "none";
  document.getElementById("community-page").style.display = "none";
  document.getElementById("main-container").style.display = "block";
  document.getElementById("spin-btn").classList.remove("visible");
  document.getElementById("quickSpinContainer").style.opacity = "0";
  document
    .querySelectorAll(".mood-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".plate").forEach((p) => {
    p.classList.remove("active", "orbiting", "spinning");
  });
  currentMealType = "all";
  currentCuisine = "all";
  document.getElementById("mealTypeFilter").style.display = "none";
  mealFilterVisible = false;
  plateSelected = false;
  setActiveNavButton("home");
  setTimeout(() => arrangePlatesInCircle(), 150);
  anime({
    targets: "#main-container",
    opacity: [0, 1],
    duration: 800,
    easing: "easeOutQuad",
  });
  anime({
    targets: ".page-title",
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: 200,
  });
  renderRecentlyViewed();
}

function initCuisineFilters() {
  const container = document.getElementById("cuisineFilter");
  container.innerHTML = cuisines
    .map(
      (c) =>
        `<button class="filter-btn ${c.id === "all" ? "active" : ""}" onclick="filterByCuisine('${c.id}',this)"><span>${c.flag}</span> ${c.label}</button>`,
    )
    .join("");
}

function filterByCuisine(cuisine, btn) {
  document
    .querySelectorAll(".cuisine-filter .filter-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentCuisine = cuisine;
  const mealTypeFilter = document.getElementById("mealTypeFilter");
  if (cuisine === "all") {
    mealTypeFilter.style.display = "none";
    currentRecipes = [...allRecipes];
  } else {
    mealTypeFilter.style.display = "flex";
    currentRecipes = allRecipes.filter((r) => {
      const recipeArea = (r.strArea || "").toLowerCase();
      const filterArea = cuisine.toLowerCase();
      return recipeArea === filterArea;
    });
    if (!mealFilterVisible) {
      mealFilterVisible = true;
      anime({
        targets: ".meal-btn",
        opacity: [0, 1],
        translateY: [20, 0],
        scale: [0.9, 1],
        delay: anime.stagger(80, { start: 100 }),
        duration: 600,
        easing: "easeOutBack",
      });
    }
  }
  if (currentMealType !== "all") {
    applyMealTypeFilter();
  }
  renderDishes();
}

function filterByMealType(mealType, btn) {
  createRipple(btn, event);
  document
    .querySelectorAll(".meal-type-filter .filter-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentMealType = mealType;
  if (mealType === "all") {
    if (currentCuisine === "all") {
      currentRecipes = [...allRecipes];
    } else {
      currentRecipes = allRecipes.filter((r) => {
        const recipeArea = (r.strArea || "").toLowerCase();
        const filterArea = currentCuisine.toLowerCase();
        return recipeArea === filterArea;
      });
    }
  } else {
    applyMealTypeFilter();
  }
  renderDishes();
}

function createRipple(button, event) {
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = event.clientX - rect.left - size / 2 + "px";
  ripple.style.top = event.clientY - rect.top - size / 2 + "px";
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

function applyMealTypeFilter() {
  let sourceList = isOnFavoritesPage ? favorites : allRecipes;
  let filtered =
    currentCuisine === "all"
      ? [...sourceList]
      : sourceList.filter((r) => {
          const recipeArea = (r.strArea || "").toLowerCase();
          const filterArea = currentCuisine.toLowerCase();
          return recipeArea === filterArea;
        });
  if (currentMealType !== "all") {
    filtered = filtered.filter((r) => r.strCategory === currentMealType);
  }
  currentRecipes = filtered;
}

function searchDishes() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  currentRecipes = !query
    ? [...allRecipes]
    : allRecipes.filter((r) => r.strMeal.toLowerCase().includes(query));
  renderDishes();
}

function renderDishes() {
  const grid = document.getElementById("dishesGrid");
  if (currentRecipes.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🍽️</div><h3>No recipes found</h3><p>Try a different search or browse our full collection.</p></div>`;
    return;
  }
  grid.innerHTML = currentRecipes
    .map((recipe) => {
      const cuisine =
        cuisines.find((c) => c.label === recipe.strArea) || cuisines[0];
      return `<div class="dish-card" onclick='showRecipeById("${recipe.idMeal}")'><div class="washi-tape"></div><div class="dish-difficulty"><span class="difficulty-badge difficulty-${recipe.difficulty}">${recipe.difficulty}</span></div><div class="dish-image-wrapper"><img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" class="dish-image"><div class="postcard-stamp"><span class="stamp-en-top">FOOD</span><span class="stamp-jp-char">食</span><span class="stamp-jp-small">食</span></div></div><div class="dish-info"><h3 class="dish-name">${recipe.strMeal}</h3><div class="dish-meta"><div class="dish-cuisine"><span>${cuisine.flag}</span><span>${recipe.strArea || "International"}</span></div><span class="dish-category">⏱️ ${(recipe.prepTime || 10) + (recipe.cookTime || 20)} min</span></div></div></div>`;
    })
    .join("");

  const cards = document.querySelectorAll(".dish-card");
  if (cards.length === 0) return;

  const gridRect = grid.getBoundingClientRect();
  const stackCenterX = gridRect.left + gridRect.width / 2;
  const stackCenterY = gridRect.top + 150;

  anime.set(cards, {
    opacity: 0,
    scale: 0.8,
    zIndex: 100,
    rotate: function () {
      return anime.random(-12, 12);
    },
    translateX: function (el) {
      const rect = el.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      return stackCenterX - cardCenterX;
    },
    translateY: function (el) {
      const rect = el.getBoundingClientRect();
      const cardCenterY = rect.top + rect.height / 2;
      return stackCenterY - cardCenterY;
    },
  });

  anime({
    targets: cards,
    opacity: 1,
    duration: 200,
    easing: "linear",
    complete: function () {
      anime({
        targets: cards,
        translateX: 0,
        translateY: 0,
        scale: 1,
        rotate: 0,
        zIndex: 1,
        delay: anime.stagger(60),
        duration: 900,
        easing: "easeOutElastic(1, .5)",
      });
    },
  });
}

function initNavbar() {
  anime({
    targets: "#navbar",
    translateY: [-100, 0],
    duration: 1200,
    easing: "easeOutQuad",
    delay: 2500,
  });
  anime({
    targets: ".page-title",
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: 3000,
  });
}

function showLoader(show) {
  const el = document.getElementById("loader");
  if (el) el.style.display = show ? "block" : "none";
}

function handleScroll() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;
  if (window.scrollY > 400) btn.classList.add("visible");
  else btn.classList.remove("visible");
}

function handleKeyboard(e) {
  if (document.getElementById("cookingMode").classList.contains("active")) {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      nextCookingStep();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevCookingStep();
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      toggleMarkDone();
    } else if (e.key === "Escape") {
      exitCookingMode();
    }
    return;
  }
  if (e.key === "Escape") {
    if (document.getElementById("timerModal").classList.contains("active"))
      closeTimer();
    else if (document.getElementById("recipeModal").style.display === "flex")
      closeRecipe();
    else if (
      document.getElementById("fullImageModal").classList.contains("active")
    )
      closeFullImage();
  }
}

function initLogoAnimation() {
  const brandJp = document.getElementById("brandJp");
  if (!brandJp) return;
  const text = brandJp.textContent;
  brandJp.innerHTML = "";
  const chars = text.split("");
  chars.forEach((char, i) => {
    const span = document.createElement("span");
    span.textContent = char;
    span.style.display = "inline-block";
    span.style.opacity = "0";
    span.style.transform = "translateY(20px)";
    brandJp.appendChild(span);
  });

  anime({
    targets: "#brandJp span",
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 800,
    delay: anime.stagger(100),
    easing: "easeOutQuad",
    direction: "alternate",
    loop: true,
    endDelay: 1500,
  });
}
function createSpiceParticles() {
  const container = document.getElementById("spice-container");
  if (!container) return;
  const spices = ["🌶️", "🌿", "🍃", "🧄", "🧅", "⭐", "🌸", "🫚"];
  for (let i = 0; i < 15; i++) {
    const p = document.createElement("div");
    p.className = "spice-particle";
    p.textContent = spices[Math.floor(Math.random() * spices.length)];
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDelay = Math.random() * 15 + "s";
    p.style.animationDuration = 12 + Math.random() * 8 + "s";
    container.appendChild(p);
  }
}

function initPlates() {
  const wrapper = document.getElementById("plateWrapper");
  if (!wrapper) return;
  mealTypes.forEach((meal, index) => {
    const plate = document.createElement("div");
    plate.className = "plate";
    plate.dataset.id = meal.id;
    plate.innerHTML = `<div class="plate-icon">${meal.icon}</div><div class="plate-label">${meal.label}</div><div class="plate-label-jp">${meal.labelJp}</div>`;
    plate.onclick = () => selectPlate(meal.id, plate);
    wrapper.appendChild(plate);
  });
  setTimeout(() => arrangePlatesInCircle(), 150);
}

function arrangePlatesInCircle() {
  const plates = document.querySelectorAll(".plate");
  const wrapper = document.getElementById("plateWrapper");
  if (!wrapper) return;

  const wrapperWidth = wrapper.offsetWidth;
  const wrapperHeight = wrapper.offsetHeight;
  const centerX = wrapperWidth / 2;
  const centerY = wrapperHeight / 2;

  // responsive radius: 40% of the smaller dimension
  // this keeps plates inside the wrapper, always
  const radius = Math.min(wrapperWidth, wrapperHeight) * 0.4;

  // if mobile, use a smaller plate size too
  const isMobile = window.innerWidth <= 768;
  const plateSize = isMobile ? 70 : 120;

  plates.forEach((plate, index) => {
    const angle = (index / plates.length) * 360;
    const rad = (angle * Math.PI) / 180;
    const x = centerX + Math.cos(rad) * radius;
    const y = centerY + Math.sin(rad) * radius;
    plate.style.left = x + "px";
    plate.style.top = y + "px";
    plate.style.transform = "translate(-50%,-50%)";
  });
}

function selectPlate(category, plateElement) {
  currentCategory = category;
  plateSelected = true;
  const plates = document.querySelectorAll(".plate");
  const wrapper = document.getElementById("plateWrapper");
  if (!wrapper) return;
  const wrapperWidth = wrapper.offsetWidth;
  const wrapperHeight = wrapper.offsetHeight;
  const centerX = wrapperWidth / 2;
  const centerY = wrapperHeight / 2;
  plates.forEach((p, index) => {
    if (p === plateElement) {
      p.classList.add("active");
      p.classList.remove("orbiting", "spinning");
      p.style.left = centerX + "px";
      p.style.top = centerY + "px";
      p.style.transform = "translate(-50%,-50%)";
    } else {
      p.classList.remove("active", "spinning");
      p.classList.add("orbiting");
      const angle = (index / plates.length) * 360;
      const rad = (angle * Math.PI) / 180;
      const orbitRadius = 230;
      const x = centerX + Math.cos(rad) * orbitRadius;
      const y = centerY + Math.sin(rad) * orbitRadius;
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.transform = "translate(-50%,-50%)";
    }
  });
  setTimeout(() => {
    document.getElementById("spin-btn").classList.add("visible");
    document.getElementById("quickSpinContainer").style.opacity = "1";
  }, 800);
  filterRecipesByCategory(category);
}

function spinWheel() {
  const wrapper = document.getElementById("plateWrapper");
  if (!wrapper) return;
  const wrapperWidth = wrapper.offsetWidth;
  const wrapperHeight = wrapper.offsetHeight;
  const centerX = wrapperWidth / 2;
  const centerY = wrapperHeight / 2;
  const plates = document.querySelectorAll(".plate");
  if (!plateSelected) {
    if (allRecipes.length === 0) {
      showToast("Loading recipes... Please wait!", "error");
      return;
    }
    plates.forEach((p) => {
      p.classList.remove("orbiting");
      p.classList.add("active", "spinning");
      p.style.left = centerX + "px";
      p.style.top = centerY + "px";
      p.style.transform = "translate(-50%,-50%)";
    });
    setTimeout(() => {
      plates.forEach((p) => {
        p.classList.remove("spinning", "active");
      });
      const randomRecipe =
        allRecipes[Math.floor(Math.random() * allRecipes.length)];
      showRecipe(randomRecipe);
      setTimeout(() => {
        plates.forEach((p) => p.classList.remove("active"));
        arrangePlatesInCircle();
      }, 500);
    }, 2500);
    return;
  }
  if (currentRecipes.length === 0) {
    showToast("No recipes found for this category", "error");
    return;
  }
  const btn = document.getElementById("spin-btn");
  btn.classList.add("spinning");
  btn.style.pointerEvents = "none";
  const activePlate = document.querySelector(".plate.active");
  if (activePlate) {
    activePlate.style.left = centerX + "px";
    activePlate.style.top = centerY + "px";
    activePlate.style.transform = "translate(-50%,-50%)";
    activePlate.classList.add("spinning");
  }
  setTimeout(() => {
    const randomRecipe =
      currentRecipes[Math.floor(Math.random() * currentRecipes.length)];
    showRecipe(randomRecipe);
    btn.classList.remove("spinning");
    btn.style.pointerEvents = "all";
    if (activePlate) activePlate.classList.remove("spinning");
  }, 3000);
}

window.addEventListener("resize", () => {
  if (!plateSelected) setTimeout(() => arrangePlatesInCircle(), 150);
});
const recipeModalEl = document.getElementById("recipeModal");
if (recipeModalEl) {
  recipeModalEl.addEventListener("click", (e) => {
    if (e.target.id === "recipeModal") closeRecipe();
  });
}

function initInteractiveSplash() {
  const decorationsContainer = document.getElementById("splashDecorations");
  if (!decorationsContainer) return;
  const lanternPositions = [
    { left: "15%", top: "10%" },
    { left: "75%", top: "15%" },
    { left: "25%", top: "40%" },
    { left: "70%", top: "35%" },
    { left: "85%", top: "50%" },
  ];
  lanternPositions.forEach((pos, index) => {
    const lantern = document.createElement("div");
    lantern.className = "floating-lantern";
    lantern.style.left = pos.left;
    lantern.style.top = pos.top;
    lantern.dataset.index = index;
    lantern.addEventListener("click", (e) => {
      handleLanternClick(e, lantern, index);
    });
    decorationsContainer.appendChild(lantern);
  });
  const enterBtn = document.createElement("button");
  enterBtn.className = "enter-site-btn";
  enterBtn.innerHTML =
    '<span class="btn-icon">🏮</span><span>Enter Site</span>';
  enterBtn.onclick = enterSite;
  const splashEl = document.getElementById("splash");
  if (splashEl) splashEl.appendChild(enterBtn);
  setTimeout(() => {
    enterBtn.classList.add("visible");
  }, 2000);
}

function handleLanternClick(event, lantern, index) {
  if (activeScroll) {
    activeScroll.remove();
    activeScroll = null;
  }

  const quoteData = lanternQuotes[index % lanternQuotes.length];

  const scroll = document.createElement("div");
  scroll.className = "lantern-scroll";

  const watermark = document.createElement("div");
  watermark.className = "scroll-watermark";
  watermark.innerHTML = '<span class="scroll-watermark-text">食</span>';
  scroll.appendChild(watermark);

  const content = document.createElement("div");
  content.className = "scroll-content";
  content.innerHTML = `<div class="scroll-quote">"${quoteData.quote}"</div>`;
  scroll.appendChild(content);

  const seal = document.createElement("div");
  seal.className = "scroll-seal";
  seal.textContent = "食";
  scroll.appendChild(seal);

  const lanternRect = lantern.getBoundingClientRect();
  const splashRect = document.getElementById("splash").getBoundingClientRect();
  scroll.style.left =
    lanternRect.left - splashRect.left + lanternRect.width / 2 - 90 + "px";
  scroll.style.top =
    lanternRect.top - splashRect.top + lanternRect.height - 12 + "px";

  document.getElementById("splash").appendChild(scroll);
  activeScroll = scroll;

  anime({
    targets: lantern,
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
    duration: 800,
    easing: "easeOutElastic(1, .6)",
  });

  requestAnimationFrame(() => {
    scroll.classList.add("unfurling");
    content.classList.add("visible");
    watermark.classList.add("visible");
    seal.classList.add("visible");
  });

  setTimeout(() => {
    if (activeScroll === scroll) {
      anime({
        targets: scroll,
        opacity: 0,
        scaleY: 0,
        duration: 600,
        easing: "easeInQuad",
        complete: () => {
          scroll.remove();
          if (activeScroll === scroll) activeScroll = null;
        },
      });
    }
  }, 6000);
}

function enterSite() {
  const splash = document.getElementById("splash");
  if (activeScroll) {
    activeScroll.remove();
    activeScroll = null;
  }
  if (splash) splash.classList.add("exiting");
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 400;
    gain.gain.value = 0.1;
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(800, 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, 0.3);
    setTimeout(() => osc.stop(), 300);
  } catch (e) {}
  setTimeout(() => {
    if (splash) splash.style.display = "none";
    showMainPage();
  }, 1500);
}

function initSplash() {
  initInteractiveSplash();
  anime
    .timeline({
      easing: "easeOutExpo",
      complete: () => {},
    })
    .add({
      targets: ".splash-seal",
      opacity: [0, 1],
      scale: [0, 1],
      duration: 600,
      easing: "easeOutElastic(1, .6)",
    })
    .add(
      {
        targets: ".floating-lantern",
        opacity: [0, 0.7],
        translateY: [0, -30],
        duration: 800,
        delay: anime.stagger(200),
      },
      "-=500",
    )
    .add(
      {
        targets: ".splash-title-jp",
        opacity: [0, 1],
        translateZ: [-100, 0],
        rotateX: [20, 0],
        scale: [0.8, 1],
        duration: 700,
      },
      "-=800",
    )
    .add(
      {
        targets: ".splash-divider",
        opacity: [0, 1],
        scaleX: [0, 1],
        duration: 600,
      },
      "-=600",
    )
    .add(
      {
        targets: ".splash-title-en",
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 600,
      },
      "-=400",
    )
    .add(
      {
        targets: ".splash-subtitle",
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
      },
      "-=300",
    )
    .add(
      {
        targets: ".splash-tagline",
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 500,
      },
      "-=200",
    );
}

function showUploadPage() {
  document.getElementById("main-container").style.display = "none";
  document.getElementById("browse-page").style.display = "none";
  document.getElementById("community-page").style.display = "none";
  document.getElementById("upload-page").style.display = "block";

  setActiveNavButton("upload");

  anime({
    targets: "#upload-page",
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 800,
    easing: "easeOutQuad",
  });
}

function toggleEnvelope() {
  const envelope = document.getElementById("envelope");
  if (envelope) envelope.classList.toggle("open");
}

function openEnvelope() {
  const envelope = document.getElementById("envelope");
  if (envelope) envelope.classList.add("open");
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    gain.gain.value = 0.05;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, 0.3);
    setTimeout(() => osc.stop(), 300);
  } catch (e) {}
}

function closeEnvelope() {
  const envelope = document.getElementById("envelope");
  if (envelope) envelope.classList.remove("open");
  const form = document.getElementById("recipeForm");
  if (form) form.reset();
}

async function submitRecipe(event) {
  event.preventDefault();
  const submitBtn = document.querySelector(".btn-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML =
      "<span>⏳</span><span>Submitting to Community...</span>";
  }

  try {
    const cuisineSelect = document.getElementById("recipeCuisine");
    const customCuisineInput = document.getElementById("customCuisine");
    const finalCuisine =
      cuisineSelect.value === "Other"
        ? customCuisineInput.value.trim()
        : cuisineSelect.value;
    const recipeData = {
      name: document.getElementById("recipeName").value.trim(),
      cuisine: finalCuisine,
      category: document.getElementById("recipeCategory").value,
      image_url: document.getElementById("uploadRecipeImage").value.trim(),
      prep_time: parseInt(document.getElementById("prepTime").value) || 10,
      cook_time: parseInt(document.getElementById("cookTime").value) || 20,
      servings: parseInt(document.getElementById("servings").value) || 4,
      difficulty: document.getElementById("difficulty").value,
      ingredients: document
        .getElementById("ingredients")
        .value.trim()
        .split("\n")
        .filter((i) => i.trim()),
      instructions: document
        .getElementById("instructions")
        .value.trim()
        .split("\n")
        .filter((i) => i.trim()),
      chef_name:
        document.getElementById("chefName").value.trim() || "Anonymous Chef",
      chef_tip: document.getElementById("chefTip").value.trim() || "",
    };
    if (recipeData.ingredients.length === 0) {
      throw new Error("Please add at least one ingredient");
    }
    if (recipeData.instructions.length === 0) {
      throw new Error("Please add at least one instruction step");
    }
    const { data, error } = await supabaseClient
      .from("community_recipes")
      .insert([recipeData])
      .select();
    if (error) {
      console.error("Supabase error:", error);
      throw new Error(error.message);
    }
    showToast("🎉 Recipe submitted successfully!", "success");
    setTimeout(() => {
      closeEnvelope();
      document.getElementById("recipeForm").reset();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>📮</span><span>Submit Recipe</span>";
      }
    }, 1500);
  } catch (error) {
    console.error("Error submitting recipe:", error);
    showToast(" " + error.message, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "<span>📮</span><span>Submit Recipe</span>";
    }
  }
}

function previewUploadImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const preview = document.getElementById("imagePreview");
      const container = document.getElementById("imagePreviewContainer");
      preview.src = e.target.result;
      container.style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function showCommunityPage() {
  document.getElementById("main-container").style.display = "none";
  document.getElementById("browse-page").style.display = "none";
  document.getElementById("upload-page").style.display = "none";
  document.getElementById("community-page").style.display = "block";
  setActiveNavButton("community");
  loadCommunityRecipes();
  anime({
    targets: "#community-page",
    opacity: [0, 1],
    translateY: [30, 0],
    duration: 800,
    easing: "easeOutQuad",
  });
}

function cleanImageUrl(url) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500";
  }
  let cleanedUrl = url.trim();
  if (cleanedUrl.includes("phototourl.com")) {
    if (!cleanedUrl.startsWith("http")) {
      cleanedUrl = "https://" + cleanedUrl;
    }
  }
  return cleanedUrl;
}
const recipeForm = document.getElementById("recipe-form");
if (recipeForm) {
  recipeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawUrl = document.getElementById("uploadRecipeImage").value;
    const sanitizedUrl = cleanImageUrl(rawUrl);
    try {
      const recipeData = {
        name: document.getElementById("recipe-name-input").value,
        cuisine: document.getElementById("cuisine-select").value,
        category: document.getElementById("category-select").value,
        image_url: sanitizedUrl,
        prep_time: parseInt(document.getElementById("prep-time").value) || 0,
        cook_time: parseInt(document.getElementById("cook-time").value) || 0,
        servings:
          parseInt(document.getElementById("servings-input").value) || 1,
        difficulty: document.getElementById("difficulty-select").value,
        ingredients: document.getElementById("ingredients-textarea").value,
      };
      const { data, error } = await supabaseClient
        .from("community_recipes")
        .insert([recipeData]);
      if (error) throw error;
      alert("Recipe shared successfully, bestie! 🎉");
      recipeForm.reset();
      if (typeof loadCommunityRecipes === "function") {
        loadCommunityRecipes();
      }
    } catch (error) {
      console.error("Failed to sync to database:", error);
      alert("Oh no! Could not upload your recipe info: " + error.message);
    }
  });
}

async function loadCommunityRecipes() {
  const grid = document.getElementById("community-grid");
  if (!grid) return;
  grid.innerHTML =
    '<div class="empty-state"><h3>Loading community recipes...</h3></div>';
  try {
    const { data: recipes, error } = await supabaseClient
      .from("community_recipes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!recipes || recipes.length === 0) {
      grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <h3>No community recipes yet</h3>
                    <p>Be the first to share your culinary creation!</p>
                </div>`;
      return;
    }
    grid.innerHTML = recipes
      .map((recipe) => {
        const cuisineObj =
          typeof cuisines !== "undefined" && Array.isArray(cuisines)
            ? cuisines.find((c) => c.label === recipe.cuisine) || cuisines[0]
            : { flag: "🍳", label: recipe.cuisine };
        const totalMin = (recipe.prep_time || 10) + (recipe.cook_time || 20);

        const workingCardImage = cleanImageUrl(recipe.image_url);
        return `
            <div class="dish-card" onclick='openCommunityRecipe(${JSON.stringify(recipe).replace(/'/g, "&#39;")})'>
                <div class="washi-tape"></div>
                <div class="dish-difficulty">
                    <span class="difficulty-badge difficulty-${recipe.difficulty || "medium"}">${recipe.difficulty || "medium"}</span>
                    <span style="font-size:0.75rem; margin-left:5px; color:var(--imperial-red); font-weight:700; background:rgba(255,255,255,0.9); padding:2px 8px; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">👤Community</span>
                </div>
                <div class="dish-image-wrapper">
                    <img src="${recipe.image_url}" alt="${recipe.name}" class="dish-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                      <div class="dish-stamp-fallback" style="display:none; position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(135deg, #C41E3A 0%, #D4AF37 100%); align-items:center; justify-content:center; border-radius:13px 13px 0 0;">
                          <span style="font-family:'Noto Serif SC',serif; font-size:4rem; color:white; font-weight:bold; text-shadow:2px 2px 4px rgba(0,0,0,0.3);">食</span>
                      </div>
                    <div class="postcard-stamp">
                        <span class="stamp-en-top">COMMUNITY</span>
                        <span class="stamp-jp-char">食</span>
                    </div>
                </div>
                <div class="dish-info">
                    <h3 class="dish-name">${recipe.name}</h3>
                    <div class="dish-meta">
                        <div class="dish-cuisine">
                            <span>${cuisineObj.flag || ""}</span>
                            <span>${recipe.cuisine || ""}</span>
                        </div>
                        <span class="dish-category">⏱️ ${totalMin} min</span>
                    </div>
                    ${recipe.chef_name ? `<div style="font-size:0.8rem; color:var(--charcoal); margin-top:5px;">👨‍🍳 by ${recipe.chef_name}</div>` : ""}
                </div>
            </div>`;
      })
      .join("");
    const cards = document.querySelectorAll("#community-grid .dish-card");
    if (cards.length > 0 && typeof anime !== "undefined") {
      anime({
        targets: cards,
        opacity: [0, 1],
        translateY: [20, 0],
        delay: anime.stagger(100),
        duration: 800,
        easing: "easeOutQuad",
      });
    }
  } catch (error) {
    console.error("Error loading community recipes:", error);
    grid.innerHTML =
      '<div class="empty-state"><h3>Error loading recipes</h3><p>Please try again later.</p></div>';
  }
}

function openCommunityRecipe(recipe) {
  console.log("Opening community recipe:", recipe.name);
  const workingModalImage = cleanImageUrl(recipe.image_url);
  const mappedRecipe = {
    idMeal: recipe.id,
    strMeal: recipe.name,
    strMealThumb: workingModalImage,
    strArea: recipe.cuisine,
    strCategory: recipe.category,
    difficulty: recipe.difficulty,
    prepTime: recipe.prep_time,
    cookTime: recipe.cook_time,
    servings: recipe.servings,
    chefTip: recipe.chef_tip
      ? `${recipe.chef_tip} — ${recipe.chef_name}`
      : `Shared by ${recipe.chef_name || "Community Chef"}`,
    strInstructions: Array.isArray(recipe.instructions)
      ? recipe.instructions.join("\n")
      : recipe.instructions,
    ...convertCommunityIngredients(recipe.ingredients),
  };
  console.log("Mapped recipe for showRecipe:", mappedRecipe);
  if (typeof showRecipe === "function") {
    showRecipe(mappedRecipe);
  }
}

function convertCommunityIngredients(ingredients) {
  const result = {};
  if (Array.isArray(ingredients)) {
    ingredients.forEach((ing, idx) => {
      if (typeof ing === "string") {
        result[`strIngredient${idx + 1}`] = ing;
        result[`strMeasure${idx + 1}`] = "";
      } else {
        result[`strIngredient${idx + 1}`] = ing.name || "";
        result[`strMeasure${idx + 1}`] = ing.measure || "";
      }
    });
  }
  return result;
}

function toggleDisclaimer() {
  const modal = document.getElementById("disclaimerModal");
  modal.classList.toggle("active");
}

function toggleNav() {
  const navLinks = document.getElementById("navLinks");
  const navToggle = document.getElementById("navToggle");
  navLinks.classList.toggle("open");
  navToggle.classList.toggle("active");
}

// close nav when a nav button is clicked (mobile)
document.addEventListener("click", (e) => {
  if (e.target.closest(".nav-btn")) {
    document.getElementById("navLinks")?.classList.remove("open");
    document.getElementById("navToggle")?.classList.remove("active");
  }
});

// ===== click outside to close =====

// close mobile nav when tapping outside
document.addEventListener("click", (e) => {
  const navLinks = document.getElementById("navLinks");
  const navToggle = document.getElementById("navToggle");

  if (!navLinks || !navLinks.classList.contains("open")) return;

  // if the click is inside the nav or on the toggle, let it through
  if (e.target.closest("#navLinks") || e.target.closest("#navToggle")) return;

  // otherwise close it
  navLinks.classList.remove("open");
  navToggle?.classList.remove("active");
});

// close recipe modal when tapping the backdrop (outside the book)
document.addEventListener("click", (e) => {
  const modal = document.getElementById("recipeModal");
  if (modal && e.target === modal) {
    closeRecipe();
  }
});

// close timer modal when tapping the backdrop
document.addEventListener("click", (e) => {
  const modal = document.getElementById("timerModal");
  if (modal && e.target === modal) {
    closeTimer();
  }
});
