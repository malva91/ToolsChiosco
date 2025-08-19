import { db } from '../shared/firebase.js';
import { 
  collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showToast, debounce, getContrastColor, generateUniqueId } from '../shared/utils.js';
import { safeQuerySelector, safeAddEventListener, validateInput, initMobileUtils } from '../shared/utils.js';

class CatalogoManager {
  constructor() {
    this.categories = [];
    this.products = [];
    this.filteredProducts = [];
    this.selectedCategory = '';
    this.searchTerm = '';
    this.editingCategory = null;
    this.editingProduct = null;
    
    this.init();
  }

  async init() {
    // Initialize mobile utilities
    initMobileUtils();
    
    this.setupEventListeners();
    await this.loadCategories();
    await this.loadProducts();
    this.renderCategoryFilters();
    this.renderProducts();
  }

  setupEventListeners() {
    // Category events
    const addCategoryBtn = safeQuerySelector('#addCategoryBtn');
    if (addCategoryBtn) {
      safeAddEventListener(addCategoryBtn, 'click', () => {
      this.addCategory();
      });
    }

    const updateCategoryBtn = safeQuerySelector('#updateCategoryBtn');
    if (updateCategoryBtn) {
      safeAddEventListener(updateCategoryBtn, 'click', () => {
      this.updateCategory();
      });
    }

    const cancelCategoryBtn = safeQuerySelector('#cancelCategoryBtn');
    if (cancelCategoryBtn) {
      safeAddEventListener(cancelCategoryBtn, 'click', () => {
      this.cancelCategoryEdit();
      });
    }

    // Product events
    const addProductBtn = safeQuerySelector('#addProductBtn');
    if (addProductBtn) {
      safeAddEventListener(addProductBtn, 'click', () => {
      this.addProduct();
      });
    }

    const updateProductBtn = safeQuerySelector('#updateProductBtn');
    if (updateProductBtn) {
      safeAddEventListener(updateProductBtn, 'click', () => {
      this.updateProduct();
      });
    }

    const cancelProductBtn = safeQuerySelector('#cancelProductBtn');
    if (cancelProductBtn) {
      safeAddEventListener(cancelProductBtn, 'click', () => {
      this.cancelProductEdit();
      });
    }

    // Search and filter
    const searchInput = safeQuerySelector('#searchInput');
    if (searchInput) {
      safeAddEventListener(searchInput, 'input', debounce((e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.filterProducts();
      }, 300));
    }

    // Import/Export
    const exportBtn = safeQuerySelector('#exportBtn');
    if (exportBtn) {
      safeAddEventListener(exportBtn, 'click', () => {
      this.exportData();
      });
    }

    const importFile = safeQuerySelector('#importFile');
    if (importFile) {
      safeAddEventListener(importFile, 'change', (e) => {
      this.importData(e.target.files[0]);
      });
    }
  }

  async loadCategories() {
    try {
      const categoriesSnap = await getDocs(query(collection(db, 'categories'), orderBy('name')));
      this.categories = categoriesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Validazione dei dati delle categorie
      this.categories = this.categories.filter(category => {
        if (!category.name || !category.colorHex) {
          console.warn('Categoria con dati mancanti ignorata:', category);
          return false;
        }
        return true;
      });
      
      this.renderCategoriesList();
      this.renderProductCategorySelect();
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
      this.showError('Errore nel caricamento delle categorie');
      // Fallback con array vuoto per evitare crash
      this.categories = [];
    }
  }

  async loadProducts() {
    try {
      const productsSnap = await getDocs(query(collection(db, 'products'), orderBy('name')));
      this.products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Validazione dei dati dei prodotti
      this.products = this.products.filter(product => {
        if (!product.name || !product.categoryId) {
          console.warn('Prodotto con dati mancanti ignorato:', product);
          return false;
        }
        return true;
      });
      
      this.filterProducts();
      document.getElementById('loadingProducts').classList.add('hidden');
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      this.showError('Errore nel caricamento dei prodotti');
      // Fallback con array vuoto per evitare crash
      this.products = [];
      document.getElementById('loadingProducts').classList.add('hidden');
    }
  }

