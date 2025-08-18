import { db } from '../shared/firebase.js';
import { 
  collection, doc, getDocs, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { formatDate, getWeekString, getDayName, showToast } from '../shared/utils.js';
import { safeQuerySelector, safeAddEventListener, validateInput, isMobile } from '../shared/utils.js';

class MagazzinoManager {
  constructor() {
    this.selectedDate = new Date();
    this.categories = [];
    this.products = [];
    this.currentList = null;
    this.currentChecklist = { items: [] };
    this.notifications = [];
    this.unreadCount = 0;
    
    this.init();
  }

  async init() {
    this.setupDateSelector();
    this.setupEventListeners();
    await this.loadCategories();
    await this.loadProducts();
    await this.loadCurrentList();
    await this.loadNotifications();
  }

  setupDateSelector() {
    const dateSelector = safeQuerySelector('#dateSelector');
    const currentDateEl = safeQuerySelector('#currentDate');
    
    if (!dateSelector || !currentDateEl) {
      console.error('Elementi date selector non trovati');
      return;
    }
    
    dateSelector.value = formatDate(this.selectedDate);
    currentDateEl.textContent = `${getDayName(this.selectedDate)} ${formatDate(this.selectedDate)}`;
    
    safeAddEventListener(dateSelector, 'change', (e) => {
      this.selectedDate = new Date(e.target.value);
      currentDateEl.textContent = `${getDayName(this.selectedDate)} ${formatDate(this.selectedDate)}`;
      
      // Rimuovi listener precedenti prima di caricare nuova data
      if (this.listenerUnsubscribes) {
        this.listenerUnsubscribes.forEach(unsubscribe => unsubscribe());
      }
      
      this.loadCurrentList();
      this.loadNotifications();
    });
  }

  setupEventListeners() {
    const markAllReadBtn = safeQuerySelector('#markAllReadBtn');
    if (markAllReadBtn) {
      safeAddEventListener(markAllReadBtn, 'click', () => {
        this.markAllNotificationsRead();
      });
    }
  }

  async loadCategories() {
    try {
      const categoriesSnap = await getDocs(collection(db, 'categories'));
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
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
      this.categories = [];
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
      
      // Validazione dei dati dei prodotti
      this.products = this.products.filter(product => {
        if (!product.name || !product.categoryId) {
          console.warn('Prodotto con dati mancanti ignorato:', product);
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Errore caricamento prodotti:', error);
      this.products = [];
    }
  }

  async loadCurrentList() {
    // Rimuovi listener esistenti se presenti
    if (this.listenerUnsubscribes) {
      this.listenerUnsubscribes.forEach(unsubscribe => unsubscribe());
    }
    this.listenerUnsubscribes = [];
    
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      
      // Carica lista dipendenti
      const listDoc = await getDoc(doc(db, 'weeks', week, 'lists', day));
      
      if (listDoc.exists()) {
        this.currentList = listDoc.data();
        await this.loadChecklist();
        this.renderChecklist();
        document.getElementById('loadingList').classList.add('hidden');
        document.getElementById('checklistContainer').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
      } else {
        this.currentList = null;
        document.getElementById('loadingList').classList.add('hidden');
        document.getElementById('checklistContainer').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
      }
      
      // Configura listener dopo il caricamento iniziale
      this.setupRealtimeListeners();
      
    } catch (error) {
      console.error('Errore caricamento lista:', error);
      this.showError('Errore nel caricamento della lista');
    }
  }

  async loadChecklist() {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      
      const checklistDoc = await getDoc(doc(db, 'weeks', week, 'warehouse', day));
      
      if (checklistDoc.exists()) {
        this.currentChecklist = checklistDoc.data();
      } else {
        // Inizializza checklist da lista dipendenti
        this.currentChecklist = {
          items: this.currentList.items.map(item => ({
            id: item.id,
            qtyRequested: item.quantity,
            qtyPicked: 0,
            prepared: false
          })),
          extras: this.currentList.extras.map(extra => ({
            name: extra.name,
            qtyRequested: extra.quantity,
            qtyPicked: 0,
            prepared: false
          }))
        };
        
        // Salva checklist iniziale
        await setDoc(doc(db, 'weeks', week, 'warehouse', day), this.currentChecklist);
      }
    } catch (error) {
      console.error('Errore caricamento checklist:', error);
    }
  }

  async loadNotifications() {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      const notifDocId = `${week}_${day}`;
      
      // Carica counter
      const notifDoc = await getDoc(doc(db, 'notifications', notifDocId));
      this.unreadCount = notifDoc.exists() ? (notifDoc.data().unreadCount || 0) : 0;
      
      // Carica notifiche
      const notificationsQuery = query(
        collection(db, 'notifications', notifDocId, 'entries'),
        orderBy('timestamp', 'desc')
      );
      const notifSnap = await getDocs(notificationsQuery);
      
      this.notifications = notifSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.renderNotifications();
    } catch (error) {
      console.error('Errore caricamento notifiche:', error);
    }
  }

  setupRealtimeListeners() {
    const week = getWeekString(this.selectedDate);
    const day = formatDate(this.selectedDate);
    const notifDocId = `${week}_${day}`;
    
    // Array per tenere traccia degli unsubscribe
    if (!this.listenerUnsubscribes) {
      this.listenerUnsubscribes = [];
    }
    
    // Listener per la lista dipendenti
    const listDocRef = doc(db, 'weeks', week, 'lists', day);
    const listUnsubscribe = onSnapshot(listDocRef, async (docSnapshot) => {
      console.log('Lista dipendenti cambiata:', docSnapshot.exists());
      
      try {
        if (docSnapshot.exists()) {
        const newList = docSnapshot.data();
        console.log('Nuova lista:', newList);
        
        // Aggiorna sempre per riflettere in tempo reale le modifiche
        this.currentList = newList;
          await this.syncChecklistWithList();
          this.renderChecklist();
          console.log('Checklist aggiornata in tempo reale');
        } else {
        // Lista eliminata
        console.log('Lista eliminata');
        this.currentList = null;
        this.currentChecklist = { items: [], extras: [] };
        const checklistContainer = document.getElementById('checklistContainer');
        const emptyState = document.getElementById('emptyState');
        if (checklistContainer) checklistContainer.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Errore nel listener della lista dipendenti:', error);
      }
    }, (error) => {
      console.error('Errore nel listener della lista dipendenti:', error);
    });
    this.listenerUnsubscribes.push(listUnsubscribe);
    
    // Listener per la checklist warehouse (per sincronizzare modifiche del magazziniere)
    const warehouseDocRef = doc(db, 'weeks', week, 'warehouse', day);
    const warehouseUnsubscribe = onSnapshot(warehouseDocRef, (docSnapshot) => {
      console.log('Checklist warehouse cambiata:', docSnapshot.exists());
      
      try {
        if (docSnapshot.exists()) {
        const newChecklist = docSnapshot.data();
        console.log('Nuova checklist:', newChecklist);
        
        // Aggiorna solo se non è una modifica locale
        if (JSON.stringify(newChecklist) !== JSON.stringify(this.currentChecklist)) {
          this.currentChecklist = newChecklist;
          this.renderChecklist();
          console.log('UI aggiornata da modifica esterna');
        }
        }
      } catch (error) {
        console.error('Errore nel listener della checklist warehouse:', error);
      }
    }, (error) => {
      console.error('Errore nel listener della checklist warehouse:', error);
    });
    this.listenerUnsubscribes.push(warehouseUnsubscribe);
    
    // Listener per notifiche
    const notificationsRef = collection(db, 'notifications', notifDocId, 'entries');
    const notifUnsubscribe = onSnapshot(query(notificationsRef, orderBy('timestamp', 'desc')), (querySnapshot) => {
      console.log('Notifiche cambiate:', querySnapshot.size);
      
      try {
        this.notifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calcola non lette
      this.unreadCount = this.notifications.filter(n => !n.read).length;
      this.renderNotifications();
      console.log('Notifiche aggiornate:', this.unreadCount, 'non lette');
      } catch (error) {
        console.error('Errore nel listener delle notifiche:', error);
      }
    }, (error) => {
      console.error('Errore nel listener delle notifiche:', error);
    });
    this.listenerUnsubscribes.push(notifUnsubscribe);
  }
  
  computeCompletion() {
    const items = this.currentChecklist.items || [];
    const extras = this.currentChecklist.extras || [];
    const all = items.concat(extras);
    const total = all.length || 0;
    const completed = all.filter(e => (e.qtyPicked || 0) >= (e.qtyRequested || 0)).length;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent, complete: total > 0 && completed === total };
  }


  async syncChecklistWithList() {
    if (!this.currentList) return;
    
    console.log('Sincronizzando checklist con lista...');
    
    const week = getWeekString(this.selectedDate);
    const day = formatDate(this.selectedDate);
    
    // Aggiorna items esistenti e aggiungi nuovi
    const updatedItems = this.currentList.items.map(listItem => {
      const existingItem = this.currentChecklist.items.find(ci => ci.id === listItem.id);
      return existingItem ? { ...existingItem, qtyRequested: listItem.quantity, prepared: (existingItem.qtyPicked || 0) >= listItem.quantity } :
        { id: listItem.id, qtyRequested: listItem.quantity, qtyPicked: 0, prepared: false };
    });
    
    const updatedExtras = this.currentList.extras.map(listExtra => {
      const existingExtra = (this.currentChecklist.extras || []).find(ce => ce.name === listExtra.name);
      return existingExtra ? { ...existingExtra, qtyRequested: listExtra.quantity, prepared: (existingExtra.qtyPicked || 0) >= listExtra.quantity } :
        { name: listExtra.name, qtyRequested: listExtra.quantity, qtyPicked: 0, prepared: false };
    });
    
    // Rimuovi items che non sono più nella lista
    const validItemIds = this.currentList.items.map(item => item.id);
    const filteredItems = updatedItems.filter(item => validItemIds.includes(item.id));
    
    // Rimuovi extras che non sono più nella lista
    const validExtraNames = this.currentList.extras.map(extra => extra.name);
    const filteredExtras = updatedExtras.filter(extra => validExtraNames.includes(extra.name));
    
    this.currentChecklist.items = filteredItems;
    this.currentChecklist.extras = filteredExtras || [];
    
    console.log('Checklist sincronizzata:', this.currentChecklist);
    
    // Salva checklist aggiornata
    await setDoc(doc(db, 'weeks', week, 'warehouse', day), this.currentChecklist);
  }

  renderNotifications() {
    const panel = safeQuerySelector('#notificationPanel');
    const badge = safeQuerySelector('#notificationBadge');
    const list = safeQuerySelector('#notificationList');
    
    if (!panel || !badge || !list) {
      console.warn('Elementi notifiche non trovati');
      return;
    }
    
    if (this.notifications.length === 0) {
      panel.classList.add('hidden');
      return;
    }
    
    panel.classList.remove('hidden');
    badge.textContent = `${this.unreadCount} non lette`;
    
    // Separa lette e non lette
    const unreadNotifications = this.notifications.filter(n => !n.read);
    const readNotifications = this.notifications.filter(n => n.read);
    
    list.innerHTML = '';
    
    // Mostra non lette prima
    [...unreadNotifications, ...readNotifications].forEach(notification => {
      const notifEl = this.createNotificationElement(notification);
      list.appendChild(notifEl);
    });
  }

  createNotificationElement(notification) {
    const div = document.createElement('div');
    div.className = `notification-item notification-${notification.type.replace(/([A-Z])/g, '-$1').toLowerCase()} ${notification.read ? 'read' : ''}`;
    
    let icon = '';
    let message = '';
    
    switch (notification.type) {
      case 'added':
        icon = '✅';
        message = `Aggiunto: ${notification.name} (${notification.quantity})`;
        break;
      case 'removed':
        icon = '❌';
        message = `Rimosso: ${notification.name} (era ${notification.quantity})`;
        break;
      case 'qtyChanged':
        icon = '🔄';
        message = `${notification.name}: ${notification.oldQuantity} → ${notification.newQuantity}`;
        break;
      case 'extraAdded':
        icon = '➕';
        message = `Extra aggiunto: ${notification.name} (${notification.quantity})`;
        break;
      case 'extraRemoved':
        icon = '➖';
        message = `Extra rimosso: ${notification.name} (era ${notification.quantity})`;
        break;
      case 'extraChanged':
        icon = '🔄';
        message = `Extra ${notification.name}: ${notification.oldQuantity} → ${notification.newQuantity}`;
        break;
    }
    
    div.innerHTML = `
      <div class="flex justify-between">
        <div>
          <span style="margin-right: 0.5rem;">${icon}</span>
          ${message}
        </div>
        ${!notification.read ? `
          <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" 
                  onclick="window.magazzinoManager.markNotificationRead('${notification.id}')">
            Segna come letta
          </button>
        ` : ''}
      </div>
      <div class="text-muted" style="font-size: 0.875rem; margin-top: 0.25rem;">
        ${(notification.timestamp && notification.timestamp.toDate ? notification.timestamp.toDate().toLocaleString() : '')}
      </div>
    `;
    
    return div;
  }

  renderChecklist() {
    const container = safeQuerySelector('#checklistContainer');
    
    if (!container) {
      console.error('Container checklistContainer non trovato');
      return;
    }
    
    if (!this.currentList) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = `
      <div class="flex justify-between mb-3" style="align-items:center;">
        <h2>📋 Checklist Prodotti</h2>
        <div id="listStatus" style="min-width: 260px;">
          <div class="flex justify-between" style="font-size: 0.9rem;">
            <span class="text-secondary">Stato lista</span>
            <span id="statusText"></span>
          </div>
          <div style="height: 10px; background: var(--bg-tertiary); border-radius: 6px; overflow: hidden;">
            <div id="statusBar" style="height: 10px; width: 0%; background: #22c55e; transition: width .2s;"></div>
          </div>
        </div>
        <button id="deleteListBtn" class="btn btn-error" style="padding: 0.5rem 1rem;">
          🗑️ Elimina Lista
        </button>
      </div>
    `;
    
    // Aggiungi event listener per eliminazione
    const deleteListBtn = safeQuerySelector('#deleteListBtn');
    if (deleteListBtn) {
      safeAddEventListener(deleteListBtn, 'click', () => {
        this.deleteList();
      });
    }
    
    
    // Aggiorna stato/progresso lista
    const st = this.computeCompletion();
    const statusTextEl = safeQuerySelector('#statusText');
    const statusBarEl = safeQuerySelector('#statusBar');
    if (statusTextEl && statusBarEl) {
      statusTextEl.textContent = `${st.completed}/${st.total} completati (${st.percent}%)`;
      statusBarEl.style.width = `${st.percent}%`;
    }
    if (st.complete) {
      const banner = document.createElement('div');
      banner.innerHTML = '✅ Lista completa!';
      banner.style.background = 'rgba(34, 197, 94, 0.15)';
      banner.style.border = '1px solid #22c55e';
      banner.style.color = '#16a34a';
      banner.style.padding = '0.5rem 0.75rem';
      banner.style.borderRadius = '6px';
      banner.style.marginBottom = '0.5rem';
      container.prepend(banner);
    }
// Raggruppa per categoria
    const groupedItems = {};
    
    this.currentChecklist.items.forEach(item => {
      const product = this.products.find(p => p.id === item.id);
      if (!product) return;
      
      const categoryId = product.categoryId;
      if (!groupedItems[categoryId]) {
        groupedItems[categoryId] = [];
      }
      groupedItems[categoryId].push({ ...item, product });
    });
    
    // Render categorie
    Object.entries(groupedItems).forEach(([categoryId, items]) => {
      const category = this.categories.find(c => c.id === categoryId);
      if (!category) return;
      
      const categorySection = document.createElement('div');
      categorySection.className = 'mb-4';
      
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'flex justify-between mb-2';
      categoryHeader.innerHTML = `
        <h3 style="color: ${category.colorHex};">📂 ${category.name}</h3>
        <button class="btn btn-primary" onclick="window.magazzinoManager.markCategoryComplete('${categoryId}')" 
                style="padding: 0.5rem 1rem;">Segna tutti</button>
      `;
      categorySection.appendChild(categoryHeader);
      
      items.forEach(item => {
        const itemCard = this.createChecklistItemCard(item);
        categorySection.appendChild(itemCard);
      });
      
      container.appendChild(categorySection);
    });
    
    // Render extras
    if (this.currentChecklist.extras && this.currentChecklist.extras.length > 0) {
      const extrasSection = document.createElement('div');
      extrasSection.className = 'mb-4';
      
      const extrasHeader = document.createElement('h3');
      extrasHeader.textContent = '➕ Prodotti Extra';
      extrasHeader.className = 'mb-2';
      extrasSection.appendChild(extrasHeader);
      
      this.currentChecklist.extras.forEach((extra, index) => {
        const extraCard = this.createExtraItemCard(extra, index);
        extrasSection.appendChild(extraCard);
      });
      
      container.appendChild(extrasSection);
    }
  }

  createChecklistItemCard(item) {
    if (!item || !item.product) {
      console.warn('Item o product mancante per card checklist');
      return document.createElement('div');
    }
    
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const isComplete = item.qtyPicked >= item.qtyRequested;
    const backgroundStyle = isComplete ? 'background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e;' : 'background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444;';
    
    card.innerHTML = `
      <div class="flex justify-between" style="${backgroundStyle} padding: 1rem; border-radius: 6px;">
        <div style="flex: 1;">
          <div class="product-name ${isComplete ? 'text-success' : ''}">
            ${item.product.name}
            ${isComplete ? ' ✅' : ''}
          </div>
          <div class="text-secondary">
            Richiesto: ${item.qtyRequested} | Preparato: ${item.qtyPicked}
          </div>
        </div>
        <div class="flex" style="align-items: center; gap: 1rem;">
          <input type="number" value="${item.qtyPicked}" min="0" max="${item.qtyRequested}" 
                 class="qty-input" style="width: 80px;"
                 onchange="window.magazzinoManager.updatePickedQuantity('${item.id}', parseInt(this.value) || 0)">
          <button class="btn ${item.prepared ? 'btn-success' : 'btn-secondary'}" 
                  onclick="window.magazzinoManager.toggleItemPrepared('${item.id}')"
                  style="padding: 0.5rem 1rem;">
            ${item.prepared ? 'Completato' : 'Prepara'}
          </button>
        </div>
      </div>
    `;
    
    return card;
  }

  createExtraItemCard(extra, index) {
    if (!extra || typeof index !== 'number') {
      console.warn('Extra o index mancante per card extra');
      return document.createElement('div');
    }
    
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const isComplete = extra.qtyPicked >= extra.qtyRequested;
    const backgroundStyle = isComplete ? 'background: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e;' : 'background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444;';
    
    card.innerHTML = `
      <div class="flex justify-between" style="${backgroundStyle} padding: 1rem; border-radius: 6px;">
        <div style="flex: 1;">
          <div class="product-name ${isComplete ? 'text-success' : ''}">
            ${extra.name}
            ${isComplete ? ' ✅' : ''}
          </div>
          <div class="text-secondary">
            Richiesto: ${extra.qtyRequested} | Preparato: ${extra.qtyPicked}
          </div>
        </div>
        <div class="flex" style="align-items: center; gap: 1rem;">
          <input type="number" value="${extra.qtyPicked}" min="0" max="${extra.qtyRequested}" 
                 class="qty-input" style="width: 80px;"
                 onchange="window.magazzinoManager.updateExtraPickedQuantity(${index}, parseInt(this.value) || 0)">
          <button class="btn ${extra.prepared ? 'btn-success' : 'btn-secondary'}" 
                  onclick="window.magazzinoManager.toggleExtraPrepared(${index})"
                  style="padding: 0.5rem 1rem;">
            ${extra.prepared ? 'Completato' : 'Prepara'}
          </button>
        </div>
      </div>
    `;
    
    return card;
  }

  async updatePickedQuantity(itemId, newQuantity) {
    // Validazione parametri
    if (!itemId) {
      console.error('ID item mancante');
      return;
    }
    
    const item = this.currentChecklist.items.find(i => i.id === itemId);
    if (!item) return;
    
    console.log(`Aggiornando quantità per ${itemId}: ${item.qtyPicked} -> ${newQuantity}`);
    
    // Validazione input con utility
    const qtyValidation = validateInput(newQuantity, 'number', { min: 0, max: item.qtyRequested });
    if (!qtyValidation.valid) {
      showToast(qtyValidation.error, 'error');
      return;
    }
    
    item.qtyPicked = qtyValidation.value;
    item.prepared = item.qtyPicked >= item.qtyRequested;
    
    await this.saveChecklist();
    
    // Forza re-render immediato per aggiornare colori
    setTimeout(() => {
      this.renderChecklist();
      console.log('UI aggiornata dopo modifica quantità');
    }, 100);
  }
  async deleteList() {
    // Miglioramento UX per mobile
    const confirmMessage = isMobile() 
      ? 'Eliminare la lista di oggi?\n\nL\'azione non può essere annullata.'
      : 'Sei sicuro di voler eliminare la lista di oggi? L\'azione non può essere annullata.';
      
    try {
      const confirmDelete = window.confirm(confirmMessage);
      if (!confirmDelete) return;

      // Disiscrivi eventuali listener attivi
      if (this.listenerUnsubscribes) {
        this.listenerUnsubscribes.forEach(unsub => {
          try { unsub(); } catch (e) { /* ignore */ }
        });
      }

      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);

      // Elimina la checklist del magazzino e la lista dei dipendenti del giorno
      try {
        await deleteDoc(doc(db, 'weeks', week, 'warehouse', day));
      } catch (e) {
        console.warn('Nessuna checklist da eliminare o errore non bloccante:', e);
      }
      try {
        await deleteDoc(doc(db, 'weeks', week, 'lists', day));
      } catch (e) {
        console.warn('Nessuna lista dipendenti da eliminare o errore non bloccante:', e);
      }

      // Reset stato locale e UI
      this.currentList = null;
      this.currentChecklist = { items: [], extras: [] };
      this.notifications = [];
      this.unreadCount = 0;

      const container = safeQuerySelector('#checklistContainer');
      const emptyState = safeQuerySelector('#emptyState');
      const loading = safeQuerySelector('#loadingList');
      if (container) container.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
      if (loading) loading.classList.add('hidden');

      showToast('Lista eliminata correttamente', 'success');
    } catch (error) {
      console.error('Errore durante l\'eliminazione della lista:', error);
      showToast('Errore durante l\'eliminazione della lista', 'error');
    }
  }



  
  async saveChecklist() {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      await setDoc(doc(db, 'weeks', week, 'warehouse', day), this.currentChecklist);
      console.log('Checklist salvata');
    } catch (error) {
      console.error('Errore salvataggio checklist:', error);
      showToast('Errore nel salvataggio', 'error');
    }
  }

