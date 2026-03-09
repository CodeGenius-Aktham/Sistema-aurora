// --- VARIABLES GLOBALES ---
const API_URL = 'http://localhost:3000'; // Agrega esto al principio si no está
let inventory = [];
let cart = []; // <--- ESTA ES LA QUE FALTA
let salesHistory = [];
let tasa = 36.50;

// ... el resto de tu código

async function fetchAllData() {
    try {
        const res = await fetch(`${API_URL}/api/datos`);
        const data = await res.json();

        inventory = data.inventory || [];
        salesHistory = data.sales || [];
        
        // Refrescar vistas
        renderInventory();
        renderSalesHistory();
        renderCart();
        updateDashboard();
        console.log("Datos sincronizados con SQLite");
    } catch (err) {
        console.error("Error cargando datos:", err);
        alert("No se pudo conectar con el servidor Aurora.");
    }
}
// Se ejecuta al cargar


// --- RENDERIZADO DE HISTORIAL ---
function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    salesHistory.forEach(sale => {
        // El servidor devuelve 'total' para USD y 'items' como array de objetos
        const detalleProductos = sale.items ? sale.items.map(i => `${i.name} (x${i.cantidad})`).join(' | ') : 'Sin detalle';
        const totalVentaUsd = sale.total || 0;
        const totalVentaBs = sale.totalBs || 0;
        
        const row = `
            <tr class="border-b border-white/5 text-xs text-slate-300 hover:bg-white/5">
                <td class="px-4 py-3">${sale.fecha}</td>
                <td class="px-4 py-3 font-mono text-orange-500">${sale.id}</td>
                <td class="px-4 py-3 max-w-[250px] truncate" title="${detalleProductos}">${detalleProductos}</td>
                <td class="px-4 py-3 text-right font-mono text-white">$${totalVentaUsd.toFixed(2)}</td>
                <td class="px-4 py-3 text-right font-mono text-orange-400">${totalVentaBs.toFixed(2)} Bs</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
    });
}



async function saveData() {
    try {
        const response = await fetch('http://localhost:3000/api/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inventory, salesHistory, tasa })
        });

        if (!response.ok) throw new Error("Error en el servidor");
        console.log("Datos persistidos en SQLite.");
    } catch (err) {
        console.error("Error al guardar:", err);
    }
}

// 3. Asegura el flujo de inicio:
window.onload = async () => {
    // Primero traemos los datos del servidor
    await fetchAllData();
    // Luego inicializamos los iconos
    lucide.createIcons();
};



// --- UI MODALS ---

function showErrorModal(code) {

    document.getElementById('error-message').innerHTML = `El código <b class="text-orange-500 font-mono">${code}</b> ya está registrado en el inventario. Verifique los datos e intente nuevamente.`;

    document.getElementById('modal-error').classList.remove('hidden');

}



function closeErrorModal() {

    document.getElementById('modal-error').classList.add('hidden');

}



// --- NAVEGACIÓN ---

function showSection(sectionId) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.remove('active', 'bg-slate-900', 'border-l-2', 'border-orange-500');
    });
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('active', 'bg-slate-900', 'border-l-2', 'border-orange-500');
}



function toggleLoadMode(mode) {

    const isSingle = mode === 'single';

    document.getElementById('load-single').classList.toggle('hidden', !isSingle);

    document.getElementById('load-bulk').classList.toggle('hidden', isSingle);

    document.getElementById('btn-mode-single').className = isSingle ? 'px-5 py-2 rounded-lg text-xs font-bold bg-orange-600 text-white' : 'px-5 py-2 rounded-lg text-xs font-bold text-slate-500';

    document.getElementById('btn-mode-bulk').className = !isSingle ? 'px-5 py-2 rounded-lg text-xs font-bold bg-orange-600 text-white' : 'px-5 py-2 rounded-lg text-xs font-bold text-slate-500';

}



// --- INVENTARIO ---

// Agregamos 'async' al inicio
async function addProduct() {
    const name = document.getElementById('p-name').value.trim();
    const code = document.getElementById('p-code').value.trim();
    const price = parseFloat(document.getElementById('p-price').value);
    const qty = parseInt(document.getElementById('p-qty').value);
    const image = document.getElementById('p-image').value || 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=200&auto=format&fit=crop';

    if (!name || !code || isNaN(price) || isNaN(qty)) {
        return alert("Nombre, código, precio y cantidad son obligatorios.");
    }

    const isDuplicate = inventory.some(p => p.code.toLowerCase() === code.toLowerCase());
    if (isDuplicate) {
        showErrorModal(code);
        return;
    }

    const product = {
        id: Date.now(),
        name,
        code,
        price,
        qty,
        image,
        sold: 0
    };

    // --- AQUÍ ESTÁ EL CAMBIO CRÍTICO ---
    try {
        const response = await fetch('http://localhost:3000/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });

        if (response.ok) {
            inventory.push(product); // Actualizamos el array local
            renderInventory(); // Refrescamos la tabla
            // Limpiar campos
            ['p-name', 'p-code', 'p-price', 'p-qty', 'p-image'].forEach(id => document.getElementById(id).value = '');
        } else {
            alert("Error al guardar en la base de datos.");
        }
    } catch (err) {
        alert("No se pudo conectar con el servidor. Asegúrate de que el archivo .exe esté corriendo.");
    }
}


// Modal para ajustar stock (agregar o eliminar)
function showAdjustStockModal(id) {
    // Si ya existe el modal, solo mostrarlo y guardar el id
    let modal = document.getElementById('modal-adjust-stock');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-adjust-stock';
        modal.className = 'fixed inset-0 z-[102] hidden flex items-center justify-center p-4';
        modal.innerHTML = `
            <div id="modal-overlay" class="absolute inset-0"></div>
            <div class="aurora-card relative w-full max-w-md p-8 border-orange-500/30 text-center animate-in zoom-in duration-300">
            <div class="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <i data-lucide="package-plus" class="text-orange-500 w-10 h-10" id="adjust-stock-icon"></i>
            </div>
            <h3 class="text-2xl font-black text-white mb-2" id="adjust-stock-title">Ajustar Stock</h3>
            <div class="flex justify-center gap-3 mb-6">
                <button id="btn-add-stock" class="px-4 py-2 rounded-lg font-bold bg-orange-600 text-white transition-all">Agregar</button>
                <button id="btn-remove-stock" class="px-4 py-2 rounded-lg font-bold bg-rose-600 text-white transition-all">Eliminar</button>
            </div>
            <input type="number" id="adjust-stock-qty" class="w-full text-2xl font-black text-center py-4 mb-6" placeholder="Cantidad" min="1">
            <div class="flex gap-3">
                <button onclick="closeAdjustStockModal()" class="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all">Cancelar</button>
                <button id="btn-confirm-adjust-stock" class="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl transition-all">Confirmar</button>
            </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    // Estado del tipo de ajuste (agregar/eliminar)
    let mode = 'add';
    const icon = modal.querySelector('#adjust-stock-icon');
    const title = modal.querySelector('#adjust-stock-title');
    const btnAdd = modal.querySelector('#btn-add-stock');
    const btnRemove = modal.querySelector('#btn-remove-stock');
    const qtyInput = modal.querySelector('#adjust-stock-qty');
    const btnConfirm = modal.querySelector('#btn-confirm-adjust-stock');
    qtyInput.value = '';
    qtyInput.min = 1;
    // Estilo inicial
    btnAdd.classList.add('ring-2', 'ring-orange-400');
    btnRemove.classList.remove('ring-2', 'ring-rose-400');
    icon.setAttribute('data-lucide', 'package-plus');
    icon.className = 'text-orange-500 w-10 h-10';
    title.innerText = 'Ajustar Stock';
    // Cambiar a agregar
    btnAdd.onclick = () => {
        mode = 'add';
        btnAdd.classList.add('ring-2', 'ring-orange-400');
        btnRemove.classList.remove('ring-2', 'ring-rose-400');
        icon.setAttribute('data-lucide', 'package-plus');
        icon.className = 'text-orange-500 w-10 h-10';
        title.innerText = 'Agregar Stock';
        qtyInput.value = '';
        qtyInput.min = 1;
        lucide.createIcons();
    };
    // Cambiar a eliminar
    btnRemove.onclick = () => {
        mode = 'remove';
        btnRemove.classList.add('ring-2', 'ring-rose-400');
        btnAdd.classList.remove('ring-2', 'ring-orange-400');
        icon.setAttribute('data-lucide', 'package-minus');
        icon.className = 'text-rose-500 w-10 h-10';
        title.innerText = 'Eliminar Stock';
        qtyInput.value = '';
        qtyInput.min = 1;
        lucide.createIcons();
    };
    // Confirmar ajuste
    btnConfirm.onclick = function () {
        const qty = parseInt(qtyInput.value);
        if (isNaN(qty) || qty < 1) {
            qtyInput.focus();
            return;
        }
        adjustStockConfirmed(id, mode, qty);
    };
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeAdjustStockModal() {
    const modal = document.getElementById('modal-adjust-stock');
    if (modal) modal.classList.add('hidden');
}

function adjustStock(id, delta) {
    // Ahora muestra el modal en vez de ajustar directamente
    showAdjustStockModal(id);
}

async function adjustStockConfirmed(id, mode, qty) {
    const product = inventory.find(p => p.id === id);
    if (!product) return;

    let newQty = mode === 'add' ? product.qty + qty : Math.max(0, product.qty - qty);

    try {
        await fetch(`${API_URL}/api/productos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qty: newQty })
        });
        await fetchAllData();
        closeAdjustStockModal();
    } catch (err) { console.error(err); }
}


// Modal de Confirmación de Eliminación
function showDeleteModal(id) {
    // Si ya existe el modal, solo mostrarlo y guardar el id
    let modal = document.getElementById('modal-delete');
    if (!modal) {
        // Crear el modal si no existe
        modal = document.createElement('div');
        modal.id = 'modal-delete';
        modal.className = 'fixed inset-0 z-[101] hidden flex items-center justify-center p-4';
        modal.innerHTML = `
                <div id="modal-overlay" class="absolute inset-0"></div>
                <div class="aurora-card relative w-full max-w-md p-8 border-rose-500/30 text-center animate-in zoom-in duration-300">
                <div class="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i data-lucide="trash-2" class="text-orange-500 w-10 h-10"></i>
                </div>
                <h3 class="text-2xl font-black text-white mb-2">Eliminar Producto</h3>
                <p class="text-slate-400 mb-8" id="delete-message">¿Estás seguro que deseas eliminar este repuesto del inventario? Esta acción no se puede deshacer.</p>
                <div class="flex gap-3">
                    <button onclick="closeDeleteModal()" class="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all">Cancelar</button>
                    <button id="btn-confirm-delete" class="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all">Eliminar</button>
                </div>
                </div>
            `;
        document.body.appendChild(modal);
    }
    // Guardar el id a eliminar en el botón
    const btn = modal.querySelector('#btn-confirm-delete');
    btn.onclick = function () {
        deleteProductConfirmed(id);
    };
    modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeDeleteModal() {
    const modal = document.getElementById('modal-delete');
    if (modal) modal.classList.add('hidden');
}

function deleteProduct(id) {
    showDeleteModal(id);
}

async function deleteProductConfirmed(id) {
    try {
        await fetch(`${API_URL}/api/productos/${id}`, { method: 'DELETE' });
        await fetchAllData();
        closeDeleteModal();
    } catch (err) { console.error(err); }
}


// --- GESTIÓN DE INVENTARIO ---
function renderInventory() {
    const searchInput = document.getElementById('inventory-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const body = document.getElementById('inventory-table-body');
    if (!body) return;

    const filtered = inventory.filter(p => 
        p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)
    );

    body.innerHTML = filtered.map(p => `
        <tr class="hover:bg-white/5 transition-all border-b border-white/5">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <img src="${p.image}" class="w-10 h-10 rounded-lg object-cover border border-white/10" onerror="this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=200&auto=format&fit=crop'">
                    <div>
                        <div class="font-bold text-white text-sm">${p.name}</div>
                        <div class="text-[10px] text-slate-500 font-mono">${p.id}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="text-xs font-mono text-orange-500 font-bold bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">${p.code}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col items-center gap-1">
                    <button onclick="showAdjustStockModal(${p.id})" class="qty-control bg-slate-900 px-4 py-1 rounded-lg text-white font-black hover:bg-orange-600 transition-all">
                        ${p.qty}
                    </button>
                    <span class="text-[8px] font-bold uppercase ${p.qty < 5 ? 'text-rose-500' : 'text-slate-500'}">
                        ${p.qty < 5 ? 'Stock Crítico' : 'Disponible'}
                    </span>
                </div>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="font-black text-white">$${p.price.toFixed(2)}</div>
                <div class="text-[10px] text-slate-500 font-bold">${(p.price * tasa).toFixed(2)} BS</div>
            </td>
            <td class="px-6 py-4 text-right">
                <button onclick="deleteProduct(${p.id})" class="text-slate-600 hover:text-rose-500 p-2">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (window.lucide) lucide.createIcons();
}


function processBulk() {

    const lines = document.getElementById('bulk-data').value.trim().split('\n');

    let skipped = 0;



    lines.forEach(line => {

        const [name, code, price, qty, img] = line.split(',').map(s => s.trim());



        if (name && price && code) {

            // Verificación de duplicados en bulk

            const isDuplicate = inventory.some(p => p.code.toLowerCase() === code.toLowerCase());



            if (!isDuplicate) {

                inventory.push({

                    id: Date.now() + Math.random(),

                    name,

                    code: code,

                    price: parseFloat(price) || 0,

                    qty: parseInt(qty) || 0,

                    image: img || '',

                    sold: 0

                });

            } else {

                skipped++;

            }

        }

    });



    if (skipped > 0) {

        alert(`Importación finalizada. Se omitieron ${skipped} productos por tener códigos duplicados.`);

    }



    document.getElementById('bulk-data').value = '';

    saveData();

    renderInventory();

}



// --- POS ---

// --- BÚSQUEDA AVANZADA POS ---

function advancedSearch(query) {
    const resultsContainer = document.getElementById('pos-results');
    const q = query.toLowerCase().trim();

    if (q.length === 0) {
        resultsContainer.classList.add('hidden');
        return;
    }

    const matches = inventory.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
    );

    renderSearchOptions(matches);
}

// Función para mostrar TODOS los productos al presionar la lupa
function toggleAllProducts() {
    const resultsContainer = document.getElementById('pos-results');
    if (!resultsContainer.classList.contains('hidden')) {
        resultsContainer.classList.add('hidden');
    } else {
        renderSearchOptions(inventory);
        document.getElementById('pos-search').focus();
    }
}

function renderSearchOptions(products) {
    const container = document.getElementById('pos-results');
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-500">No hay coincidencias</div>`;
    } else {
        container.innerHTML = products.map(p => `
            <div onclick="addToCartById('${p.id}')" 
                 class="flex items-center justify-between p-4 hover:bg-orange-600/10 cursor-pointer border-b border-white/5 transition-colors group">
                <div class="flex items-center gap-4 pointer-events-none">
                    <img src="${p.image}" class="w-12 h-12 rounded-lg object-cover border border-white/10" onerror="this.src='https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?q=80&w=200&auto=format&fit=crop'">
                    <div>
                        <div class="font-bold text-white group-hover:text-orange-400">${p.name}</div>
                        <div class="text-xs text-slate-500 font-mono">${p.code} • Stock: ${p.qty}</div>
                    </div>
                </div>
                <div class="text-right pointer-events-none">
                    <div class="font-black text-white">$${parseFloat(p.price).toFixed(2)}</div>
                </div>
            </div>
        `).join('');
    }
    container.classList.remove('hidden');
}

function addToCartById(id) {
    console.log("Intentando agregar ID:", id);
    console.log("Estado actual del inventario:", inventory);

    // Buscamos el producto
    const product = inventory.find(p => String(p.id) === String(id));

    if (!product) {
        alert("Error: El producto no existe en el inventario cargado.");
        console.error("Producto no encontrado para el ID:", id);
        return;
    }

    if (product.qty <= 0) {
        alert("Este producto no tiene stock disponible.");
        return;
    }

    const exists = cart.find(i => String(i.id) === String(id));

    if (exists) {
        if (exists.cartQty < product.qty) {
            exists.cartQty++;
        } else {
            alert("Límite de stock alcanzado.");
        }
    } else {
        // Clonamos el producto y añadimos cantidad inicial
        cart.push({ ...product, cartQty: 1 });
    }

    console.log("Producto añadido. Carrito actual:", cart);
    renderCart();
    
    // Limpiar y cerrar buscador
    document.getElementById('pos-results').classList.add('hidden');
    document.getElementById('pos-search').value = '';
}


function renderCart() {
    const body = document.getElementById('cart-body');
    const totalUsdElem = document.getElementById('total-usd');
    const totalBsElem = document.getElementById('total-bs');

    if (!body) {
        console.error("Error: No se encontró el elemento 'cart-body'.");
        return;
    }

    let total = 0;

    if (cart.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="py-10 text-center text-slate-500 text-xs uppercase tracking-widest font-bold">El carrito está vacío</td></tr>`;
    } else {
        body.innerHTML = cart.map(item => {
            const sub = item.price * item.cartQty;
            total += sub;
            return `
                <tr class="border-b border-white/5">
                    <td class="py-4">
                        <div class="flex items-center gap-3">
                            <img src="${item.image}" class="w-10 h-10 rounded-lg object-cover border border-white/10">
                            <div>
                                <div class="font-bold text-white text-sm">${item.name}</div>
                                <div class="text-[10px] text-slate-500">${item.code}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="updateQty('${item.id}', -1)" class="w-6 h-6 rounded bg-slate-800 text-white hover:bg-orange-600 transition-colors">-</button>
                            <span class="font-bold text-sm min-w-[20px] text-white">${item.cartQty}</span>
                            <button onclick="updateQty('${item.id}', 1)" class="w-6 h-6 rounded bg-slate-800 text-white hover:bg-orange-600 transition-colors">+</button>
                        </div>
                    </td>
                    <td class="py-4 text-right font-bold text-orange-400">$${sub.toFixed(2)}</td>
                    <td class="py-4 text-right">
                        <button onclick="updateQty('${item.id}', -999)" class="text-slate-600 hover:text-rose-500 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    if (totalUsdElem) totalUsdElem.innerText = `$${total.toFixed(2)}`;
    if (totalBsElem) totalBsElem.innerText = (total * tasa).toLocaleString(undefined, { minimumFractionDigits: 2 });

    if (window.lucide) lucide.createIcons();
}


function updateQty(id, delta) {
    const item = cart.find(i => String(i.id) === String(id));
    const original = inventory.find(i => String(i.id) === String(id));

    if (!item || !original) return;

    item.cartQty += delta;

    if (item.cartQty <= 0) {
        cart = cart.filter(i => String(i.id) !== String(id));
    } else if (item.cartQty > original.qty) {
        item.cartQty = original.qty;
    }

    renderCart();
}


function clearCart() { cart = []; renderCart(); }























// --- GESTIÓN DE VENTAS (POS) ---
async function checkout() {
    if (cart.length === 0) return alert("El carrito está vacío.");
    
    const totalUsd = cart.reduce((acc, item) => acc + (item.price * item.cartQty), 0);
    const totalBs = totalUsd * tasa;

    const payload = {
        totalUsd: totalUsd,
        totalBs: totalBs,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            cartQty: item.cartQty
        }))
    };

    try {
        const response = await fetch(`${API_URL}/api/ventas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Mostrar modal de éxito si existe
            const successModal = document.getElementById('modal-success');
            if (successModal) {
                document.getElementById('success-total-usd').innerText = `$${totalUsd.toFixed(2)}`;
                document.getElementById('success-total-bs').innerText = `${totalBs.toLocaleString()} Bs`;
                successModal.classList.remove('hidden');
            } else {
                alert("¡Venta realizada con éxito!");
            }

            cart = [];
            renderCart();
            await fetchAllData(); // Recarga stock e historial
        }
    } catch (err) {
        alert("Error de conexión al procesar venta.");
    }
}


















// --- DASHBOARD & TASA ---

async function updateTasa() {
    const val = parseFloat(document.getElementById('input-tasa').value);
    if (val > 0) {
        tasa = val;
        // Guardamos en el servidor en lugar de localStorage
        await saveData();

        document.getElementById('sidebar-tasa').children[0].innerText = tasa.toFixed(2);
        renderInventory();
        alert("Tasa actualizada y guardada.");
    }
}



function renderSalesByDay(filteredSales) {
    const tbody = document.getElementById('sales-by-day-body');
    if (!tbody) return;
    
    if (!filteredSales || filteredSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-500">No hay ventas para mostrar.</td></tr>`;
        return;
    }

    const dailyTotals = {};
    filteredSales.forEach(sale => {
        // CORRECCIÓN AQUÍ: Usar sale.fecha
        const date = new Date(sale.fecha); 
        const key = date.toISOString().slice(0, 10); 
        if (!dailyTotals[key]) dailyTotals[key] = 0;
        dailyTotals[key] += sale.total || 0;
    });

    tbody.innerHTML = Object.entries(dailyTotals)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, total]) => {
            const d = new Date(date);
            return `
                <tr class="border-b border-white/5">
                    <td class="px-4 py-2">${d.toLocaleDateString()}</td>
                    <td class="px-4 py-2 text-right font-mono font-bold text-orange-400">$${total.toFixed(2)}</td>
                    <td class="px-4 py-2 text-right font-mono font-bold">${(total * tasa).toLocaleString(undefined, { minimumFractionDigits: 2 })} Bs</td>
                </tr>
            `;
        }).join('');
}