  renderCategoriesList() {
    const container = safeQuerySelector('#categoriesList');
    if (!container) {
      console.error('Container categoriesList non trovato');
      return;
    }
    
    container.innerHTML = '';

    this.categories.forEach(category => {
      if (!category.id || !category.name || !category.colorHex) {
        console.warn('Categoria con dati mancanti saltata:', category);
        return;
      }
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'category-item';
      categoryDiv.style.background = `linear-gradient(135deg, ${category.colorHex}10 0%, transparent 100%)`;
      categoryDiv.style.border = `1px solid ${category.colorHex}30`;
      categoryDiv.style.borderRadius = '8px';
      categoryDiv.style.padding = '1rem';
      categoryDiv.style.marginBottom = '0.75rem';
      categoryDiv.style.borderLeft = `4px solid ${category.colorHex}`;

      categoryDiv.innerHTML = `
        <div class="category-item-content">
          <div class="category-info">
            <div class="category-color-dot" style="background: ${category.colorHex};"></div>
            <span class="category-name">${category.name}</span>
          </div>
          <div class="category-item-actions">
            <button class="btn-icon btn-edit" title="Modifica categoria"
                    onclick="window.catalogoManager.editCategory('${categoryId}')">
              <span>✏️</span>
            </button>
            <button class="btn-icon btn-delete" title="Elimina categoria"
                    onclick="window.catalogoManager.deleteCategory('${categoryId}')">
              <span>🗑️</span>
            </button>
          </div>
        </div>
      `;

      container.appendChild(categoryDiv);
    });
  }

