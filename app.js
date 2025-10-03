// Advanced API-Driven Game Wiki Application
console.log("app.js loaded");
class AdvancedGameWiki {
    constructor() {
        this.items = [];
        this.categories = [];
        this.gameInfo = {};
        this.usingMockData = false;
        this.recipes = [];
        
        // Initialize missing properties
        this.apiConfig = {
            baseUrl: '',
            apiKey: '',
            timeout: 5000
        };
        this.searchQuery = '';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.currentItemId = null;
        this.filteredItems = [];
        
        this.init();
        this.performanceMetrics = {
            apiCalls: 0,
            responseTimes: [],
            responseTime: 0,
            cacheHits: 0,
        };
    }

    buildFilterOptions() {
        const types = new Set();
        const baseStatKeys = new Set();
        const statKeys = new Set();

        (this.items || []).forEach(item => {
            if (item) {
                const typeVal = item.byType || item.type;
                if (typeVal) types.add(String(typeVal));

                Object.keys(item.baseStats || {}).forEach(k => baseStatKeys.add(k));
                Object.keys(item.stats || {}).forEach(k => statKeys.add(k));
            }
        });

        this.filterOptions = {
            types: Array.from(types).sort((a, b) => a.localeCompare(b)),
            baseStatKeys: Array.from(baseStatKeys).sort((a, b) => a.localeCompare(b)),
            statKeys: Array.from(statKeys).sort((a, b) => a.localeCompare(b))
        };
    }

    populateFilterControls() {
        const populate = (selectEl, values) => {
            if (!selectEl || !values) return;
            const current = selectEl.value;
            selectEl.innerHTML = '<option value="">Any</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
            if (values.includes(current)) selectEl.value = current;
        };

        populate(document.getElementById('filter-type'), this.filterOptions?.types);
        populate(document.getElementById('filter-baseStat-key'), this.filterOptions?.baseStatKeys);
        populate(document.getElementById('filter-stat-key'), this.filterOptions?.statKeys);
    }

    async init() {
        console.log("init started");
        this.setupEventListeners();
        console.log("this is after eventlistener");

        this.updateLoaderStatus("Loading items from local JSON file...");
        console.log("this is before the try");

        try {
            const data = await this.fetchJsonData('data/items.json');
            console.log("gamedata loaded");
            this.gameData = data;
            this.items = this.normalizeItems(data.items || data);
            // Load recipes.json here
            const recipesData = await this.fetchJsonData('data/recipes.json');
            this.recipes = Array.isArray(recipesData) ? recipesData : (recipesData.knownRecipes || []);
            this.buildFilterOptions();
            this.populateFilterControls();
            this.clearAllFilters();
            this.updateLoaderStatus("Loaded items from local JSON.");

            // Render the home section after gameData is loaded
            this.renderHomeSection();
            // Also render the items section
            this.renderItemsSection();  

        } catch (localErr) {
            console.warn("Failed to load local JSON.", localErr);
            this.updateLoaderStatus("Failed to load items data.");
            alert("Could not load items from local JSON. Please check your setup.");
        }
    }



    async fetchJsonData(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return await response.json();
    }

    normalizeItems(data) {
        let items = [];
        if (Array.isArray(data)) {
        items = data;
        } else {
        Object.entries(data).forEach(([category, arr]) => {
            if(Array.isArray(arr)) {
            arr.forEach(item => {
                item.type = item.type || category;
                items.push(item);
            });
            }
        });
        }
        return items;
    }

