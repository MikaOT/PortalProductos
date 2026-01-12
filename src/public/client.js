const state = {
    user: null,
    token: localStorage.getItem('token') || null,
    products: [],
    cart: JSON.parse(localStorage.getItem('cart')) || [],
};

// --- HELPER: TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="ph ${type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'}" style="font-size: 1.5rem; color: var(--${type})"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- API ---
async function gql(query, variables = {}) {
    try {
        const res = await fetch('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': state.token ? `Bearer ${state.token}` : ''
            },
            body: JSON.stringify({ query, variables })
        });
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        return json.data;
    } catch (e) {
        throw e;
    }
}

// --- AUTH ---
async function initAuth() {
    if (state.token) {
        try {
            const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${state.token}` } });
            if (res.ok) state.user = await res.json();
            else throw new Error('Sesión expirada');
        } catch (e) {
            logout();
        }
    }
    updateUI();
    if (state.user) loadShop();
}

function logout() {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    state.cart = [];
    localStorage.removeItem('cart');
    updateUI();
    showToast('Sesión cerrada correctamente', 'success');
}

function updateUI() {
    const isLogged = !!state.user;
    document.getElementById('authSection').classList.toggle('hidden', isLogged);
    document.getElementById('mainLayout').classList.toggle('hidden', !isLogged);
    document.getElementById('btnLogout').classList.toggle('hidden', !isLogged);
    document.getElementById('btnChat').classList.toggle('hidden', !isLogged);
    
    // Auth View Toggle buttons
    document.getElementById('btnLoginView').classList.toggle('hidden', isLogged);
    document.getElementById('btnRegisterView').classList.toggle('hidden', isLogged);

    // Admin checks
    if(state.user?.role === 'admin') {
        document.getElementById('adminPanel')?.classList.remove('hidden');
        document.getElementById('btnNewProduct')?.classList.remove('hidden'); // <--- NUEVO
        loadAdmin();
    } else {
        document.getElementById('adminPanel')?.classList.add('hidden');
        document.getElementById('btnNewProduct')?.classList.add('hidden'); // <--- NUEVO
    }
    renderCart();
}

document.getElementById('authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isRegister = document.getElementById('authTitle').textContent === 'Registro';
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username')?.value;
    
    try {
        const url = isRegister ? '/api/auth/register' : '/api/auth/login';
        const body = { email, password, username };
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.message);
        
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('token', data.token);
        document.getElementById('authMsg').textContent = '';
        updateUI();
        loadShop();
        showToast(`Bienvenido, ${data.user.username}`);
    } catch (err) {
        document.getElementById('authMsg').textContent = err.message;
        showToast(err.message, 'error');
    }
});

document.getElementById('btnLoginView').onclick = () => setAuthMode('login');
document.getElementById('btnRegisterView').onclick = () => setAuthMode('register');
document.getElementById('btnLogout').onclick = logout;

function setAuthMode(mode) {
    const title = document.getElementById('authTitle');
    const userInput = document.getElementById('username');
    if(mode === 'login') {
        title.textContent = 'Login';
        userInput.classList.add('hidden');
    } else {
        title.textContent = 'Registro';
        userInput.classList.remove('hidden');
    }
}

// --- SHOP LOGIC ---
async function loadShop() {
    try {
        const data = await gql(`query { getProducts { id, name, description, price, stock, imageUrl } }`);
        state.products = data.getProducts;
        renderProducts();
    } catch (e) { console.error(e); }
}

function renderProducts() {
    const div = document.getElementById('products');
    div.innerHTML = '';
    const isAdmin = state.user?.role === 'admin';

    state.products.forEach((p, index) => {
        const card = document.createElement('div');
        card.className = 'card product-card';
        card.style.animationDelay = `${index * 50}ms`;
        
        // Botones de Admin (Solo si es admin)
        let adminBtns = '';
        if (isAdmin) {
            adminBtns = `
            <div class="admin-actions">
                <button onclick="editProduct('${p.id}')" class="btn btn-icon-small" style="background:var(--primary)"><i class="ph ph-pencil"></i></button>
                <button onclick="deleteProduct('${p.id}')" class="btn btn-icon-small" style="background:var(--danger)"><i class="ph ph-trash"></i></button>
            </div>`;
        }

        card.innerHTML = `
            ${adminBtns}
            <div class="badge"><i class="ph ph-package"></i> ${p.stock}</div>
            <img src="${p.imageUrl || 'https://via.placeholder.com/300'}" class="product-img">
            <h3 style="margin: 0 0 5px 0;">${p.name}</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; flex-grow: 1;">${p.description || ''}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 15px;">
                <span style="font-size: 1.2rem; font-weight: bold; color: var(--primary);">${p.price} €</span>
                <button onclick="addToCart('${p.id}')" class="btn btn-ghost">
                    <i class="ph ph-plus"></i> Añadir
                </button>
            </div>
        `;
        div.appendChild(card);
    });
}

// --- CART LOGIC ---
window.addToCart = (id) => {
    const product = state.products.find(p => p.id === id);
    if (!product || product.stock < 1) return showToast('Sin stock disponible', 'error');

    const item = state.cart.find(i => i.productId === id);
    if (item) {
        if(item.quantity < product.stock) {
            item.quantity++;
            showToast('Cantidad actualizada');
        } else {
            showToast('Has alcanzado el límite de stock', 'error');
        }
    } else {
        state.cart.push({ productId: id, name: product.name, price: product.price, quantity: 1 });
        showToast('Producto añadido al carrito');
    }
    saveCart();
};

window.removeFromCart = (index) => {
    state.cart.splice(index, 1);
    saveCart();
};

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    renderCart();
}

function renderCart() {
    const div = document.getElementById('cartItems');
    div.innerHTML = '';
    let total = 0;
    
    if(state.cart.length === 0) {
        div.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="ph ph-shopping-cart" style="font-size: 2rem;"></i><br>Tu cesta está vacía</div>';
    }

    state.cart.forEach((item, idx) => {
        total += item.price * item.quantity;
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
            <div>
                <div style="font-weight: 600;">${item.name}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">x${item.quantity} · ${item.price}€</div>
            </div>
            <button onclick="removeFromCart(${idx})" class="btn btn-ghost" style="color: var(--danger); padding: 5px;">
                <i class="ph ph-trash"></i>
            </button>
        `;
        div.appendChild(el);
    });
    document.getElementById('cartTotal').textContent = total.toFixed(2) + ' €';
}