async updateExtraPickedQuantity(extraIndex, newQuantity) {
    // Validazione parametri
    if (extraIndex < 0 || !this.currentChecklist.extras || extraIndex >= this.currentChecklist.extras.length) {
      console.error('Indice extra non valido:', extraIndex);
      return;
    }
    
    if (!this.currentChecklist.extras[extraIndex]) return;
    
    console.log(`Aggiornando quantità extra ${extraIndex}: ${this.currentChecklist.extras[extraIndex].qtyPicked} -> ${newQuantity}`);
    
    const extra = this.currentChecklist.extras[extraIndex];
    
    // Validazione input con utility
    const qtyValidation = validateInput(newQuantity, 'number', { min: 0, max: extra.qtyRequested });
    if (!qtyValidation.valid) {
      showToast(qtyValidation.error, 'error');
      return;
    }
    
    extra.qtyPicked = qtyValidation.value;
    extra.prepared = extra.qtyPicked >= extra.qtyRequested;
    
    await this.saveChecklist();
    
    // Forza re-render immediato per aggiornare colori
    setTimeout(() => {
      this.renderChecklist();
      console.log('UI aggiornata dopo modifica quantità extra');
    }, 100);
  }

  async toggleItemPrepared(itemId) {
    if (!itemId) {
      console.error('ID item mancante');
      return;
    }
    
    const item = this.currentChecklist.items.find(i => i.id === itemId);
    if (!item) return;

    if (item.qtyPicked < item.qtyRequested) {
      item.qtyPicked = item.qtyRequested;
    }
    item.prepared = item.qtyPicked >= item.qtyRequested;

    await this.saveChecklist();
    this.renderChecklist();
  }
  
  async toggleExtraPrepared(extraIndex) {
    if (extraIndex < 0 || !this.currentChecklist.extras || extraIndex >= this.currentChecklist.extras.length) {
      console.error('Indice extra non valido:', extraIndex);
      return;
    }
    
    const extra = this.currentChecklist.extras[extraIndex];
    if (!extra) return;

    if (extra.qtyPicked < extra.qtyRequested) {
      extra.qtyPicked = extra.qtyRequested;
    }
    extra.prepared = extra.qtyPicked >= extra.qtyRequested;

    await this.saveChecklist();
    this.renderChecklist();
  }
  
  async markCategoryComplete(categoryId) {
    if (!categoryId) {
      console.error('ID categoria mancante');
      return;
    }
    
    try {
      // Trova tutti gli items di questa categoria
      const categoryItems = this.currentChecklist.items.filter(item => {
        const product = this.products.find(p => p.id === item.id);
        return product && product.categoryId === categoryId;
      });
      
      // Segna tutti come completati
      categoryItems.forEach(item => {
        item.qtyPicked = item.qtyRequested;
        item.prepared = true;
      });
      
      await this.saveChecklist();
      this.renderChecklist();
      showToast('Categoria completata!', 'success');
    } catch (error) {
      console.error('Errore nel completamento categoria:', error);
      showToast('Errore nel completamento categoria', 'error');
    }
  }
  
  async markNotificationRead(notificationId) {
    if (!notificationId) {
      console.error('ID notifica mancante');
      return;
    }
    
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      const notifDocId = `${week}_${day}`;
      
      await updateDoc(doc(db, 'notifications', notifDocId, 'entries', notificationId), {
        read: true
      });
      
      showToast('Notifica segnata come letta', 'success');
    } catch (error) {
      console.error('Errore nel segnare notifica come letta:', error);
      showToast('Errore nell\'aggiornamento notifica', 'error');
    }
  }
  
  async markAllNotificationsRead() {
    try {
      const week = getWeekString(this.selectedDate);
      const day = formatDate(this.selectedDate);
      const notifDocId = `${week}_${day}`;
      
      const unreadNotifications = this.notifications.filter(n => !n.read);
      
      for (const notification of unreadNotifications) {
        await updateDoc(doc(db, 'notifications', notifDocId, 'entries', notification.id), {
          read: true
        });
      }
      
      // Aggiorna counter
      await setDoc(doc(db, 'notifications', notifDocId), {
        unreadCount: 0,
        lastUpdate: Timestamp.now()
      }, { merge: true });
      
      showToast('Tutte le notifiche segnate come lette', 'success');
    } catch (error) {
      console.error('Errore nel segnare tutte le notifiche come lette:', error);
      showToast('Errore nell\'aggiornamento notifiche', 'error');
    }
  }

}

// Inizializza l'applicazione
window.magazzinoManager = new MagazzinoManager();