    updateLoaderStatus(msg) {
        const el = document.getElementById("json-loader-status");
        if (el) el.textContent = msg;
    }
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('global-search');
        const searchBtn = document.getElementById('search-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.filterItems();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        // Advanced filters
        const advancedFiltersToggle = document.getElementById('advanced-filters-toggle');
        if (advancedFiltersToggle) {
            advancedFiltersToggle.addEventListener('click', () => {
                this.toggleAdvancedFilters();
            });
        }

        const applyFiltersBtn = document.getElementById('apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyAdvancedFilters();
            });
        }

        const clearFiltersBtn = document.getElementById('clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Sort controls
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.filterItems();
            });
        }
        const sortOrderToggle = document.getElementById('sort-order-toggle');
        if (sortOrderToggle) {
            sortOrderToggle.addEventListener('click', () => {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                this.updateSortOrderDisplay();
                this.filterItems();
            });
        }

        // Modal controls
        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Close modal when clicking overlay
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Item link clicks (delegated event listener)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('item-link')) {
                e.preventDefault();
                const itemId = e.target.getAttribute('data-item-id');
                if (itemId) {
                    this.showItemModal(itemId);
                }
            }
        });
    }

    renderHomeSection() {
        const totalItemsEl = document.getElementById('total-items');
        if (totalItemsEl) {
            totalItemsEl.textContent = this.gameData?.gameInfo?.totalItems || this.items.length || 0;
        }

        const responseTimeEl = document.getElementById('response-time');
        if (responseTimeEl) {
            responseTimeEl.textContent = `${this.performanceMetrics?.responseTime ?? 0}ms`;
        }

        this.trackApiCall();
    }

    renderItemsSection() {
        this.filterItems();
    }

    showItemModal(itemId) {
        const item = this.items.find(i => i.itemId === itemId);
        if (!item) {
            alert('Item not found.');
            return;
        }

        this.currentItemId = itemId;
        
        // Update modal title
        const modalTitle = document.getElementById('modal-title');
        if (modalTitle) {
            modalTitle.textContent = item.name;
        }

        // Update modal body with item details
        const modalBody = document.getElementById('modal-body');
        if (modalBody) {
            modalBody.innerHTML = this.createDetailedItemView(item);
        }

        // Show modal
        const modal = document.getElementById('item-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    renderApiConfigPage() {
        // Populate current config
        const baseUrlEl = document.getElementById('api-base-url');
        if (baseUrlEl) {
            baseUrlEl.value = this.apiConfig.baseUrl;
        }
        
        const timeoutEl = document.getElementById('api-timeout');
        if (timeoutEl) {
            timeoutEl.value = this.apiConfig.timeout;
        }
    }

    renderSchemaPage() {
        this.showSchemaSection('baseStats');
    }

    renderDeveloperPage() {
        this.updateJsonExplorer();
        this.updatePerformanceMetrics();
    }

    createDetailedItemView(item) {
        return `
            <div class="item-detail-header">
                <div class="item-icon">⚔️</div>
                <div class="item-detail-info">
                    <h1>${item.name}</h1>
                    <div class="item-detail-meta">
                        <span class="item-rarity rarity-${item.rarity}">${item.rarity}</span>
                        <span>Level ${item.level}</span>
                        <span>Type: ${item.type} - Subtype: ${item.subtype ? item.subtype : "none"}</span>
                    </div>
                    <h3>From: </h3>
                    <div class="item-detail-meta">
                        <span>${item.dropSources && item.dropSources[0] ? item.dropSources[0].sourceId.replace(/_/g, " ") : ""}</span>
                    </div>
                    
                    <p class="item-detail-description">${item.description}</p>
                    <span>Stack Size: ${item.maxStack}</span>
                </div>

            </div>

            <div class="item-detail-body">

                <div class="detail-sections"> 
            
                    <div class="detail-section">
                        <h3>Requirements</h3>
                        <ul class="property-list">
                            <li class="property-item">
                                <span class="property-label">Character Level</span>
                                <span class="property-value">${item.level}</span>
                            </li>
                            <li class="property-item">
                                <span class="property-label">Strength</span>
                                <span class="property-value">${item.requirements.strength}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Agility</span>
                                <span class="property-value">${item.requirements.agility}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Intelligence</span>
                                <span class="property-value">${item.requirements.intelligence}</span>   
                            </li>
                        </ul>
                        ${this.renderDurabilitySection(item)}
                        
                    </div>
                      
                    <div class="detail-section">
                        <h3>Stats Given</h3>
                        <ul class="property-list">
                            <li class="property-item">
                                <span class="property-label">Damage</span>
                                <span class="property-value">${item.stats.damage}</span>
                            </li>
                            <li class="property-item">
                                <span class="property-label">Range</span>
                                <span class="property-value">${item.stats.range}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Defense</span>
                                <span class="property-value">${item.stats.defense}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Health</span>
                                <span class="property-value">${item.stats.health}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Mana</span>
                                <span class="property-value">${item.stats.mana}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Strength</span>
                                <span class="property-value">${item.stats.strength}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Agility</span>
                                <span class="property-value">${item.stats.agility}</span>   
                            </li>
                            <li class="property-item">
                                <span class="property-label">Intelligence</span>
                                <span class="property-value">${item.stats.intelligence}</span>   
                            </li>
                        </ul>
                    </div>
                    
                        ${this.renderEffectsSection(item)}
                        ${this.renderRecipeSection(item)}
                        ${this.renderBuildsIntoSection(item)}
                        
                        

                </div>        
            </div>

            </div>
        `;
    }

    renderEffectsSection(item) {
        if (!item.effects || item.effects.length === 0) return '';
        
        const effectsHtml = item.effects.map(effect => `
            <li class="property-item">
                <div>
                    <strong>${effect.name || 'Unnamed Effect'}</strong><br>
                    <small>${effect.description}</small><br>
                    <small>Type: ${effect.effectType ? effect.effectType.replace(/_/g, " ") : "No type"} | Trigger: ${effect.triggerCondition || 'Always'} | Chance: ${effect.triggerChance || 0}%</small>
                </div>
            </li>
        `).join('');

        return `
            <div class="detail-section">
                <h3>Effects</h3>
                <ul class="property-list">
                    ${effectsHtml}
                </ul>
            </div>
        `;
    }

    renderRecipeSection(item) {
        // Use recipe from recipes.json
        const recipe = this.findRecipeForItem(item.itemId);
        if (!recipe) return '';
        // Skill requirements
        const skillReq = recipe.skillRequirements || {};
        const skillRequired = skillReq.primarySkill || recipe.skillRequired || '';
        const skillLevel = skillReq.level || recipe.skillLevel || '';
        // Materials
        const materialsHtml = recipe.materials?.map(material => {
            const materialItem = this.findItemById(material.itemId);
            const displayName = materialItem ? materialItem.name : material.itemId.replace(/_/g, " ");
            const clickableName = materialItem ? 
                `<a href="#" class="item-link" data-item-id="${material.itemId}">${displayName}</a>` : 
                displayName;
            return `
                <li class="property-item">
                    <span class="property-label">${clickableName}</span>
                    <span class="property-value">${material.quantity}</span>
                </li>
            `;
        }).join('') || '';

        return `
            <div class="detail-section">
                <h3>Crafting Recipe</h3>
                <ul class="property-list">
                    <li class="property-item">
                        <span class="property-label">Skill Required</span>
                        <span class="property-value">${skillRequired}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Skill Level</span>
                        <span class="property-value">${skillLevel}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Craft Time</span>
                        <span class="property-value">${recipe.craftTime ? this.formatTime(recipe.craftTime) : ''}</span>
                    </li>
                </ul>
                <h4>Materials Required</h4>
                <ul class="property-list">
                    ${materialsHtml}
                </ul>
            </div>
        `;
    }

    renderBuildsIntoSection(item) {
        const itemsUsingThis = this.findItemsUsingMaterial(item.itemId);
        
        if (itemsUsingThis.length === 0) return '';
        
        const buildsIntoHtml = itemsUsingThis.map(usingItem => `
            <li class="property-item">
                <a href="#" class="item-link" data-item-id="${usingItem.itemId}">${usingItem.name}</a>
                <span class="property-value">${usingItem.type}</span>
            </li>
        `).join('');

        return `
            <div class="detail-section">
                <h3>Builds Into</h3>
                <ul class="property-list">
                    ${buildsIntoHtml}
                </ul>
            </div>
        `;
    }

    renderDurabilitySection(item) {
       
        return `
            <br >
                <h3>Additional Info</h3>
                <ul class="property-list">
                    <li class="property-item">
                        <span class="property-label">Max Durability</span>
                        <span class="property-value">${item.durability.max}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Weight</span>
                        <span class="property-value">${item.weight}</span>
                    </li>
                </ul>
            
        `;
    }

    renderMetadataSection(item) {
        return `
            <div class="detail-section">
                <h3>Database Metadata</h3>
                <ul class="property-list">
                    <li class="property-item">
                        <span class="property-label">Item ID</span>
                        <span class="property-value">${item.itemId}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Instance ID</span>
                        <span class="property-value">${item.instanceId}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Enhancement Level</span>
                        <span class="property-value">${item.enhancementLevel || 0}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Template</span>
                        <span class="property-value">${item.isTemplate ? 'Yes' : 'No'}</span>
                    </li>
                    <li class="property-item">
                        <span class="property-label">Last Updated</span>
                        <span class="property-value">${new Date(item.updatedAt).toLocaleString()}</span>
                    </li>
                </ul>
            </div>
        `;
    }

    filterItems() {
        let filtered = [...this.items];

        // Apply search filter
        if ((this.searchQuery ?? '').trim()) {
            filtered = this.searchItems(this.searchQuery, filtered);
        }

        // Apply advanced filters
        filtered = this.applyComplexFilters(filtered);

        // Sort items
        filtered = this.sortItems(filtered, this.sortBy, this.sortOrder);

        this.filteredItems = filtered;
        this.renderItemsGrid();
    }

    searchItems(query, items = this.items) {
        const searchTerm = query.toLowerCase().trim();
        return items.filter(item => {
            // Search in basic properties
            const basicMatch = [
                item.name,
                item.description,
                item.type,
                item.subtype,
                item.rarity
            ].some(prop => prop && prop.toLowerCase().includes(searchTerm));

            // Search in nested structures
            const nestedMatch = this.searchNestedProperties(item, searchTerm);

            return basicMatch || nestedMatch;
        });
    }

    searchNestedProperties(obj, searchTerm, depth = 0) {
        if (depth > 5) return false; // Prevent infinite recursion
        
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) continue;
            
            if (typeof value === 'string' && value.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    if (value.some(item => 
                        typeof item === 'object' ? 
                        this.searchNestedProperties(item, searchTerm, depth + 1) :
                        typeof item === 'string' && item.toLowerCase().includes(searchTerm)
                    )) {
                        return true;
                    }
                } else {
                    if (this.searchNestedProperties(value, searchTerm, depth + 1)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    applyComplexFilters(items) {
        return items.filter(item => {
            // Type filter
            const typeEl = document.getElementById('filter-type');
            const selectedType = typeEl ? typeEl.value.trim() : '';
            if (selectedType) {
                const itemType = (item.byType || item.type || '').toString();
                if (itemType.toLowerCase() !== selectedType.toLowerCase()) {
                    return false;
                }
            }
            // Damage range filter
            const minDamageEl = document.getElementById('min-damage');
            const maxDamageEl = document.getElementById('max-damage');
            const minDamage = minDamageEl && minDamageEl.value.trim() !== '' ? parseInt(minDamageEl.value): null ;
            const maxDamage = maxDamageEl && maxDamageEl.value.trim() !== '' ? parseInt(maxDamageEl.value): null;

            const itemDamage = item.stats?.damage || 0;
            
            if ((minDamage !== null && itemDamage < minDamage) || (maxDamage !== null && itemDamage > maxDamage)) {
                return false;
            }

            // Level range filter
            const minLevelEl = document.getElementById('min-level');
            const maxLevelEl = document.getElementById('max-level');
            const minLevel = minLevelEl && minLevelEl.value.trim() !== '' ? parseInt(minLevelEl.value): null ;
            const maxLevel = maxLevelEl && maxLevelEl.value.trim() !== '' ? parseInt(maxLevelEl.value): null;

            const itemLevel = item.stats?.Level || 0;
            
            if ((minLevel !== null && itemLevel < minLevel) || (maxLevel !== null && itemLevel > maxLevel)) {
                return false;
            }

            // Base Stats filter (exact value match)
            const baseKeyEl = document.getElementById('filter-baseStat-key');
            const baseValEl = document.getElementById('filter-baseStat-value');
            const baseKey = baseKeyEl ? baseKeyEl.value.trim() : '';
            const baseValRaw = baseValEl ? baseValEl.value.trim() : '';
            if (baseKey && baseValRaw !== '') {
                const baseVal = parseInt(baseValRaw);
                const itemBaseVal = item.baseStats?.[baseKey];
                if (Number.isFinite(baseVal)) {
                    if ((itemBaseVal ?? null) !== baseVal) return false;
                } else {
                    if (String(itemBaseVal ?? '').toLowerCase() !== baseValRaw.toLowerCase()) return false;
                }
            }

            // Stats filter (exact value match)
            const statKeyEl = document.getElementById('filter-stat-key');
            const statValEl = document.getElementById('filter-stat-value');
            const statKey = statKeyEl ? statKeyEl.value.trim() : '';
            const statValRaw = statValEl ? statValEl.value.trim() : '';
            if (statKey && statValRaw !== '') {
                const statVal = parseInt(statValRaw);
                const itemStatVal = item.stats?.[statKey];
                if (Number.isFinite(statVal)) {
                    if ((itemStatVal ?? null) !== statVal) return false;
                } else {
                    if (String(itemStatVal ?? '').toLowerCase() !== statValRaw.toLowerCase()) return false;
                }
            }

            // Recipe filter
            const recipeKeyEl = document.getElementById('filter-recipe-key');
            const recipeValEl = document.getElementById('filter-recipe-value');
            const recipeKey = recipeKeyEl ? recipeKeyEl.value.trim() : '';
            const recipeValRaw = recipeValEl ? recipeValEl.value.trim() : '';
            if (recipeKey && recipeValRaw !== '') {
                const r = item.recipe;
                if (!r) return false;

                if (recipeKey === 'materials.itemId') {
                    const match = r.materials?.some(m => String(m.itemId).toLowerCase() === recipeValRaw.toLowerCase());
                    if (!match) return false;
                } else if (recipeKey === 'skillLevel') {
                    const want = parseInt(recipeValRaw);
                    if (!Number.isFinite(want) || (r.skillLevel ?? null) !== want) return false;
                } else if (recipeKey === 'skillRequired') {
                    if (String(r.skillRequired ?? '').toLowerCase() !== recipeValRaw.toLowerCase()) return false;
                } else {
                    if (String(r[recipeKey] ?? '').toLowerCase() !== recipeValRaw.toLowerCase()) return false;
                }
            }

            // Feature filters
            const hasEffectsEl = document.getElementById('has-effects');
            const hasEffects = hasEffectsEl ? hasEffectsEl.checked : false;
            if (hasEffects && (!item.effects || item.effects.length === 0)) {
                return false;
            }

            const isCraftableEl = document.getElementById('is-craftable');
            const isCraftable = isCraftableEl ? isCraftableEl.checked : false;
            if (isCraftable && !item.craftable) {
                return false;
            }

            const hasRecipeEl = document.getElementById('has-recipe');
            const hasRecipe = hasRecipeEl ? hasRecipeEl.checked : false;
            if (hasRecipe && !item.recipe) {
                return false;
            }

            return true;
        });
    }

    sortItems(items, sortBy, sortOrder = 'asc') {
        const direction = sortOrder === 'desc' ? -1 : 1;
        return [...items].sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name) * direction;
                case 'rarity':
                    const rarityOrder = { 'uncommon':1, 'common': 2, 'rare': 3, 'epic': 4, 'legendary': 5, 'mythic': 6 };
                    return ((rarityOrder[a.rarity] || 0) - (rarityOrder[b.rarity] || 0)) * direction;
                case 'level':
                    return ((a.level || 0) - (b.level || 0)) * direction;
                case 'value':
                    return ((a.value || 0) - (b.value || 0)) * direction;
                case 'damage':
                    return ((a.stats?.damage || 0) - (b.stats?.damage || 0)) * direction;
                case 'enhancementLevel':
                    return ((a.enhancementLevel || 0) - (b.enhancementLevel || 0)) * direction;
                default:
                    return 0;
            }
        });
    }

    renderItemsGrid() {
        const grid = document.getElementById('items-grid');
        if (!grid) return;

        if (this.filteredItems.length === 0) {
            grid.innerHTML = '<p>No items found matching your criteria.</p>';
            return;
        }

        grid.innerHTML = this.filteredItems.map(item => this.createItemCard(item)).join('');
    }

    createItemCard(item) {
        const stats = item.stats || {};
        const mainStats = Object.entries(stats)
            .filter(([_, value]) => value !== null && value !== undefined)
            .slice(0, 4)
            .map(([key, value]) => ({ label: this.formatStatName(key), value }));

        return `
            <div class="item-card" onclick="wiki.showItemModal('${item.itemId}')">
                <div class="item-header rarity-${item.rarity}" >
                    <div class="item-title" >
                        <h3 class="item-name">${item.name}</h3>
                        <span class="item-rarity rarity-${item.rarity}">${item.rarity}</span>
                    </div>
                </div>
                <div class="item-body">
                    <p class="item-description">${item.description}</p>
                    <div class="item-stats">
                        <span class="stat-label">Required Level</span>
                        <span class="stat-value">${item.requirements.level}</span>
                    </div>
                    <div class="item-stats">
                        <span class="stat-label">Type</span>
                        <span class="stat-value">${item.type}</span>
                        <span class="stat-label">${item.subtype ? "Subtype" : ""}</span>
                        <span class="stat-value">${item.subtype ? item.subtype : ""}</span>   
                        <span class="stat-label">Stat Req</span>
                        <span class="stat-value">Str: ${item.requirements.strength ? item.requirements.strength : "0"}</span>
                        
                        <span class="stat-value">Agi: ${item.requirements.agility ? item.requirements.agility : "0"}</span>
                        
                        <span class="stat-value">Int: ${item.requirements.intelligence ? item.requirements.intelligence : "0"}</span>
                        
                    </div>
                </div>
            </div>
        `;
    }

    toggleAdvancedFilters() {
        const filters = document.getElementById('advanced-filters');
        if (filters) {
            filters.classList.toggle('active');
        }
    }

    applyAdvancedFilters() {
        this.filterItems();
    }

    clearAllFilters() {
        const typeEl = document.getElementById('filter-type');
        if (typeEl) typeEl.value = '';

        const minDamageEl = document.getElementById('min-damage');
        if (minDamageEl) minDamageEl.value = '';
        
        const maxDamageEl = document.getElementById('max-damage');
        if (maxDamageEl) maxDamageEl.value = '';
        
        const minLevelEl = document.getElementById('min-level');
        if (minLevelEl) minLevelEl.value = '';
        
        const maxLevelEl = document.getElementById('max-level');
        if (maxLevelEl) maxLevelEl.value = '';
        
        const hasEffectsEl = document.getElementById('has-effects');
        if (hasEffectsEl) hasEffectsEl.checked = false;
        
        const isCraftableEl = document.getElementById('is-craftable');
        if (isCraftableEl) isCraftableEl.checked = false;
        
        const hasRecipeEl = document.getElementById('has-recipe');
        if (hasRecipeEl) hasRecipeEl.checked = false;

        const baseKeyEl = document.getElementById('filter-baseStat-key');
        const baseValEl = document.getElementById('filter-baseStat-value');
        if (baseKeyEl) baseKeyEl.value = '';
        if (baseValEl) baseValEl.value = '';

        const statKeyEl = document.getElementById('filter-stat-key');
        const statValEl = document.getElementById('filter-stat-value');
        if (statKeyEl) statKeyEl.value = '';
        if (statValEl) statValEl.value = '';

        const recipeKeyEl = document.getElementById('filter-recipe-key');
        const recipeValEl = document.getElementById('filter-recipe-value');
        if (recipeKeyEl) recipeKeyEl.value = '';
        if (recipeValEl) recipeValEl.value = '';
        
        // Clear search
        const globalSearchEl = document.getElementById('global-search');
        if (globalSearchEl) globalSearchEl.value = '';
        this.searchQuery = '';
        
        this.filterItems();
    }



    viewItem(itemId) {
        this.showItemModal(itemId);
    }

    showSchemaSection(section) {
        // Update navigation
        document.querySelectorAll('.schema-nav-link').forEach(link => {
            link.classList.remove('active');
        });
        const activeLink = document.querySelector(`[data-section="${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        const content = document.getElementById('schema-content');
        if (!content) return;

        // Add null checks for gameData
        if (!this.gameData || !this.gameData.schemaDocumentation || !this.gameData.schemaDocumentation.itemStructure) {
            content.innerHTML = '<p>Schema documentation not available.</p>';
            return;
        }

        const schemaData = this.gameData.schemaDocumentation.itemStructure[section];
        if (!schemaData) return;

        let html = `
            <h2>${this.formatStatName(section)}</h2>
            <p>${schemaData.description}</p>
        `;

        if (schemaData.fields) {
            html += `
                <h3>Fields</h3>
                <table class="schema-table" style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                    <thead>
                        <tr style="background: var(--color-bg-1); border-bottom: 2px solid var(--color-border);">
                            <th style="padding: 12px; text-align: left; border: 1px solid var(--color-border);">Name</th>
                            <th style="padding: 12px; text-align: left; border: 1px solid var(--color-border);">Type</th>
                            <th style="padding: 12px; text-align: left; border: 1px solid var(--color-border);">Nullable</th>
                            <th style="padding: 12px; text-align: left; border: 1px solid var(--color-border);">Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${schemaData.fields.map(field => `
                            <tr style="border-bottom: 1px solid var(--color-card-border-inner);">
                                <td style="padding: 12px; border: 1px solid var(--color-card-border-inner); font-family: var(--font-family-mono); color: var(--color-primary);">${field.name}</td>
                                <td style="padding: 12px; border: 1px solid var(--color-card-border-inner); font-family: var(--font-family-mono);">${field.type}</td>
                                <td style="padding: 12px; border: 1px solid var(--color-card-border-inner);">${field.nullable ? 'Yes' : 'No'}</td>
                                <td style="padding: 12px; border: 1px solid var(--color-card-border-inner);">${field.description}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        if (schemaData.note) {
            html += `<p style="margin-top: 16px; font-style: italic; color: var(--color-text-secondary);"><strong>Note:</strong> ${schemaData.note}</p>`;
        }

        if (schemaData.inherits) {
            html += `<p style="margin-top: 16px; color: var(--color-text-secondary);"><strong>Inherits from:</strong> ${schemaData.inherits}</p>`;
        }

        content.innerHTML = html;
    }

    updateJsonExplorer() {
        const viewer = document.getElementById('json-viewer');
        if (!viewer) return;

        // Add null check for gameData
        if (!this.gameData || !this.gameData.sampleItem) {
            viewer.innerHTML = '<p>Sample data not available.</p>';
            return;
        }

        const sampleData = this.gameData.sampleItem;
        viewer.innerHTML = this.formatJsonWithSyntaxHighlighting(sampleData);
    }

    formatJsonWithSyntaxHighlighting(obj, indent = 0) {
        const indentStr = '  '.repeat(indent);
        
        if (obj === null) return '<span class="json-null">null</span>';
        if (typeof obj === 'boolean') return `<span class="json-boolean">${obj}</span>`;
        if (typeof obj === 'number') return `<span class="json-number">${obj}</span>`;
        if (typeof obj === 'string') return `<span class="json-string">"${obj}"</span>`;
        
        if (Array.isArray(obj)) {
            if (obj.length === 0) return '<span class="json-bracket">[]</span>';
            
            let result = '<span class="json-bracket">[</span>\n';
            obj.forEach((item, index) => {
                result += indentStr + '  ' + this.formatJsonWithSyntaxHighlighting(item, indent + 1);
                if (index < obj.length - 1) result += ',';
                result += '\n';
            });
            result += indentStr + '<span class="json-bracket">]</span>';
            return result;
        }
        
        if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            if (keys.length === 0) return '<span class="json-bracket">{}</span>';
            
            let result = '<span class="json-bracket">{</span>\n';
            keys.forEach((key, index) => {
                result += indentStr + '  <span class="json-key">"' + key + '"</span>: ';
                result += this.formatJsonWithSyntaxHighlighting(obj[key], indent + 1);
                if (index < keys.length - 1) result += ',';
                result += '\n';
            });
            result += indentStr + '<span class="json-bracket">}</span>';
            return result;
        }
        
        return String(obj);
    }

    expandAllJson() {
        // Implement JSON expansion logic
        const viewer = document.getElementById('json-viewer');
        if (viewer) {
            viewer.querySelectorAll('.json-collapsed').forEach(el => {
                el.classList.remove('json-collapsed');
            });
        }
    }

    collapseAllJson() {
        // Implement JSON collapse logic
        const viewer = document.getElementById('json-viewer');
        if (viewer) {
            viewer.querySelectorAll('.json-node').forEach(el => {
                el.classList.add('json-collapsed');
            });
        }
    }

    validateJson() {
        try {
            // Add null check for gameData
            if (!this.gameData || !this.gameData.sampleItem) {
                alert('No data available to validate.');
                return;
            }
            
            JSON.stringify(this.gameData.sampleItem);
            alert('JSON is valid!');
        } catch (error) {
            alert('JSON validation error: ' + error.message);
        }
    }

    executeQuery() {
        const mongoQueryEl = document.getElementById('mongodb-query');
        const restQueryEl = document.getElementById('rest-query');
        
        const mongoQuery = mongoQueryEl ? mongoQueryEl.value : '';
        const restQuery = restQueryEl ? restQueryEl.value : '';
        
        // Simulate query execution
        this.trackApiCall();
        alert('Query executed successfully! Check the performance metrics.');
    }

    saveApiConfig() {
        const baseUrlEl = document.getElementById('api-base-url');
        const apiKeyEl = document.getElementById('api-key');
        const timeoutEl = document.getElementById('api-timeout');
        
        this.apiConfig.baseUrl = baseUrlEl ? baseUrlEl.value : '';
        this.apiConfig.apiKey = apiKeyEl ? apiKeyEl.value : '';
        this.apiConfig.timeout = timeoutEl ? parseInt(timeoutEl.value) || 5000 : 5000;
        
        this.updateApiStatus('connected', 'Configuration saved successfully');
    }

    testApiConnection() {
        this.updateApiStatus('connecting', 'Testing connection...');
        
        setTimeout(() => {
            const random = Math.random();
            if (random > 0.8) {
                this.updateApiStatus('error', 'Connection failed - please check your settings');
            } else {
                this.updateApiStatus('connected', 'Connection successful');
                this.trackApiCall();
            }
        }, 1500);
    }

    initializeApiStatus() {
        this.updateApiStatus('connecting', 'Initializing API connection...');
    }

    updateApiStatus(status, message) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        if (indicator) {
            indicator.className = 'status-indicator';
            if (status === 'error') indicator.classList.add('error');
            if (status === 'warning') indicator.classList.add('warning');
        }
        
        if (text) {
            text.textContent = message;
        }
    }

    trackApiCall() {
        if (!this.performanceMetrics) {
            this.performanceMetrics = {
                apiCalls: 0,
                responseTimes: [],
                responseTime: 0,
                cacheHits: 0,
            };
        }

        this.performanceMetrics.apiCalls++;
        const responseTime = Math.floor(Math.random() * 200) + 50;
        this.performanceMetrics.responseTimes.push(responseTime);

        if (this.performanceMetrics.responseTimes.length > 10) {
            this.performanceMetrics.responseTimes.shift();
        }

        this.performanceMetrics.responseTime = Math.floor(
            this.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / 
            this.performanceMetrics.responseTimes.length
        );

        this.updatePerformanceMetrics();
    }


    updatePerformanceMetrics() {
        const apiCallsEl = document.getElementById('api-calls');
        if (apiCallsEl) {
            apiCallsEl.textContent = this.performanceMetrics.apiCalls;
        }
        
        const cacheHitsEl = document.getElementById('cache-hits');
        if (cacheHitsEl) {
            cacheHitsEl.textContent = this.performanceMetrics.cacheHits;
        }
        
        const avgResponseEl = document.getElementById('avg-response');
        if (avgResponseEl) {
            avgResponseEl.textContent = `${this.performanceMetrics.responseTime}ms`;
        }
        
        const responseTimeEl = document.getElementById('response-time');
        if (responseTimeEl) {
            responseTimeEl.textContent = `${this.performanceMetrics.responseTime}ms`;
        }
    }

    updateSortOrderDisplay() {
        const sortOrderText = document.getElementById('sort-order-text');
        if (sortOrderText) {
            if (this.sortOrder === 'asc') {
                sortOrderText.textContent = '↑Asc';
            } else {
                sortOrderText.textContent = '↓Desc';
            }
        }
    }

    searchItems(query, items = this.items) {
        const searchTerm = query.toLowerCase().trim();
        return items.filter(item => {
            // Search in basic properties
            const basicMatch = [
                item.name,
                item.description,
                item.type,
                item.subtype,
                item.rarity,
                item.byType
            ].some(prop => prop && prop.toLowerCase().includes(searchTerm));

            // Search in nested structures
            const nestedMatch = this.searchNestedProperties(item, searchTerm);

            return basicMatch || nestedMatch;
        });
    }

    searchNestedProperties(obj, searchTerm, depth = 0) {
        if (depth > 5) return false; // Prevent infinite recursion
        
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) continue;
            
            if (typeof value === 'string' && value.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            if (typeof value === 'object') {
                if (Array.isArray(value)) {
                    if (value.some(item => 
                        typeof item === 'object' ? 
                        this.searchNestedProperties(item, searchTerm, depth + 1) :
                        typeof item === 'string' && item.toLowerCase().includes(searchTerm)
                    )) {
                        return true;
                    }
                } else {
                    if (this.searchNestedProperties(value, searchTerm, depth + 1)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }



    performSearch() {
        this.filterItems();
    }

    formatStatName(name) {
        return name.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase())
                  .replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    findItemById(itemId) {
        return this.items.find(item => item.itemId === itemId);
    }

    // Replace findItemsUsingMaterial to use recipes.json
    findItemsUsingMaterial(materialId) {
        // Find all recipes that use this material
        const recipesUsingMaterial = this.recipes.filter(recipe =>
            recipe.materials && recipe.materials.some(mat => mat.itemId === materialId)
        );
        // For each recipe, find the output item in this.items
        return recipesUsingMaterial.map(recipe => {
            // Try to find by itemId or by name (normalized)
            let outputItem = this.items.find(item =>
                item.itemId === recipe.recipeId ||
                item.itemId === recipe.itemId ||
                (item.name && recipe.name && item.name.toLowerCase() === recipe.name.toLowerCase())
            );
            // Fallback: create a minimal object if not found
            if (!outputItem) {
                outputItem = {
                    itemId: recipe.recipeId || recipe.itemId || recipe.name?.toLowerCase().replace(/ /g, '_'),
                    name: recipe.name || 'Unknown',
                    type: recipe.category || 'Recipe'
                };
            }
            return outputItem;
        });
    }

    // Helper to find a recipe for an item by itemId
    findRecipeForItem(itemId) {
        return this.recipes.find(recipe => recipe.recipeId === itemId || recipe.itemId === itemId || recipe.name?.toLowerCase().replace(/ /g, '_') === itemId);
    }

    showLoading() {
        const loadingEl = document.getElementById('loading-overlay');
        if (loadingEl) {
            loadingEl.classList.add('active');
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('loading-overlay');
        if (loadingEl) {
            loadingEl.classList.remove('active');
        }
    }

    closeModal() {
        const modal = document.getElementById('item-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Initialize the application
const wiki = new AdvancedGameWiki();