document.getElementById('btnCheckout').onclick = async () => {
    if(state.cart.length === 0) return showToast('El carrito está vacío', 'error');
    
    const itemsInput = state.cart.map(i => ({ productId: i.productId, quantity: i.quantity }));
    
    try {
        await gql(`
            mutation CreateOrder($items: [CartItemInput]!) {
                createOrder(items: $items) { id total }
            }
        `, { items: itemsInput });
        
        showToast('¡Compra realizada con éxito!', 'success');
        state.cart = [];
        saveCart();
        loadShop(); 
    } catch (e) {
        showToast(e.message, 'error');
    }
};

// --- ADMIN LOGIC ---
async function loadAdmin() {
    const users = await gql(`query { getUsers { id, username, email, role } }`);
    const orders = await gql(`query { getAllOrders { id, total, status, user { username } } }`);
    
    // Tabla Usuarios
    const uList = document.getElementById('adminUsersList');
    if(uList) {
        uList.innerHTML = `
        <table class="data-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Acción</th></tr></thead>
            <tbody>
                ${users.getUsers.map(u => `
                <tr>
                    <td>${u.username}<br><span style="font-size:0.8em; color:var(--text-muted)">${u.email}</span></td>
                    <td><span class="role-badge ${u.role}">${u.role}</span></td>
                    <td><button onclick="deleteUser('${u.id}')" class="btn btn-ghost" style="color:var(--danger)"><i class="ph ph-trash"></i></button></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    }

    // Tabla Pedidos
    const oList = document.getElementById('adminOrdersList');
    if(oList) {
        oList.innerHTML = `
        <table class="data-table">
            <thead><tr><th>ID</th><th>Usuario</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>
                ${orders.getAllOrders.map(o => `
                <tr>
                    <td style="font-family:monospace; color:var(--text-muted)">#${o.id.slice(-4)}</td>
                    <td>${o.user?.username || 'Desconocido'}</td>
                    <td style="color:var(--success)">${o.total}€</td>
                    <td><span style="padding:2px 6px; border-radius:4px; background:rgba(16, 185, 129, 0.2); color:#6ee7b7">${o.status}</span></td>
                </tr>`).join('')}
            </tbody>
        </table>`;
    }
}

window.deleteUser = async (id) => {
    if(confirm('¿Estás seguro de eliminar este usuario?')) {
        try {
            await gql(`mutation { deleteUser(id: "${id}") }`);
            showToast('Usuario eliminado');
            loadAdmin();
        } catch(e) { showToast(e.message, 'error'); }
    }
};

// --- PRODUCT MANAGEMENT (ADMIN) ---
const modal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');

// Abrir modal (Nuevo)
document.getElementById('btnNewProduct').onclick = () => {
    document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    productForm.reset();
    document.getElementById('prodId').value = '';
    modal.showModal();
};

// Abrir modal (Editar)
window.editProduct = (id) => {
    const p = state.products.find(prod => prod.id === id);
    if(!p) return;
    document.getElementById('modalTitle').textContent = 'Editar Producto';
    document.getElementById('prodId').value = p.id;
    document.getElementById('prodName').value = p.name;
    document.getElementById('prodDesc').value = p.description || '';
    document.getElementById('prodPrice').value = p.price;
    document.getElementById('prodStock').value = p.stock;
    document.getElementById('prodImg').value = p.imageUrl || '';
    modal.showModal();
};

// Cerrar modal
window.closeModal = () => modal.close();

// Guardar (Submit)
productForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const name = document.getElementById('prodName').value;
    const desc = document.getElementById('prodDesc').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const img = document.getElementById('prodImg').value;

    try {
        if (id) {
            // EDITAR
            await gql(`
                mutation Update($id: ID!, $n: String, $d: String, $p: Float, $s: Int, $i: String) {
                    updateProduct(id: $id, name: $n, description: $d, price: $p, stock: $s, imageUrl: $i) { id }
                }
            `, { id, n: name, d: desc, p: price, s: stock, i: img });
            showToast('Producto actualizado');
        } else {
            // CREAR
            await gql(`
                mutation Create($n: String!, $d: String, $p: Float!, $s: Int!, $i: String) {
                    createProduct(name: $n, description: $d, price: $p, stock: $s, imageUrl: $i) { id }
                }
            `, { n: name, d: desc, p: price, s: stock, i: img });
            showToast('Producto creado');
        }
        modal.close();
        loadShop(); // Recargar lista
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// Borrar producto
window.deleteProduct = async (id) => {
    if(!confirm('¿Eliminar producto permanentemente?')) return;
    try {
        await gql(`mutation { deleteProduct(id: "${id}") }`);
        showToast('Producto eliminado');
        loadShop();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

// Init
initAuth();