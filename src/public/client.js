const state = {
    user: null,
    token: localStorage.getItem('token') || null,
    products: [],
    editingId: null,
};
//ELementos
const email = document.getElementById('email');
const password = document.getElementById('password');
const role = document.getElementById('role');
const productsDiv = document.getElementById('products');
const btnNew = document.getElementById('btnNew');
const dlg = document.getElementById('productModal');
const pName = document.getElementById('pName');
const pPrice = document.getElementById('pPrice');
const pImage = document.getElementById('pImage');
const pDesc = document.getElementById('pDesc');
const saveProduct = document.getElementById('saveProduct');
const cancelProduct = document.getElementById('cancelProduct');


function setAuthView(mode) {
    if (mode === 'login') {
        authTitle.textContent = 'Login';
        username.classList.add('hidden');
        role.classList.add('hidden');
    } else {
        authTitle.textContent = 'Registro';
        username.classList.remove('hidden');
        role.classList.remove('hidden');
    }
}

async function api(path, opts = {}) {
    const res = await fetch(path, {
        headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
        },
        ...opts
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Error API');
    return res.json();
}


function updateUI() {
    const logged = Boolean(state.token);
    btnLogout.classList.toggle('hidden', !logged);
    btnChat.classList.toggle('hidden', !logged);
    authSection.classList.toggle('hidden', logged);
    productsSection.classList.toggle('hidden', false);
    btnNew.classList.toggle('hidden', !(state.user?.role === 'admin'));
}


btnLoginView.onclick = () => setAuthView('login');
btnRegisterView.onclick = () => setAuthView('register');
btnLogout.onclick = () => {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    updateUI();
};

authForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
        if (authTitle.textContent === 'Registro') {
            const data = await api('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username: username.value, email: email.value, password: password.value, role: role.value })
            });
            state.token = data.token; localStorage.setItem('token', data.token); state.user = data.user;
        } else {
            const data = await api('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email: email.value, password: password.value })
            });
            state.token = data.token; localStorage.setItem('token', data.token); state.user = data.user;
        }
        authMsg.textContent = '';
        updateUI();
    } catch (e) {
        authMsg.textContent = e.message;
    }
};

async function loadProducts() {
    try {
        state.products = await api('/api/products');
        renderProducts();
    } catch (e) {
        console.error(e);
    }
}

function renderProducts() {
    productsDiv.innerHTML = '';
    state.products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product';
        card.innerHTML = `
<img src="${p.imageUrl || 'https://picsum.photos/seed/' + p._id + '/400/240'}" alt="${p.name}">
<h3>${p.name}</h3>
<div class="price">${p.price.toFixed(2)} €</div>
<p>${p.description || ''}</p>
<div class="actions"></div>
`;
        const actions = card.querySelector('.actions');
        if (state.user?.role === 'admin') {
            const edit = document.createElement('button');
            edit.textContent = 'Editar';
            edit.onclick = () => openEdit(p);
            const del = document.createElement('button');
            del.textContent = 'Eliminar';
            del.onclick = () => removeProduct(p._id);
            actions.append(edit, del);
        }
        productsDiv.appendChild(card);
    });
}



btnNew.onclick = () => openEdit();


function openEdit(p) {
    state.editingId = p?._id || null;
    pName.value = p?.name || '';
    pPrice.value = p?.price ?? '';
    pImage.value = p?.imageUrl || '';
    pDesc.value = p?.description || '';
    dlg.showModal();
}


cancelProduct.onclick = () => dlg.close();


saveProduct.onclick = async (e) => {
    e.preventDefault();
    const body = { name: pName.value, price: Number(pPrice.value), imageUrl: pImage.value, description: pDesc.value };
    try {
        if (state.editingId) {
            await api(`/api/products/${state.editingId}`, { method: 'PUT', body: JSON.stringify(body) });
        } else {
            await api('/api/products', { method: 'POST', body: JSON.stringify(body) });
        }
        dlg.close();
        await loadProducts();
    } catch (e) {
        alert(e.message);
    }
};


async function removeProduct(id) {
    if (!confirm('¿Eliminar producto?')) return;
    try {
        await api(`/api/products/${id}`, { method: 'DELETE' });
        await loadProducts();
    } catch (e) { alert(e.message); }
}

(async function init() {
  updateUI();
  await loadProducts();
  if (state.token) {
    btnChat.href = '/chat.html';
  }
})();