function updateDashboard() {
    const statSales = document.getElementById('stat-sales-count');
    const statMoney = document.getElementById('stat-total-money');
    const statLow = document.getElementById('stat-low-count');
    const statQty = document.getElementById('stat-total-qty');

    if (statSales) statSales.innerText = salesHistory.length;
    
    const totalDineroUsd = inventory.reduce((acc, p) => acc + (p.price * p.qty), 0);
    if (statMoney) statMoney.innerText = `$${totalDineroUsd.toFixed(2)}`;
    
    const bajoStock = inventory.filter(p => p.qty < 5).length;
    if (statLow) statLow.innerText = bajoStock;
    
    const totalQty = inventory.reduce((acc, p) => acc + p.qty, 0);
    if (statQty) statQty.innerText = totalQty;
}

// --- INIT FINAL ---

// --- INICIO ÚNICO DEL SISTEMA ---
window.onload = async () => {
    await fetchAllData();
    // Inicializar UI
    if (document.getElementById('input-tasa')) document.getElementById('input-tasa').value = tasa;
    const sidebarTasa = document.getElementById('sidebar-tasa');
    if (sidebarTasa) sidebarTasa.children[0].innerText = tasa.toFixed(2);
    
    showSection('inventory'); // Mostrar inventario por defecto
    if (window.lucide) lucide.createIcons();
};



window.debugData = () => {
    console.group("--- Auditoría de Datos ---");
    console.log("Inventario cargado:", inventory.length, "productos.");
    console.log("Ventas cargadas:", salesHistory.length, "ventas.");
    
    if (salesHistory.length > 0) {
        console.table(salesHistory);
        console.log("Primer venta (ejemplo):", salesHistory[0]);
        console.log("¿Tiene items la primera venta?:", salesHistory[0].items ? "Sí" : "NO");
    } else {
        console.warn("No hay ventas en la variable salesHistory.");
    }
    console.groupEnd();
};


function showSaleSuccessModal(usd, bs) {
    document.getElementById('success-total-usd').innerText = `$${usd.toFixed(2)}`;
    document.getElementById('success-total-bs').innerText = `${bs.toLocaleString()} Bs`;
    document.getElementById('modal-success').classList.remove('hidden');
}

window.onload = fetchAllData;