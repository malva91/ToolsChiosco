import { db } from '../shared/firebase.js';
import { 
  collection, doc, getDocs, getDoc, setDoc, onSnapshot, deleteDoc,
  query, where, orderBy, Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { formatDate, getWeekString, getDayName, showToast, debounce , getContrastColor } from '../shared/utils.js';

class ListaManager {
  constructor() {
    this.selectedDate = new Date();
    this.categories = [];
    this.products = [];
    this.currentList = { items: [], extras: [], status: {}, version: 0 };
    this.selectedCategory = '';
    this.searchTerm = '';
    
    this.init();
  }

  async init() {
    this.setupDateSelector();
    this.setupEventListeners();
    await this.loadCategories();
    await this.loadProducts();
    await this.loadCurrentList();
    this.renderProducts();
    this.renderExtras();
  }

  setupDateSelector() {
    const dateSelector = document.getElementById('dateSelector');
    const currentDateEl = document.getElementById('currentDate');
    
    dateSelector.value = formatDate(this.selectedDate);
    currentDateEl.textContent = `${getDayName(this.selectedDate)} ${formatDate(this.selectedDate)}`;
    
    dateSelector.addEventListener('change', (e) => {
      this.selectedDate = new Date(e.target.value);
      currentDateEl.textContent = `${getDayName(this.selectedDate)} ${formatDate(this.selectedDate)}`;
      this.loadCurrentList();
    });
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', debounce((e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderProducts();
    }, 300));

    document.getElementById('addExtraBtn').addEventListener('click', () => {
      this.addExtra();
    });

    document.getElementById('extraName').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addExtra();
    });

    document.getElementById('saveDraftBtn').addEventListener('click', () => {
      this.saveList(false);
    });

    document.getElementById('submitBtn').addEventListener('click', () => {
      this.saveList(true);
    });
  }

  async loadCategories() {
    try {
      const categoriesSnap = await getDocs(collection(db, 'categories'));
      this.categories = categoriesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      this.renderCategoryFilters();
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
      this.showError('Errore nel caricamento delle categorie');
    }
  }

  async loadProducts() {
    try {
      const productsQuery = query(
        collection(db, 'products'),
        where('active', '==', true),
        orderBy('name')
      );
      const productsSnap = await getDocs(productsQuery);
      this.products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      this.showError('Errore nel caricamento dei prodotti');
    }
  }

  async loadCurrentList() {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      const listDoc = await getDoc(doc(db, 'weeks', week, 'lists', day));
      
      if (listDoc.exists()) {
        this.currentList = listDoc.data();
      } else {
        this.currentList = { items: [], extras: [], status: {}, version: 0 };
      }
      
      this.renderProducts();
      this.renderExtras();
    } catch (error) {
      console.error('Errore caricamento lista:', error);
      this.showError('Errore nel caricamento della lista');
    }
  }

  renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');
    const allBtn = document.createElement('button');
    allBtn.className = `btn btn-secondary ${!this.selectedCategory ? 'active' : ''}`;
    allBtn.textContent = 'Tutte';
    allBtn.addEventListener('click', () => {
      this.selectedCategory = '';
      this.renderProducts();
      this.updateCategoryFilters();
    });
    
    container.innerHTML = '';
    container.appendChild(allBtn);
    
    this.categories.forEach(category => {
      const btn = document.createElement('button');
      btn.className = `btn btn-secondary ${this.selectedCategory === category.id ? 'active' : ''}`;
      btn.textContent = category.name;
      btn.style.backgroundColor = this.selectedCategory === category.id ? category.colorHex : '';
            btn.style.color = this.selectedCategory === category.id ? getContrastColor(category.colorHex) : '';btn.addEventListener('click', () => {
        this.selectedCategory = category.id;
        this.renderProducts();
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
      } else {
        const category = this.categories[index - 1];
        const isActive = this.selectedCategory === category.id;
        btn.classList.toggle('active', isActive);
        btn.style.backgroundColor = isActive ? category.colorHex : '';
      }
    });
  }

  renderProducts() {
    const container = document.getElementById('productsList');
    const loading = document.getElementById('loadingProducts');
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');
    
    let filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm);
      const matchesCategory = !this.selectedCategory || 
        product.categoryId === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Raggruppa per categoria
    const groupedProducts = {};
    filteredProducts.forEach(product => {
      if (!groupedProducts[product.categoryId]) {
        groupedProducts[product.categoryId] = [];
      }
      groupedProducts[product.categoryId].push(product);
    });

    container.innerHTML = '';
    
    Object.entries(groupedProducts).forEach(([categoryId, products]) => {
      const category = this.categories.find(c => c.id === categoryId);
      if (!category) return;

      const categorySection = document.createElement('div');
      categorySection.className = 'mb-4';
      categorySection.style.background = `linear-gradient(135deg, ${category.colorHex}10 0%, transparent 100%)`;
      categorySection.style.border = `1px solid ${category.colorHex}30`;
      categorySection.style.borderRadius = '8px';
      categorySection.style.padding = '0.75rem';
      categorySection.style.borderLeft = `4px solid ${category.colorHex}`;
      
      const categoryHeader = document.createElement('h3');
      categoryHeader.style.color = category.colorHex;
      categoryHeader.textContent = `📂 ${category.name}`;
      categoryHeader.className = 'mb-2';
      categorySection.appendChild(categoryHeader);

      products.forEach(product => {
        const productCard = this.createProductCard(product, category);
        categorySection.appendChild(productCard);
      });

      container.appendChild(categorySection);
    });
  }

  createProductCard(product, category) {
    const existingItem = this.currentList.items.find(item => item.id === product.id);
    const quantity = existingItem ? existingItem.quantity : 0;

    const card = document.createElement('div');
    card.className = 'product-card';
    
    card.innerHTML = `
      <div class="product-header">
        <div>
          <div class="product-name">
            ${product.name}
            ${product.important ? '<span class="important-badge">Importante</span>' : ''}
          </div>
          <div class="product-category" style="background-color: ${category.colorHex}20; color: ${category.colorHex}; border: 1px solid ${category.colorHex};">
            ${category.name}
          </div>
        </div>
      </div>
      <div class="quantity-controls">
        <button class="qty-btn" onclick="window.listaManager.updateQuantity('${product.id}', ${quantity - 1})" ${quantity <= 0 ? 'disabled' : ''}>-</button>
        <input type="number" class="qty-input" value="${quantity}" min="0" 
               onchange="window.listaManager.updateQuantity('${product.id}', parseInt(this.value) || 0)">
        <button class="qty-btn" onclick="window.listaManager.updateQuantity('${product.id}', ${quantity + 1})">+</button>
      </div>
    `;

    return card;
  }

  updateQuantity(productId, newQuantity) {
    if (newQuantity < 0) newQuantity = 0;
    
    const existingIndex = this.currentList.items.findIndex(item => item.id === productId);
    
    if (newQuantity === 0 && existingIndex !== -1) {
      this.currentList.items.splice(existingIndex, 1);
    } else if (newQuantity > 0) {
      if (existingIndex !== -1) {
        this.currentList.items[existingIndex].quantity = newQuantity;
      } else {
        this.currentList.items.push({
          id: productId,
          quantity: newQuantity
        });
      }
    }
    
    this.renderProducts();
  }

  addExtra() {
    const nameInput = document.getElementById('extraName');
    const qtyInput = document.getElementById('extraQty');
    
    const name = nameInput.value.trim();
    const qty = parseInt(qtyInput.value) || 1;
    
    if (!name) {
      showToast('Inserisci il nome del prodotto extra', 'error');
      return;
    }
    
    const existingIndex = this.currentList.extras.findIndex(extra => extra.name === name);
    
    if (existingIndex !== -1) {
      this.currentList.extras[existingIndex].quantity += qty;
    } else {
      this.currentList.extras.push({ name, quantity: qty });
    }
    
    nameInput.value = '';
    qtyInput.value = '';
    this.renderExtras();
  }

  renderExtras() {
    const container = document.getElementById('extrasList');
    container.innerHTML = '';
    
    this.currentList.extras.forEach((extra, index) => {
      const extraDiv = document.createElement('div');
      extraDiv.className = 'flex justify-between mb-2 p-2';
      extraDiv.style.background = 'var(--bg-tertiary)';
      extraDiv.style.borderRadius = '4px';
      
      extraDiv.innerHTML = `
        <span>${extra.name} (${extra.quantity})</span>
        <button class="btn btn-error" style="padding: 0.25rem 0.5rem; font-size: 0.875rem;" 
                onclick="window.listaManager.removeExtra(${index})">🗑️</button>
      `;
      
      container.appendChild(extraDiv);
    });
  }

  removeExtra(index) {
    this.currentList.extras.splice(index, 1);
    this.renderExtras();
  }

  async saveList(isSubmit = false) {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      
      // Calcola diff per notifiche
      const previousList = { ...this.currentList };
      
      this.currentList.status.updatedAt = Timestamp.now();
      this.currentList.version = (this.currentList.version || 0) + 1;
      
      if (isSubmit) {
        // Verifica prodotti importanti
        const importantProducts = this.products.filter(p => p.important);
        const missingImportant = importantProducts.filter(ip => 
          !this.currentList.items.find(item => item.id === ip.id)
        );
        
        if (missingImportant.length > 0) {
          const missingNames = missingImportant.map(p => p.name).join(', ');
          document.getElementById('validationMessage').textContent = 
            `Attenzione: mancano i seguenti prodotti importanti: ${missingNames}`;
          document.getElementById('validationMessage').classList.remove('hidden');
          return;
        }
        
        this.currentList.status.submittedAt = Timestamp.now();
      }
      
      // Salva lista
      await setDoc(doc(db, 'weeks', week, 'lists', day), this.currentList);
      
      // Genera notifiche
      await this.generateNotifications(previousList, week, day);
      
      const message = isSubmit ? 'Lista inviata con successo!' : 'Bozza salvata!';
      document.getElementById('successMessage').textContent = message;
      document.getElementById('successMessage').classList.remove('hidden');
      document.getElementById('validationMessage').classList.add('hidden');
      
      showToast(message, 'success');
      
      setTimeout(() => {
        document.getElementById('successMessage').classList.add('hidden');
      }, 3000);
      
    } catch (error) {
      console.error('Errore salvataggio:', error);
      this.showError('Errore durante il salvataggio');
    }
  }

  async generateNotifications(previousList, week, day) {
    const notifications = [];
    
    // Confronta items
    const prevItems = previousList.items || [];
    const currItems = this.currentList.items || [];
    
    // Prodotti aggiunti
    currItems.forEach(curr => {
      const prev = prevItems.find(p => p.id === curr.id);
      if (!prev) {
        const product = this.products.find(p => p.id === curr.id);
        notifications.push({
          type: 'added',
          id: curr.id,
          name: product?.name || curr.id,
          quantity: curr.quantity,
          atVersion: this.currentList.version
        });
      } else if (prev.quantity !== curr.quantity) {
        const product = this.products.find(p => p.id === curr.id);
        notifications.push({
          type: 'qtyChanged',
          id: curr.id,
          name: product?.name || curr.id,
          oldQuantity: prev.quantity,
          newQuantity: curr.quantity,
          atVersion: this.currentList.version
        });
      }
    });
    
    // Prodotti rimossi
    prevItems.forEach(prev => {
      const curr = currItems.find(c => c.id === prev.id);
      if (!curr) {
        const product = this.products.find(p => p.id === prev.id);
        notifications.push({
          type: 'removed',
          id: prev.id,
          name: product?.name || prev.id,
          quantity: prev.quantity,
          atVersion: this.currentList.version
        });
      }
    });
    
    // Confronta extras
    const prevExtras = previousList.extras || [];
    const currExtras = this.currentList.extras || [];
    
    currExtras.forEach(curr => {
      const prev = prevExtras.find(p => p.name === curr.name);
      if (!prev) {
        notifications.push({
          type: 'extraAdded',
          name: curr.name,
          quantity: curr.quantity,
          atVersion: this.currentList.version
        });
      } else if (prev.quantity !== curr.quantity) {
        notifications.push({
          type: 'extraChanged',
          name: curr.name,
          oldQuantity: prev.quantity,
          newQuantity: curr.quantity,
          atVersion: this.currentList.version
        });
      }
    });
    
    prevExtras.forEach(prev => {
      const curr = currExtras.find(c => c.name === prev.name);
      if (!curr) {
        notifications.push({
          type: 'extraRemoved',
          name: prev.name,
          quantity: prev.quantity,
          atVersion: this.currentList.version
        });
      }
    });
    
    // Salva notifiche
    if (notifications.length > 0) {
      const notifDocId = `${week}_${day}`;
      
      for (const notif of notifications) {
        const notifId = `${notif.type}_${notif.id || notif.name}_${notif.atVersion}`;
        await setDoc(doc(db, 'notifications', notifDocId, 'entries', notifId), {
          ...notif,
          timestamp: Timestamp.now(),
          read: false
        });
      }
      
      // Aggiorna counter
      const notifDoc = await getDoc(doc(db, 'notifications', notifDocId));
      const currentCount = notifDoc.exists() ? (notifDoc.data().unreadCount || 0) : 0;
      
      await setDoc(doc(db, 'notifications', notifDocId), {
        unreadCount: currentCount + notifications.length,
        lastUpdate: Timestamp.now()
      }, { merge: true });
    }
  }

  showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
  }
}

// Inizializza l'applicazione
window.listaManager = new ListaManager();