  renderProductCategorySelect() {
    const select = safeQuerySelector('#productCategory');
    if (!select) {
      console.error('Select productCategory non trovato');
      return;
    }
    
    select.innerHTML = '<option value="">Seleziona categoria</option>';

    this.categories.forEach(category => {
      if (!category.id || !category.name) {
        console.warn('Categoria con dati mancanti saltata nel select:', category);
        return;
      }
      
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
  }

  renderCategoryFilters() {
    const container = safeQuerySelector('#categoryFilters');
    if (!container) {
      console.error('Container categoryFilters non trovato');
      return;
    }
    
    const allBtn = document.createElement('button');
    allBtn.className = `btn btn-secondary ${!this.selectedCategory ? 'active' : ''}`;
    allBtn.textContent = 'Tutti';
    allBtn.addEventListener('click', () => {
      this.selectedCategory = '';
      this.filterProducts();
      this.updateCategoryFilters();
    });
    
    container.innerHTML = '';
    container.appendChild(allBtn);
    
    this.categories.forEach(category => {
      if (!category.id || !category.name || !category.colorHex) {
        console.warn('Categoria con dati mancanti saltata nei filtri:', category);
        return;
      }
      
      const btn = document.createElement('button');
      btn.className = `btn btn-secondary ${this.selectedCategory === category.id ? 'active' : ''}`;
      btn.textContent = category.name;
      btn.style.backgroundColor = this.selectedCategory === category.id ? category.colorHex : '';
      btn.style.color = this.selectedCategory === category.id ? getContrastColor(category.colorHex) : '';
      btn.addEventListener('click', () => {
        this.selectedCategory = category.id;
        this.filterProducts();
        this.updateCategoryFilters();
      });
      container.appendChild(btn);
    });
  }

  updateCategoryFilters() {
    const buttons = document.querySelectorAll('#categoryFilters button');
    buttons.forEach((btn, index) => {
      if (index === 0) {
        btn.classList.toggle('active', !this.selectedCategory);
        btn.style.backgroundColor = '';
        btn.style.color = '';
      } else {
        const category = this.categories[index - 1];
        const isActive = this.selectedCategory === category.id;
        btn.classList.toggle('active', isActive);
        btn.style.backgroundColor = isActive ? category.colorHex : '';
        btn.style.color = isActive ? getContrastColor(category.colorHex) : '';
      }
    });
  }

  filterProducts() {
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm);
      const matchesCategory = !this.selectedCategory || 
        product.categoryId === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
    this.renderProducts();
  }

  renderProducts() {
    const container = safeQuerySelector('#productsList');
    if (!container) {
      console.error('Container productsList non trovato');
      return;
    }
    
    container.innerHTML = '';

    if (this.filteredProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <h3>Nessun prodotto trovato</h3>
          <p>Prova a modificare i filtri di ricerca o aggiungi un nuovo prodotto</p>
        </div>
      `;
      return;
    }

    // Raggruppa per categoria
    const groupedProducts = {};
    this.filteredProducts.forEach(product => {
      if (!groupedProducts[product.categoryId]) {
        groupedProducts[product.categoryId] = [];
      }
      groupedProducts[product.categoryId].push(product);
    });

    Object.entries(groupedProducts).forEach(([categoryId, products]) => {
      const category = this.categories.find(c => c.id === categoryId);
      if (!category) {
        console.warn('Categoria non trovata per ID:', categoryId);
        return;
      }

      const categorySection = document.createElement('div');
      categorySection.className = 'category-section';
      categorySection.style.background = `linear-gradient(135deg, ${category.colorHex}05 0%, transparent 100%)`;
      categorySection.style.border = `1px solid ${category.colorHex}20`;
      categorySection.style.borderRadius = '12px';
      categorySection.style.padding = '1.5rem';
      categorySection.style.marginBottom = '2rem';
      
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'category-header';
      categoryHeader.innerHTML = `
        <div class="category-title">
          <div class="category-color-indicator" style="background: ${category.colorHex};"></div>
          <h3 style="color: ${category.colorHex}; margin: 0;">📂 ${category.name}</h3>
          <span class="product-count">${products.length} prodott${products.length === 1 ? 'o' : 'i'}</span>
        </div>
        <div class="category-actions">
          <button class="btn-icon btn-secondary" title="Modifica categoria"
                  onclick="window.catalogoManager.editCategory('${categoryId}')">
            <span>⚙️</span>
          </button>
        </div>
      `;
      categorySection.appendChild(categoryHeader);

      const productsGrid = document.createElement('div');
      productsGrid.className = 'products-grid';

      products.forEach(product => {
        const productCard = this.createProductCard(product, category);
        productsGrid.appendChild(productCard);
      });

      categorySection.appendChild(productsGrid);
      container.appendChild(categorySection);
    });
  }

  createProductCard(product, category) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Aggiungi sfondo colorato molto leggero basato sulla categoria
    const backgroundColor = `${category.colorHex}08`; // Opacità molto bassa
    const borderColor = `${category.colorHex}20`; // Opacità leggera per il bordo
    card.style.background = `linear-gradient(135deg, ${backgroundColor} 0%, transparent 100%)`;
    card.style.borderLeft = `3px solid ${category.colorHex}`;
    card.style.boxShadow = `0 2px 8px ${category.colorHex}15`;
    
    card.innerHTML = `
      <div class="product-header">
        <div>
          <div class="product-name">
            ${product.name}
            ${product.important ? '<span class="important-badge">Importante</span>' : ''}
            ${!product.active ? '<span class="important-badge" style="background: var(--text-muted);">Inattivo</span>' : ''}
          </div>
          <div class="product-category" style="background-color: ${category.colorHex}20; color: ${category.colorHex}; border: 1px solid ${category.colorHex};">
            ${category.name}
          </div>
        </div>
        <div class="flex">
          <button class="btn btn-secondary" style="padding: 0.5rem 1rem; margin-right: 0.5rem;" 
                  onclick="window.catalogoManager.editProduct('${product.id}')">✏️ Modifica</button>
          <button class="btn ${product.active ? 'btn-warning' : 'btn-success'}" style="padding: 0.5rem 1rem; margin-right: 0.5rem;" 
                  onclick="window.catalogoManager.toggleProductActive('${product.id}')">
            ${product.active ? '👁️ Disattiva' : '👁️‍🗨️ Attiva'}
          </button>
          <button class="btn btn-error" style="padding: 0.5rem 1rem;" onclick="window.catalogoManager.deleteProduct('${product.id}')">🗑️ Elimina</button>
        </div>
      </div>
    `;

    return card;
  }

  async addCategory() {
    const nameInput = safeQuerySelector('#categoryName');
    const colorInput = safeQuerySelector('#categoryColor');
    
    if (!nameInput || !colorInput) {
      showToast('Elementi form categoria non trovati', 'error');
      return;
    }

    // Validazione con utility
    const nameValidation = validateInput(nameInput.value, 'text', { min: 2, max: 50, required: true });
    if (!nameValidation.valid) {
      showToast(nameValidation.error, 'error');
      return;
    }
    
    const colorValidation = validateInput(colorInput.value, 'text', { 
      required: true, 
      pattern: /^#[0-9A-F]{6}$/i 
    });
    if (!colorValidation.valid) {
      showToast('Seleziona un colore valido', 'error');
      return;
    }

    const name = nameValidation.value;
    const colorHex = colorValidation.value;

    try {
      // Genera ID leggibile
      const categoryId = await generateUniqueId('categories', name, db);
      
      await setDoc(doc(db, 'categories', categoryId), {
        name,
        colorHex
      });

      nameInput.value = '';
      colorInput.value = '#3b82f6';
      
      await this.loadCategories();
      this.renderCategoryFilters();
      showToast(`Categoria "${name}" aggiunta con ID: ${categoryId}`, 'success');
    } catch (error) {
      console.error('Errore aggiunta categoria:', error);
      showToast('Errore nell\'aggiunta della categoria', 'error');
    }
  }

  async updateCategory() {
    if (!this.editingCategory) return;

    const name = document.getElementById('categoryName').value.trim();
    const colorHex = document.getElementById('categoryColor').value;

    if (!name || name.length < 2) {
      showToast('Inserisci il nome della categoria', 'error');
      return;
    }
    
    if (!colorHex || !/^#[0-9A-F]{6}$/i.test(colorHex)) {
      showToast('Seleziona un colore valido', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'categories', this.editingCategory), {
        name,
        colorHex
      });

      this.cancelCategoryEdit();
      await this.loadCategories();
      this.renderCategoryFilters();
      this.renderProducts();
      showToast('Categoria aggiornata con successo!', 'success');
    } catch (error) {
      console.error('Errore aggiornamento categoria:', error);
      showToast('Errore nell\'aggiornamento della categoria', 'error');
    }
  }

  editCategory(categoryId) {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    this.editingCategory = categoryId;
    document.getElementById('categoryName').value = category.name;
    document.getElementById('categoryColor').value = category.colorHex;

    document.getElementById('addCategoryBtn').classList.add('hidden');
    document.getElementById('updateCategoryBtn').classList.remove('hidden');
    document.getElementById('cancelCategoryBtn').classList.remove('hidden');
  }

  cancelCategoryEdit() {
    this.editingCategory = null;
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryColor').value = '#3b82f6';

    document.getElementById('addCategoryBtn').classList.remove('hidden');
    document.getElementById('updateCategoryBtn').classList.add('hidden');
    document.getElementById('cancelCategoryBtn').classList.add('hidden');
  }

  async deleteCategory(categoryId) {
    // Miglioramento UX per mobile
    const confirmMessage = 'Sei sicuro di voler eliminare questa categoria?\n\nI prodotti associati potrebbero non funzionare correttamente.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      await this.loadCategories();
      this.renderCategoryFilters();
      this.renderProducts();
      showToast('Categoria eliminata', 'success');
    } catch (error) {
      console.error('Errore eliminazione categoria:', error);
      showToast('Errore nell\'eliminazione della categoria', 'error');
    }
  }

  async deleteProduct(productId) {
    // Miglioramento UX per mobile
    const confirmMessage = 'Sei sicuro di voler eliminare questo prodotto?\n\nL\'azione non può essere annullata.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', productId));
      await this.loadProducts();
      showToast('Prodotto eliminato', 'success');
    } catch (error) {
      console.error('Errore eliminazione prodotto:', error);
      showToast('Errore nell\'eliminazione del prodotto', 'error');
    }
  }

  async addProduct() {
    const nameInput = safeQuerySelector('#productName');
    const categorySelect = safeQuerySelector('#productCategory');
    const importantInput = safeQuerySelector('#productImportant');
    const activeInput = safeQuerySelector('#productActive');
    
    if (!nameInput || !categorySelect || !importantInput || !activeInput) {
      showToast('Elementi form prodotto non trovati', 'error');
      return;
    }

    // Validazione con utility
    const nameValidation = validateInput(nameInput.value, 'text', { min: 2, max: 100, required: true });
    if (!nameValidation.valid) {
      showToast(nameValidation.error, 'error');
      return;
    }
    
    if (!categorySelect.value) {
      showToast('Seleziona una categoria', 'error');
      return;
    }
    
    const name = nameValidation.value;
    const categoryId = categorySelect.value;
    const important = importantInput.checked;
    const active = activeInput.checked;
    
    // Verifica che la categoria esista
    const categoryExists = this.categories.find(c => c.id === categoryId);
    if (!categoryExists) {
      showToast('La categoria selezionata non è valida', 'error');
      return;
    }

    try {
      // Genera ID leggibile
      const productId = await generateUniqueId('products', name, db);
      
      await setDoc(doc(db, 'products', productId), {
        name,
        categoryId,
        important,
        active
      });

      this.clearProductForm();
      await this.loadProducts();
      showToast(`Prodotto "${name}" aggiunto con ID: ${productId}`, 'success');
    } catch (error) {
      console.error('Errore aggiunta prodotto:', error);
      showToast('Errore nell\'aggiunta del prodotto', 'error');
    }
  }

  async updateProduct() {
    if (!this.editingProduct) return;

    const name = document.getElementById('productName').value.trim();
    const categoryId = document.getElementById('productCategory').value;
    const important = document.getElementById('productImportant').checked;
    const active = document.getElementById('productActive').checked;

    if (!name || name.length < 2) {
      showToast('Inserisci un nome prodotto valido (almeno 2 caratteri)', 'error');
      return;
    }
    
    if (!categoryId) {
      showToast('Inserisci nome prodotto e seleziona categoria', 'error');
      return;
    }
    
    // Verifica che la categoria esista
    const categoryExists = this.categories.find(c => c.id === categoryId);
    if (!categoryExists) {
      showToast('La categoria selezionata non è valida', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'products', this.editingProduct), {
        name,
        categoryId,
        important,
        active
      });

      this.cancelProductEdit();
      await this.loadProducts();
      showToast('Prodotto aggiornato con successo!', 'success');
    } catch (error) {
      console.error('Errore aggiornamento prodotto:', error);
      showToast('Errore nell\'aggiornamento del prodotto', 'error');
    }
  }

  editProduct(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.editingProduct = productId;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.categoryId;
    document.getElementById('productImportant').checked = product.important;
    document.getElementById('productActive').checked = product.active;

    document.getElementById('addProductBtn').classList.add('hidden');
    document.getElementById('updateProductBtn').classList.remove('hidden');
    document.getElementById('cancelProductBtn').classList.remove('hidden');
  }

  cancelProductEdit() {
    this.editingProduct = null;
    this.clearProductForm();

    document.getElementById('addProductBtn').classList.remove('hidden');
    document.getElementById('updateProductBtn').classList.add('hidden');
    document.getElementById('cancelProductBtn').classList.add('hidden');
  }

  clearProductForm() {
    const nameInput = safeQuerySelector('#productName');
    const categorySelect = safeQuerySelector('#productCategory');
    const importantInput = safeQuerySelector('#productImportant');
    const activeInput = safeQuerySelector('#productActive');
    
    if (nameInput) nameInput.value = '';
    if (categorySelect) categorySelect.value = '';
    if (importantInput) importantInput.checked = false;
    if (activeInput) activeInput.checked = true;
  }

  async toggleProductActive(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    try {
      await updateDoc(doc(db, 'products', productId), {
        active: !product.active
      });

      await this.loadProducts();
      const action = product.active ? 'disattivato' : 'attivato';
      showToast(`Prodotto ${action}`, 'success');
    } catch (error) {
      console.error('Errore aggiornamento stato prodotto:', error);
      showToast('Errore nell\'aggiornamento del prodotto', 'error');
    }
  }

  async markCategoryComplete(categoryId) {
    // Metodo per completare tutti i prodotti di una categoria (usato nel magazzino)
    // Questo metodo è chiamato dal magazzino ma definito qui per consistenza
    console.log('markCategoryComplete chiamato per categoria:', categoryId);
  }

  exportData() {
    const data = {
      categories: this.categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        colorHex: cat.colorHex
      })),
      products: this.products.map(prod => ({
        id: prod.id,
        name: prod.name,
        categoryId: prod.categoryId,
        important: prod.important,
        active: prod.active
      }))
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalogo-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showToast('Dati esportati con successo!', 'success');
  }

  async importData(file) {
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      showToast('Seleziona un file JSON valido', 'error');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('File troppo grande (max 5MB)', 'error');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.categories || !data.products) {
        throw new Error('Formato file non valido');
      }
      
      // Validate data structure
      if (!Array.isArray(data.categories) || !Array.isArray(data.products)) {
        throw new Error('Struttura dati non valida');
      }

      // Importa categorie
      for (const category of data.categories) {
        if (!category.id || !category.name || !category.colorHex) {
          console.warn('Categoria con dati mancanti saltata:', category);
          continue;
        }
        await setDoc(doc(db, 'categories', category.id), {
          name: category.name,
          colorHex: category.colorHex
        });
      }

      // Importa prodotti
      for (const product of data.products) {
        if (!product.id || !product.name || !product.categoryId) {
          console.warn('Prodotto con dati mancanti saltato:', product);
          continue;
        }
        await setDoc(doc(db, 'products', product.id), {
          name: product.name,
          categoryId: product.categoryId,
          important: product.important || false,
          active: product.active !== undefined ? product.active : true
        });
      }

      await this.loadCategories();
      await this.loadProducts();
      this.renderCategoryFilters();
      
      showToast('Dati importati con successo!', 'success');
    } catch (error) {
      console.error('Errore importazione:', error);
      if (error.message.includes('JSON')) {
        showToast('File JSON non valido', 'error');
      } else {
        showToast('Errore nell\'importazione del file', 'error');
      }
    }

    // Reset input file
    const importFile = safeQuerySelector('#importFile');
    if (importFile) {
      importFile.value = '';
    }
  }

  showError(message) {
    const errorEl = safeQuerySelector('#errorMessage');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      setTimeout(() => errorEl.classList.add('hidden'), 5000);
    }
    // Fallback con toast se elemento non trovato
    showToast(message, 'error');
    
    // Log error for debugging
    console.error('Catalogo Error:', message);
  }

  showSuccess(message) {
    const successEl = safeQuerySelector('#successMessage');
    if (successEl) {
      successEl.textContent = message;
      successEl.classList.remove('hidden');
      setTimeout(() => successEl.classList.add('hidden'), 3000);
    }
    // Fallback con toast se elemento non trovato
    showToast(message, 'success');
  }
}

// Handle orientation changes
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (window.catalogoManager) {
      window.catalogoManager.renderProducts();
      window.catalogoManager.renderCategoriesList();
    }
  }, 100);
});

// Inizializza l'applicazione
window.catalogoManager = new CatalogoManager();