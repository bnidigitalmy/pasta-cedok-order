import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Same publishable (anon) key used by the Flutter app — safe to ship, all
// access is gated by RLS (public menu read + the place_online_order RPC).
const SUPABASE_URL = "https://gtsbvohwfbckyuznifsw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Pi7TVfFEA-PqpAovQswcEg_MegIvUad";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const rm = (n) => `RM${Number(n).toFixed(2)}`;

let categories = [];
let products = [];
let activeCategory = "all";
/** @type {Map<string, {id:string,name:string,price:number,qty:number}>} */
const cart = new Map();

const el = {
  chips: document.getElementById("category-chips"),
  grid: document.getElementById("product-grid"),
  cartBar: document.getElementById("cart-bar"),
  cartBarBtn: document.getElementById("cart-bar-btn"),
  cartBarLabel: document.getElementById("cart-bar-label"),
  cartBarTotal: document.getElementById("cart-bar-total"),
  checkoutOverlay: document.getElementById("checkout-overlay"),
  checkoutClose: document.getElementById("checkout-close"),
  checkoutLines: document.getElementById("checkout-lines"),
  checkoutForm: document.getElementById("checkout-form"),
  checkoutTotal: document.getElementById("checkout-total"),
  checkoutSubmit: document.getElementById("checkout-submit"),
  checkoutError: document.getElementById("checkout-error"),
  custName: document.getElementById("cust-name"),
  custPhone: document.getElementById("cust-phone"),
  custNotes: document.getElementById("cust-notes"),
  confirmOverlay: document.getElementById("confirm-overlay"),
  confirmOrderNo: document.getElementById("confirm-order-no"),
  confirmTotal: document.getElementById("confirm-total"),
  confirmNewOrder: document.getElementById("confirm-new-order"),
};

async function load() {
  const [{ data: cats, error: catErr }, { data: prods, error: prodErr }] =
    await Promise.all([
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("products").select("*").order("name"),
    ]);
  if (catErr || prodErr) {
    el.grid.textContent = "Gagal memuatkan menu. Sila cuba lagi.";
    console.error(catErr || prodErr);
    return;
  }
  categories = cats ?? [];
  products = (prods ?? []).filter((p) => p.is_available);
  renderChips();
  renderGrid();
}

function renderChips() {
  el.chips.replaceChildren();
  const items = [{ id: "all", name: "Semua" }, ...categories];
  for (const c of items) {
    const btn = document.createElement("button");
    btn.className = "chip" + (activeCategory === c.id ? " active" : "");
    btn.textContent = c.id === "all" ? "Semua" : c.name.split(" ")[0];
    btn.onclick = () => {
      activeCategory = c.id;
      renderChips();
      renderGrid();
    };
    el.chips.appendChild(btn);
  }
}

function renderGrid() {
  el.grid.replaceChildren();
  const list =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category_id === activeCategory);

  for (const p of list) {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("div");
    img.className = "card-img";
    if (p.image_asset) {
      const imgEl = document.createElement("img");
      imgEl.src = `menu/${p.image_asset}.jpg`;
      imgEl.alt = p.name;
      img.appendChild(imgEl);
    }
    const qty = cart.get(p.id)?.qty ?? 0;
    if (qty > 0) {
      const badge = document.createElement("span");
      badge.className = "card-qty";
      badge.textContent = String(qty);
      img.appendChild(badge);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = p.name;
    const price = document.createElement("div");
    price.className = "card-price";
    price.textContent = rm(p.sell_price);
    body.append(name, price);

    card.append(img, body);
    card.onclick = () => addToCart(p);
    el.grid.appendChild(card);
  }
}

function addToCart(p) {
  const existing = cart.get(p.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.set(p.id, { id: p.id, name: p.name, price: p.sell_price, qty: 1 });
  }
  renderGrid();
  renderCartBar();
}

function cartTotal() {
  let total = 0;
  for (const l of cart.values()) total += l.price * l.qty;
  return total;
}

function cartCount() {
  let count = 0;
  for (const l of cart.values()) count += l.qty;
  return count;
}

function renderCartBar() {
  if (cart.size === 0) {
    el.cartBar.classList.add("hidden");
    return;
  }
  el.cartBar.classList.remove("hidden");
  el.cartBarLabel.textContent = `${cartCount()} item · Teruskan Pesanan`;
  el.cartBarTotal.textContent = rm(cartTotal());
}

el.cartBarBtn.onclick = () => {
  renderCheckoutSheet();
  el.checkoutOverlay.classList.remove("hidden");
};
el.checkoutClose.onclick = () => el.checkoutOverlay.classList.add("hidden");

function renderCheckoutSheet() {
  el.checkoutLines.replaceChildren();
  for (const l of cart.values()) {
    const row = document.createElement("div");
    row.className = "checkout-line";
    const left = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = l.name;
    const subEl = document.createElement("div");
    subEl.className = "sub";
    subEl.textContent = `${l.qty} × ${rm(l.price)}`;
    left.append(nameEl, subEl);
    const right = document.createElement("div");
    right.textContent = rm(l.price * l.qty);
    row.append(left, right);
    el.checkoutLines.appendChild(row);
  }
  el.checkoutTotal.textContent = rm(cartTotal());
  el.checkoutError.classList.add("hidden");
}

el.checkoutForm.onsubmit = async (e) => {
  e.preventDefault();
  el.checkoutError.classList.add("hidden");
  el.checkoutSubmit.disabled = true;
  el.checkoutSubmit.textContent = "Menghantar...";

  try {
    const items = [...cart.values()].map((l) => ({
      product_id: l.id,
      qty: l.qty,
    }));
    const { data, error } = await supabase.rpc("place_online_order", {
      p_items: items,
      p_customer_name: el.custName.value.trim(),
      p_customer_phone: el.custPhone.value.trim(),
      p_notes: el.custNotes.value.trim() || null,
    });
    if (error) throw error;

    el.checkoutOverlay.classList.add("hidden");
    el.confirmOrderNo.textContent = data.order_no;
    el.confirmTotal.textContent = rm(data.total);
    el.confirmOverlay.classList.remove("hidden");
    cart.clear();
    renderCartBar();
    renderGrid();
    el.checkoutForm.reset();
  } catch (err) {
    console.error(err);
    el.checkoutError.textContent =
      "Gagal menghantar pesanan. Sila cuba lagi sebentar.";
    el.checkoutError.classList.remove("hidden");
  } finally {
    el.checkoutSubmit.disabled = false;
    el.checkoutSubmit.textContent = "Hantar Pesanan";
  }
};

el.confirmNewOrder.onclick = () => el.confirmOverlay.classList.add("hidden");

load();
