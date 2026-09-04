import {
  firebaseConfigured, watchAuth, login, logout, checkAccess, loadData, addCustomer, updateCustomer, archiveCustomer,
  addProduct, updateProduct, archiveProduct, adjustStock, addSale, updateSale, deleteSale, payDebt, getTrace, getExportData
} from "./firebase-data.js";

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const money = value => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0));
const qty = value => new Intl.NumberFormat("id-ID",{maximumFractionDigits:2}).format(Number(value||0));
const dateTime = value => value ? new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "—";
const jakartaDate = value => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
const statusBadge = row => Number(row.remaining)===0 ? '<span class="badge paid">Lunas</span>' : row.status==="sebagian" ? '<span class="badge partial">Dicicil</span>' : '<span class="badge debt">Belum lunas</span>';

let state = { tab:"dashboard", query:"", products:[],allProducts:[],customers:[],allCustomers:[],sales:[],debts:[] };
let toastTimer;
function toast(message,error=false){const el=$("#toast");el.textContent=message;el.className=`toast${error?" error":""}`;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.add("hidden"),3200)}
function empty(title,text){return `<div class="empty"><b>${esc(title)}</b>${esc(text)}</div>`}
function formObject(form){return Object.fromEntries(new FormData(form).entries())}
function openModal(html,wide=false){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden");$("#modal .modal-card").classList.toggle("wide",wide)}
function closeModal(){$("#modal").classList.add("hidden");$("#modalContent").innerHTML=""}
async function refresh(message){
  $("#content").innerHTML='<div class="loading">Memuat catatan koperasi...</div>';
  try{Object.assign(state,await loadData());render();if(message)toast(message)}catch(error){$("#content").innerHTML=empty("Data gagal dimuat",error.message);toast(error.message,true)}
}

watchAuth(async user=>{
  if(!user){$("#app").classList.add("hidden");$("#loginPage").classList.remove("hidden");return}
  if(!await checkAccess(user)){toast("Akun belum diizinkan di collection users",true);await logout();return}
  $("#loginPage").classList.add("hidden");$("#app").classList.remove("hidden");await refresh();
});
if(!firebaseConfigured)$("#configWarning").classList.remove("hidden");
$("#loginForm").addEventListener("submit",async event=>{event.preventDefault();$("#loginError").textContent="";if(!firebaseConfigured){$("#loginError").textContent="Isi firebase-config.js terlebih dahulu.";return}try{await login($("#loginEmail").value,$("#loginPassword").value)}catch{$("#loginError").textContent="Email atau kata sandi salah."}});
$("#logoutBtn").addEventListener("click",logout);
$("#exportBtn").addEventListener("click",showExportModal);
$("#modal").addEventListener("click",event=>{
  if(event.target.closest("[data-close-modal]"))return closeModal();
  const action=event.target.closest("[data-action]");if(!action)return;
  if(action.dataset.action==="edit-sale")showSaleModal(action.dataset.id);
  if(action.dataset.action==="delete-sale")showDeleteSaleModal(action.dataset.id);
  if(action.dataset.action==="edit-product")showProductModal(action.dataset.id);
  if(action.dataset.action==="delete-product")showDeleteProductModal(action.dataset.id);
  if(action.dataset.action==="edit-customer")showCustomerModal(action.dataset.id);
  if(action.dataset.action==="delete-customer")showDeleteCustomerModal(action.dataset.id);
});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal()});
$(".tabs").addEventListener("click",event=>{const button=event.target.closest("[data-tab]");if(!button)return;state.tab=button.dataset.tab;state.query="";render()});
$("#content").addEventListener("input",event=>{if(event.target.id==="searchInput"){state.query=event.target.value;renderBody()}});
$("#content").addEventListener("click",event=>{
  const action=event.target.closest("[data-action]");if(!action)return;
  if(action.dataset.action==="new-product")showProductModal();
  if(action.dataset.action==="new-customer")showCustomerModal();
  if(action.dataset.action==="new-sale")showSaleModal();
  if(action.dataset.action==="pay-debt")showPaymentModal(action.dataset.id);
  if(action.dataset.action==="stock")showStockModal(action.dataset.id);
  if(action.dataset.action==="edit-sale")showSaleModal(action.dataset.id);
  if(action.dataset.action==="delete-sale")showDeleteSaleModal(action.dataset.id);
  if(action.dataset.action==="edit-product")showProductModal(action.dataset.id);
  if(action.dataset.action==="delete-product")showDeleteProductModal(action.dataset.id);
  if(action.dataset.action==="edit-customer")showCustomerModal(action.dataset.id);
  if(action.dataset.action==="delete-customer")showDeleteCustomerModal(action.dataset.id);
});
$("#content").addEventListener("click",event=>{const traceButton=event.target.closest("[data-trace-kind]");if(traceButton&&!event.target.closest("[data-action]"))showTrace(traceButton.dataset.traceKind,traceButton.dataset.id)});

function render(){
  document.querySelectorAll(".tabs [data-tab]").forEach(button=>button.classList.toggle("active",button.dataset.tab===state.tab));
  $("#debtCount").textContent=state.debts.length;$("#debtCount").classList.toggle("hidden",!state.debts.length);
  const heads={dashboard:"",transactions:["Semua transaksi","Klik transaksi untuk melihat item, waktu, pembeli, dan pembayaran."],debts:["Bon & piutang","Transaksi yang masih memiliki sisa pembayaran."],products:["Master barang","Stok masuk, koreksi, dan penjualan tersimpan dalam riwayat."],customers:["Daftar pembeli","Pembeli bon dapat ditelusuri sampai setiap transaksi."]};
  if(state.tab==="dashboard")$("#content").innerHTML=dashboardHtml();
  else{
    const [title,description]=heads[state.tab];const action=state.tab==="products"?'<button class="btn primary" data-action="new-product">＋ Barang</button>':state.tab==="customers"?'<button class="btn primary" data-action="new-customer">＋ Pembeli</button>':state.tab==="transactions"?'<button class="btn primary" data-action="new-sale">＋ Transaksi</button>':"";
    $("#content").innerHTML=`<div class="section-head"><div><h1>${title}</h1><p>${description}</p></div>${action}</div><input id="searchInput" class="search" value="${esc(state.query)}" placeholder="Cari data..."><div id="body"></div>`;renderBody();
  }
}
function dashboardHtml(){
  const today=jakartaDate(new Date());const todaySales=state.sales.filter(s=>jakartaDate(s.createdAt)===today);const receivable=state.debts.reduce((sum,s)=>sum+Number(s.remaining),0);const low=state.products.filter(p=>Number(p.stock)<=Number(p.minStock)).length;const stockValue=state.products.reduce((sum,p)=>sum+Number(p.stock)*Number(p.purchasePrice),0);
  return `<section class="welcome"><div><small>OPERASIONAL HARI INI</small><h1>Semua transaksi, stok, dan bon dalam satu catatan.</h1><p>Setiap angka terhubung ke waktu, pembeli, dan barangnya.</p></div><button class="btn outline" data-action="new-sale">＋ Catat Penjualan</button></section><section class="stats"><article class="stat"><span>Penjualan hari ini</span><b>${money(todaySales.reduce((s,x)=>s+Number(x.total),0))}</b><small>${todaySales.length} transaksi</small></article><article class="stat"><span>Piutang belum lunas</span><b>${money(receivable)}</b><small>${state.debts.length} bon aktif</small></article><article class="stat"><span>Jenis barang</span><b>${state.products.length}</b><small>${low} stok menipis</small></article><article class="stat"><span>Nilai stok</span><b>${money(stockValue)}</b><small>Berdasarkan harga beli</small></article></section><div class="two-col"><section class="panel"><h2>Aksi cepat</h2><div class="quick"><button data-action="new-sale">🛒 Catat penjualan</button><button data-action="new-product">📦 Tambah barang</button><button data-action="new-customer">👤 Tambah pembeli</button></div></section><section class="panel"><h2>Transaksi terbaru</h2>${state.sales.length?`<div class="timeline">${state.sales.slice(0,8).map(s=>`<button data-trace-kind="transaction" data-id="${s.id}"><span><b>${esc(s.invoiceNo)}</b><small>${esc(s.customerName)} · ${esc(s.itemSummary)}</small></span><span class="money"><b>${money(s.total)}</b><small>${dateTime(s.createdAt)}</small></span></button>`).join("")}</div>`:empty("Belum ada transaksi","Transaksi pertama akan tampil di sini.")}</section></div>`;
}
function renderBody(){
  const q=state.query.toLowerCase();let html="";
  if(state.tab==="transactions"){
    const rows=state.sales.filter(s=>`${s.invoiceNo} ${s.customerName} ${s.itemSummary}`.toLowerCase().includes(q));html=rows.length?`<div class="table-wrap"><table><thead><tr><th>Waktu & nomor</th><th>Pembeli</th><th>Item</th><th>Status</th><th class="right">Total</th><th>Tindakan</th></tr></thead><tbody>${rows.map(s=>`<tr data-click data-trace-kind="transaction" data-id="${s.id}"><td><b>${esc(s.invoiceNo)}</b><small>${dateTime(s.createdAt)}</small></td><td>${esc(s.customerName)}</td><td>${esc(s.itemSummary)}</td><td>${statusBadge(s)}${s.remaining?`<small>Sisa ${money(s.remaining)}</small>`:""}</td><td class="right"><b>${money(s.total)}</b></td><td><div class="row-actions"><button class="btn outline compact" data-action="edit-sale" data-id="${s.id}">Edit</button><button class="btn danger compact" data-action="delete-sale" data-id="${s.id}">Hapus</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("Transaksi tidak ditemukan","Ubah pencarian atau catat transaksi baru.");
  } else if(state.tab==="debts"){
    const rows=state.debts.filter(s=>`${s.invoiceNo} ${s.customerName} ${s.itemSummary}`.toLowerCase().includes(q));html=rows.length?`<div class="grid-cards">${rows.map(s=>`<article class="item-card"><h3>${esc(s.customerName)}</h3><p>${esc(s.invoiceNo)} · ${dateTime(s.createdAt)}</p><button class="btn outline" data-trace-kind="transaction" data-id="${s.id}">${esc(s.itemSummary)}</button><div class="split"><span>Total<br><b>${money(s.total)}</b></span><span>Sisa bon<br><b class="error-text">${money(s.remaining)}</b></span></div><button class="btn primary" data-action="pay-debt" data-id="${s.id}">Catat pembayaran</button><div class="row-actions card-actions"><button class="btn outline compact" data-action="edit-sale" data-id="${s.id}">Edit</button><button class="btn danger compact" data-action="delete-sale" data-id="${s.id}">Hapus</button></div></article>`).join("")}</div>`:empty("Tidak ada bon aktif","Semua transaksi bon sudah lunas.");
  } else if(state.tab==="products"){
    const rows=state.products.filter(p=>`${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q));html=rows.length?`<div class="grid-cards">${rows.map(p=>`<article class="item-card"><button class="btn ghost" data-trace-kind="product" data-id="${p.id}"><b>${esc(p.name)}</b></button><p>${esc(p.sku)} · ${esc(p.category)}</p><div class="split"><span>Stok<br><b>${qty(p.stock)} ${esc(p.unit)}</b></span><span>Harga jual<br><b>${money(p.salePrice)}</b></span></div><button class="btn outline" data-action="stock" data-id="${p.id}">Sesuaikan stok</button><div class="row-actions card-actions"><button class="btn outline compact" data-action="edit-product" data-id="${p.id}">✎ Edit barang</button><button class="btn danger compact" data-action="delete-product" data-id="${p.id}">🗑 Hapus barang</button></div></article>`).join("")}</div>`:empty("Barang tidak ditemukan","Tambahkan barang atau ubah pencarian.");
  } else if(state.tab==="customers"){
    const rows=state.customers.filter(c=>`${c.name} ${c.phone||""} ${c.address||""}`.toLowerCase().includes(q));html=rows.length?`<div class="grid-cards">${rows.map(c=>`<article class="item-card"><h3>${esc(c.name)}</h3><p>${esc(c.phone||"Tanpa telepon")} · ${esc(c.address||"Alamat belum diisi")}</p><div class="split"><span>Transaksi<br><b>${c.transactionCount}</b></span><span>Sisa bon<br><b>${money(c.debtBalance)}</b></span></div><button class="btn outline" data-trace-kind="customer" data-id="${c.id}">Lihat riwayat pembeli</button><div class="row-actions card-actions"><button class="btn outline compact" data-action="edit-customer" data-id="${c.id}">✎ Edit pembeli</button><button class="btn danger compact" data-action="delete-customer" data-id="${c.id}">🗑 Hapus pembeli</button></div></article>`).join("")}</div>`:empty("Pembeli tidak ditemukan","Tambah pembeli khusus transaksi bon.");
  }
  $("#body").innerHTML=html;
}

function showCustomerModal(customerId=""){
  const customer=customerId?state.customers.find(row=>row.id===customerId):null,editing=Boolean(customer);
  if(customerId&&!customer){toast("Pembeli tidak ditemukan",true);return}
  openModal(`<h2>${editing?"Edit pembeli":"Tambah pembeli"}</h2><p class="subtitle">Data pembeli terhubung dengan transaksi dan bon.</p><form id="customerForm" class="form-stack"><label>Nama lengkap<input name="name" value="${esc(customer?.name||"")}" required></label><label>Nomor telepon<input name="phone" inputmode="tel" value="${esc(customer?.phone||"")}"></label><label>Alamat<textarea name="address">${esc(customer?.address||"")}</textarea></label><label>Catatan<textarea name="notes">${esc(customer?.notes||"")}</textarea></label>${editing?'<label>Alasan koreksi<input name="editNotes" placeholder="Contoh: nomor telepon diperbaiki" required></label>':""}<div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary">${editing?"Simpan koreksi":"Simpan pembeli"}</button></div></form>`);
  $("#customerForm").addEventListener("submit",async event=>{event.preventDefault();try{const data=formObject(event.currentTarget);if(editing)await updateCustomer(customerId,data);else await addCustomer(data);closeModal();await refresh(editing?"Data pembeli berhasil dikoreksi":"Pembeli berhasil ditambahkan")}catch(error){toast(error.message,true)}});
}
function showProductModal(productId=""){
  const product=productId?state.products.find(row=>row.id===productId):null,editing=Boolean(product);
  if(productId&&!product){toast("Barang tidak ditemukan",true);return}
  openModal(`<h2>${editing?"Edit barang":"Tambah barang"}</h2><p class="subtitle">${editing?`Stok saat ini ${qty(product.stock)} ${esc(product.unit)}. Gunakan Sesuaikan stok untuk koreksi jumlah.`:"SKU dan stok awal menjadi titik awal pelacakan."}</p><form id="productForm" class="form-stack"><div class="form-grid"><label>Kode / SKU<input name="sku" value="${esc(product?.sku||"")}" required></label><label>Nama barang<input name="name" value="${esc(product?.name||"")}" required></label><label>Kategori<input name="category" value="${esc(product?.category||"Umum")}"></label><label>Satuan<input name="unit" value="${esc(product?.unit||"pcs")}" required></label><label>Harga beli<input name="purchasePrice" type="number" min="0" value="${product?.purchasePrice??""}" required></label><label>Harga jual<input name="salePrice" type="number" min="0" value="${product?.salePrice??""}" required></label>${editing?"":'<label>Stok awal<input name="initialStock" type="number" min="0" step="any" value="0" required></label>'}<label>Stok minimum<input name="minStock" type="number" min="0" step="any" value="${product?.minStock??0}" required></label></div>${editing?'<label>Alasan koreksi<input name="editNotes" placeholder="Contoh: harga jual diperbarui" required></label>':""}<div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary">${editing?"Simpan koreksi":"Simpan barang"}</button></div></form>`);
  $("#productForm").addEventListener("submit",async event=>{event.preventDefault();try{const data=formObject(event.currentTarget);if(editing)await updateProduct(productId,data);else await addProduct(data);closeModal();await refresh(editing?"Data barang berhasil dikoreksi":"Barang berhasil disimpan")}catch(error){toast(error.message,true)}});
}

function showDeleteCustomerModal(customerId){
  const customer=state.customers.find(row=>row.id===customerId);if(!customer)return;
  openModal(`<h2>Hapus pembeli?</h2><p class="subtitle">${esc(customer.name)}</p><div class="warning">Data pembeli akan dihapus permanen dari Firebase. Nama pada transaksi lama tetap tersimpan. Pembeli yang masih memiliki bon tidak dapat dihapus.</div><form id="deleteCustomerForm" class="form-stack"><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn danger">Hapus pembeli</button></div></form>`);
  $("#deleteCustomerForm").onsubmit=async event=>{event.preventDefault();try{await archiveCustomer(customerId);closeModal();await refresh("Pembeli berhasil dihapus permanen")}catch(error){toast(error.message,true)}};
}

function showDeleteProductModal(productId){
  const product=state.products.find(row=>row.id===productId);if(!product)return;
  openModal(`<h2>Hapus barang?</h2><p class="subtitle">${esc(product.name)} · stok ${qty(product.stock)} ${esc(product.unit)}</p><div class="warning">Master barang dan pergerakan stoknya akan dihapus permanen dari Firebase. Nama, jumlah, dan harga pada transaksi lama tetap tersimpan.</div><form id="deleteProductForm" class="form-stack"><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn danger">Hapus barang</button></div></form>`);
  $("#deleteProductForm").onsubmit=async event=>{event.preventDefault();try{await archiveProduct(productId);closeModal();await refresh("Barang berhasil dihapus permanen")}catch(error){toast(error.message,true)}};
}
function showStockModal(id){
  const product=state.products.find(p=>p.id===id);if(!product)return;
  openModal(`<h2>Sesuaikan stok</h2><p class="subtitle">${esc(product.name)} · stok ${qty(product.stock)} ${esc(product.unit)}</p><form id="stockForm" class="form-stack"><label>Jenis perubahan<select name="mode"><option value="add">Stok masuk / tambah</option><option value="subtract">Koreksi / kurangi</option></select></label><label>Jumlah (${esc(product.unit)})<input name="amount" type="number" min="0.01" step="any" required></label><label>Keterangan wajib<textarea name="notes" required></textarea></label><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary">Simpan perubahan</button></div></form>`);
  $("#stockForm").addEventListener("submit",async event=>{event.preventDefault();const data=formObject(event.currentTarget);try{await adjustStock(id,(data.mode==="add"?1:-1)*Number(data.amount),data.notes);closeModal();await refresh("Stok berhasil diperbarui")}catch(error){toast(error.message,true)}});
}
function showPaymentModal(id){
  const debt=state.debts.find(s=>s.id===id);if(!debt)return;
  openModal(`<h2>Catat pembayaran bon</h2><p class="subtitle">${esc(debt.customerName)} · ${esc(debt.invoiceNo)}</p><div class="bon-note"><span>Sisa bon saat ini</span><b>${money(debt.remaining)}</b></div><form id="paymentForm" class="form-stack"><label>Jumlah pembayaran<input name="amount" type="number" min="1" max="${debt.remaining}" value="${debt.remaining}" required></label><label>Metode<select name="method"><option>Tunai</option><option>Transfer</option><option>Potong simpanan</option></select></label><label>Catatan<textarea name="notes"></textarea></label><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary">Simpan pembayaran</button></div></form>`);
  $("#paymentForm").addEventListener("submit",async event=>{event.preventDefault();const data=formObject(event.currentTarget);try{await payDebt(id,data.amount,data.method,data.notes);closeModal();await refresh("Pembayaran bon berhasil dicatat")}catch(error){toast(error.message,true)}});
}

function showSaleModal(saleId=""){
  if(!saleId&&!state.products.length){toast("Tambahkan barang terlebih dahulu",true);return}
  const existing=saleId?state.sales.find(row=>row.id===saleId):null;
  if(saleId&&!existing){toast("Transaksi tidak ditemukan",true);return}
  const editing=Boolean(existing),fixedDebtApplied=Number(existing?.debtApplied||0);
  const existingProductIds=new Set((existing?.items||[]).map(item=>item.productId));
  const catalogProducts=editing?state.allProducts.filter(row=>row.archived!==true||existingProductIds.has(row.id)):state.products;
  const catalogCustomers=editing?state.allCustomers.filter(row=>row.archived!==true||row.id===existing?.customerId):state.customers;
  const sale=editing?{
    paymentType:existing.paymentType,customerId:existing.customerId||"",cashReceived:existing.cashReceived||"",
    useExcess:false,debtSaleId:"",debtAmount:"",showNew:false,newName:"",newPhone:"",newAddress:"",editNotes:"",
    lines:(existing.items||[]).map(item=>({id:item.id,productId:item.productId,qty:item.qty,unitPrice:catalogProducts.find(row=>row.id===item.productId)?.salePrice||0}))
  }:{paymentType:"tunai",customerId:"",cashReceived:"",useExcess:false,debtSaleId:"",debtAmount:"",showNew:false,newName:"",newPhone:"",newAddress:"",editNotes:"",lines:[{productId:"",qty:1,unitPrice:""}]};
  const total=()=>sale.lines.reduce((sum,line)=>{const p=catalogProducts.find(x=>x.id===line.productId);return sum+Number(line.qty||0)*Number(p?.salePrice||0)},0);
  const customerDebts=()=>state.debts.filter(d=>d.customerId===sale.customerId&&d.id!==saleId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const draw=()=>{
    const totalValue=total(),cash=Number(sale.cashReceived||0),excess=Math.max(0,cash-totalValue),debts=customerDebts(),target=debts[0];
    let budget=excess;const debtPlan=[];
    if(!editing&&sale.useExcess)debts.forEach(debt=>{if(budget<=0)return;const amount=Math.min(budget,Number(debt.remaining));if(amount>0){debtPlan.push({debt,amount});budget-=amount}});
    const applied=editing?fixedDebtApplied:debtPlan.reduce((sum,row)=>sum+row.amount,0),change=Math.max(0,excess-applied);
    const productOptions=line=>catalogProducts.map(p=>`<option value="${p.id}" ${line.productId===p.id?"selected":""}>${esc(p.name)}${p.archived?" (dihapus)":""} · ${money(p.salePrice)} · stok ${qty(p.stock)} ${esc(p.unit)}</option>`).join("");
    const customerOptions=catalogCustomers.map(c=>`<option value="${c.id}" ${sale.customerId===c.id?"selected":""}>${esc(c.name)}${c.archived?" (dihapus)":""}</option>`).join("");
    openModal(`<h2>${editing?`Edit ${esc(existing.invoiceNo)}`:"Catat penjualan"}</h2><p class="subtitle">${editing?"Koreksi otomatis menyesuaikan stok dan sisa bon.":"Pilih barang, jumlah, dan pembayaran."}</p><form id="saleForm"><div class="form-grid"><label>Jenis pembayaran<select id="paymentType"><option value="tunai" ${sale.paymentType==="tunai"?"selected":""}>Tunai / lunas</option><option value="bon" ${sale.paymentType==="bon"?"selected":""}>Bon / utang</option></select></label><label>${sale.paymentType==="bon"?"Pembeli (wajib)":"Pembeli (opsional)"}<select id="saleCustomer">${sale.paymentType==="tunai"?'<option value="">Tanpa nama / pembeli umum</option>':'<option value="">Pilih pembeli</option>'}${customerOptions}</select></label></div>${sale.paymentType==="bon"?`<button id="toggleNewCustomer" type="button" class="btn outline">＋ ${sale.showNew?"Tutup input":"Tambah pembeli baru"}</button>`:""}${sale.showNew?`<div class="inline-customer"><b>Pembeli belum terdaftar</b><div class="form-grid"><label>Nama<input id="newName" value="${esc(sale.newName)}"></label><label>Telepon<input id="newPhone" value="${esc(sale.newPhone)}"></label><label>Alamat<input id="newAddress" value="${esc(sale.newAddress)}"></label><button id="saveNewCustomer" type="button" class="btn primary">Simpan & pilih</button></div></div>`:""}<div class="line-head"><b>Barang yang dibeli</b><button id="addLine" type="button" class="btn outline">＋ Tambah baris</button></div><div class="sale-lines">${sale.lines.map((line,index)=>{const p=state.products.find(x=>x.id===line.productId);return`<div class="sale-line"><select data-line="${index}" data-field="productId"><option value="">Pilih barang</option>${productOptions(line)}</select><input data-line="${index}" data-field="qty" type="number" min="0.01" step="any" value="${line.qty}"><input data-line="${index}" data-field="unitPrice" type="number" min="0" value="${line.unitPrice}" placeholder="Harga"><strong>${money(Number(line.qty||0)*Number(line.unitPrice||p?.salePrice||0))}</strong>${sale.lines.length>1?`<button type="button" class="remove" data-remove-line="${index}">×</button>`:""}</div>`}).join("")}</div>${sale.paymentType==="bon"?`<div class="bon-note"><span>Seluruh total dicatat sebagai bon. Pembayaran yang sudah ada tetap diperhitungkan.</span><b>${money(totalValue)}</b></div>`:`<div class="cash-box"><label>Uang diterima<input id="cashReceived" type="number" min="${totalValue+fixedDebtApplied}" value="${sale.cashReceived}" required></label><div class="cash-summary"><span>Total<b>${money(totalValue)}</b></span><span>${editing&&fixedDebtApplied?"Cicilan terkait":"Uang lebih"}<b>${money(editing&&fixedDebtApplied?fixedDebtApplied:excess)}</b></span><span>Kembalian<b>${money(change)}</b></span></div></div>${editing&&fixedDebtApplied?`<div class="excess-box">Cicilan bon lama sebesar <b>${money(fixedDebtApplied)}</b> tetap dipertahankan saat transaksi diedit.</div>`:!editing&&excess>0&&sale.customerId&&customerDebts().length?`<div class="excess-box"><label><input id="useExcess" type="checkbox" ${sale.useExcess?"checked":""}> Gunakan uang lebih untuk cicil bon lama</label>${sale.useExcess?`<div class="form-grid"><label>Bon yang dicicil<select id="debtSaleId">${customerDebts().map(d=>`<option value="${d.id}" ${sale.debtSaleId===d.id?"selected":""}>${esc(d.invoiceNo)} · sisa ${money(d.remaining)}</option>`).join("")}</select></label><label>Jumlah cicilan<input id="debtAmount" type="number" min="1" max="${Math.min(excess,Number(target?.remaining||0))}" value="${sale.debtAmount}"></label></div>`:""}</div>`:""}`}${editing?`<label class="edit-reason">Alasan koreksi<input id="editNotes" value="${esc(sale.editNotes)}" placeholder="Contoh: jumlah barang salah input" required></label>`:""}<div class="total-bar"><span>Total transaksi</span><b>${money(totalValue)}</b></div><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary" ${!totalValue||(sale.paymentType==="tunai"&&cash<totalValue+fixedDebtApplied)||(sale.paymentType==="bon"&&!sale.customerId)||editing&&!sale.editNotes.trim()?"disabled":""}>${editing?"Simpan koreksi":"Simpan transaksi"}</button></div></form>`,true);
    const excessBox=$("#modalContent .excess-box");
    if(excessBox&&!editing){
      excessBox.innerHTML=`<label><input id="useExcess" type="checkbox" ${sale.useExcess?"checked":""}> Gunakan uang lebih untuk cicil bon otomatis</label><small>Otomatis membayar bon paling lama terlebih dahulu.</small>${sale.useExcess?`<div class="allocation-preview"><b>Rencana pembagian ${money(applied)}</b>${debtPlan.map(({debt,amount})=>`<div class="trace-row"><span>${esc(debt.invoiceNo)}<small>${dateTime(debt.createdAt)} · sisa ${money(debt.remaining)}</small></span><b>${money(amount)}</b></div>`).join("")}${change>0?`<div class="trace-row"><span>Sisa menjadi kembalian</span><b>${money(change)}</b></div>`:""}</div>`:""}`;
    }
    $("#paymentType").onchange=e=>{sale.paymentType=e.target.value;sale.useExcess=false;sale.showNew=false;draw()};
    $("#saleCustomer").onchange=e=>{sale.customerId=e.target.value;sale.useExcess=false;sale.debtSaleId="";sale.debtAmount="";draw()};
    $("#addLine").onclick=()=>{sale.lines.push({productId:"",qty:1,unitPrice:""});draw()};
    document.querySelectorAll("[data-line]").forEach(input=>input.onchange=e=>{const line=sale.lines[Number(e.target.dataset.line)];line[e.target.dataset.field]=e.target.value;if(e.target.dataset.field==="productId")line.unitPrice=catalogProducts.find(p=>p.id===e.target.value)?.salePrice||"";draw()});
    document.querySelectorAll("[data-remove-line]").forEach(button=>button.onclick=e=>{sale.lines.splice(Number(e.target.dataset.removeLine),1);draw()});
    if($("#cashReceived"))$("#cashReceived").onchange=e=>{sale.cashReceived=e.target.value;draw()};
    if($("#editNotes"))$("#editNotes").oninput=e=>{sale.editNotes=e.target.value;$("#saleForm .actions .btn.primary").disabled=!sale.editNotes.trim()};
    if($("#toggleNewCustomer"))$("#toggleNewCustomer").onclick=()=>{sale.showNew=!sale.showNew;draw()};
    if($("#newName")){["Name","Phone","Address"].forEach(key=>$("#new"+key).oninput=e=>sale["new"+key]=e.target.value);$("#saveNewCustomer").onclick=async()=>{try{const id=await addCustomer({name:sale.newName,phone:sale.newPhone,address:sale.newAddress});Object.assign(state,await loadData());sale.customerId=id;sale.showNew=false;toast("Pembeli ditambahkan dan dipilih");draw()}catch(error){toast(error.message,true)}}}
    if($("#useExcess"))$("#useExcess").onchange=e=>{sale.useExcess=e.target.checked;draw()};
    if($("#debtSaleId"))$("#debtSaleId").onchange=e=>{sale.debtSaleId=e.target.value;const d=customerDebts().find(x=>x.id===e.target.value);sale.debtAmount=Math.min(excess,Number(d.remaining));draw()};
    if($("#debtAmount"))$("#debtAmount").onchange=e=>{sale.debtAmount=e.target.value;draw()};
    $("#saleForm").onsubmit=async event=>{event.preventDefault();try{const payload={paymentType:sale.paymentType,customerId:sale.customerId,cashReceived:sale.cashReceived,items:sale.lines,editNotes:sale.editNotes,useExcessForDebts:sale.useExcess};const invoice=editing?await updateSale(saleId,payload):await addSale(payload);closeModal();await refresh(editing?`Transaksi ${invoice} berhasil dikoreksi`:`Transaksi ${invoice} berhasil dicatat`)}catch(error){toast(error.message,true)}};
  };draw();
}

function showDeleteSaleModal(saleId){
  const sale=state.sales.find(row=>row.id===saleId);if(!sale)return;
  openModal(`<h2>Hapus transaksi?</h2><p class="subtitle">${esc(sale.invoiceNo)} · ${esc(sale.itemSummary)}</p><div class="warning">Transaksi dan data pembayaran terkait akan dihapus permanen dari Firebase. Stok serta cicilan yang terhubung akan dikembalikan ke kondisi sebelumnya.</div><form id="deleteSaleForm" class="form-stack"><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn danger">Hapus permanen</button></div></form>`);
  $("#deleteSaleForm").onsubmit=async event=>{event.preventDefault();try{await deleteSale(saleId);closeModal();await refresh(`Transaksi ${sale.invoiceNo} dihapus permanen`)}catch(error){toast(error.message,true)}};
}

async function showTrace(kind,id){
  openModal('<div class="loading">Memuat jejak data...</div>');
  try{const data=await getTrace(kind,id);let html="";
    if(kind==="transaction"){const s=data.sale;html=`<h2>${esc(s.invoiceNo)}</h2><p class="subtitle">${dateTime(s.createdAt)} · ${statusBadge(s)}</p><div class="total-bar"><span>Total transaksi</span><b>${money(s.total)}</b></div><div class="trace-block"><h3>Pembeli</h3><button class="trace-row btn outline" ${s.customerId?`data-jump-kind="customer" data-jump-id="${s.customerId}"`:"disabled"}>${esc(s.customerName)}<span>›</span></button></div><div class="trace-block"><h3>Barang dibeli</h3>${data.items.map(item=>`<button class="trace-row btn outline" data-jump-kind="product" data-jump-id="${item.productId}"><span>${esc(item.productName)}<small>${qty(item.qty)} ${esc(item.unit)} × ${money(item.unitPrice)}</small></span><b>${money(item.subtotal)}</b></button>`).join("")}</div><div class="trace-block"><h3>Pembayaran</h3><div class="trace-row"><span>Total belanja</span><b>${money(s.total)}</b></div>${s.paymentType==="tunai"?`<div class="trace-row"><span>Uang diterima</span><b>${money(s.cashReceived)}</b></div><div class="trace-row"><span>Kembalian</span><b>${money(s.changeReturned)}</b></div>`:""}<div class="trace-row"><span>Sisa bon</span><b>${money(s.remaining)}</b></div>${data.payments.map(p=>`<div class="trace-row"><span>${esc(p.method)}<small>${dateTime(p.createdAt)}</small></span><b>${money(p.amount)}</b></div>`).join("")}</div>${data.allocations.length?`<div class="trace-block"><h3>Uang lebih dialihkan</h3>${data.allocations.map(p=>`<button class="trace-row btn outline" data-jump-kind="transaction" data-jump-id="${p.saleId}"><span>${esc(p.targetInvoiceNo)}</span><b>${money(p.amount)}</b></button>`).join("")}</div>`:""}`}
    if(kind==="transaction"&&data.payments.some(payment=>payment.sourceSaleId))html+=`<div class="trace-block"><h3>Sumber cicilan</h3>${data.payments.filter(payment=>payment.sourceSaleId).map(payment=>`<button class="trace-row btn outline" data-jump-kind="transaction" data-jump-id="${payment.sourceSaleId}"><span>Transaksi pembayaran<small>${esc(payment.notes||"")} · ${dateTime(payment.createdAt)}</small></span><b>${money(payment.amount)}</b></button>`).join("")}</div>`;
    if(kind==="transaction"&&data.sale.editCount)html+=`<div class="warning">Sudah dikoreksi ${data.sale.editCount} kali. Koreksi terakhir: ${esc(data.sale.editNotes||"-")}${data.sale.updatedAt?` · ${dateTime(data.sale.updatedAt)}`:""}</div>`;
    if(kind==="transaction")html+=`<div class="actions trace-actions"><button class="btn outline" data-action="edit-sale" data-id="${id}">Edit transaksi</button><button class="btn danger" data-action="delete-sale" data-id="${id}">Hapus transaksi</button></div>`;
    if(kind==="customer"){const c=data.customer;html=`<h2>${esc(c.name)}</h2><p class="subtitle">${esc(c.phone||"Tanpa telepon")} · ${esc(c.address||"Alamat belum diisi")}</p><div class="total-bar"><span>Total sisa bon</span><b>${money(c.debtBalance)}</b></div><div class="trace-block"><h3>Riwayat transaksi</h3>${data.transactions.length?data.transactions.map(s=>`<button class="trace-row btn outline" data-jump-kind="transaction" data-jump-id="${s.id}"><span>${esc(s.invoiceNo)}<small>${dateTime(s.createdAt)} · ${esc(s.itemSummary)}</small></span><b>${money(s.total)}</b></button>`).join(""):empty("Belum ada transaksi","")}</div>`}
    if(kind==="product"){const p=data.product;html=`<h2>${esc(p.name)}</h2><p class="subtitle">${esc(p.sku)} · stok ${qty(p.stock)} ${esc(p.unit)}</p><div class="trace-block"><h3>Pergerakan stok</h3>${data.movements.length?data.movements.map(m=>`<div class="trace-row"><span>${esc(m.movementType)}<small>${dateTime(m.createdAt)} · ${esc(m.notes||"")}</small></span><b>${m.qtyChange>0?"+":""}${qty(m.qtyChange)} → ${qty(m.balanceAfter)}</b></div>`).join(""):empty("Belum ada pergerakan","")}</div><div class="trace-block"><h3>Transaksi barang</h3>${data.transactions.map(row=>`<button class="trace-row btn outline" data-jump-kind="transaction" data-jump-id="${row.sale.id}"><span>${esc(row.sale.invoiceNo)}<small>${dateTime(row.sale.createdAt)} · ${esc(row.sale.customerName)}</small></span><b>${money(row.subtotal)}</b></button>`).join("")}</div>`}
    if(kind==="customer"&&data.customer.archived!==true)html+=`<div class="actions trace-actions"><button class="btn outline" data-action="edit-customer" data-id="${id}">Edit pembeli</button><button class="btn danger" data-action="delete-customer" data-id="${id}">Hapus pembeli</button></div>`;
    if(kind==="product"&&data.product.archived!==true)html+=`<div class="actions trace-actions"><button class="btn outline" data-action="edit-product" data-id="${id}">Edit barang</button><button class="btn danger" data-action="delete-product" data-id="${id}">Hapus barang</button></div>`;
    openModal(html);
    document.querySelectorAll("[data-jump-kind]").forEach(button=>{
      const kind=button.dataset.jumpKind,id=button.dataset.jumpId;
      const missing=(kind==="product"&&!state.allProducts.some(row=>row.id===id))
        ||(kind==="customer"&&!state.allCustomers.some(row=>row.id===id))
        ||(kind==="transaction"&&!state.sales.some(row=>row.id===id));
      if(missing){
        button.disabled=true;
        button.title="Data tujuan sudah dihapus";
        button.removeAttribute("data-jump-kind");
        button.removeAttribute("data-jump-id");
      }else button.onclick=()=>showTrace(kind,id);
    });
  }catch(error){openModal(empty("Jejak gagal dibuka",error.message))}
}

function showExportModal(){
  const today=jakartaDate(new Date()),firstDay=`${today.slice(0,8)}01`;
  openModal(`<h2>Ekspor Excel</h2><p class="subtitle">Pilih periode laporan transaksi.</p><form id="exportForm" class="form-stack"><div class="form-grid"><label>Tanggal awal<input name="startDate" type="date" value="${firstDay}" required></label><label>Tanggal akhir<input name="endDate" type="date" value="${today}" required></label></div><div class="bon-note"><span>Isi laporan</span><small>Transaksi, pembayaran bon, dan pergerakan stok mengikuti rentang tanggal. Daftar barang dan pembeli berisi data aktif saat ini.</small></div><div class="actions"><button type="button" class="btn outline" data-close-modal>Batal</button><button class="btn primary">Unduh Excel</button></div></form>`);
  $("#exportForm").onsubmit=async event=>{
    event.preventDefault();
    const {startDate,endDate}=formObject(event.currentTarget);
    if(startDate>endDate){toast("Tanggal awal tidak boleh melewati tanggal akhir",true);return}
    const submit=event.currentTarget.querySelector("button[type='submit'], button:not([type])");
    if(submit)submit.disabled=true;
    const success=await exportExcel(startDate,endDate);
    if(success)closeModal();else if(submit)submit.disabled=false;
  };
}

async function exportExcel(startDate,endDate){
  try{
    const data=await getExportData();
    const inRange=value=>{const date=jakartaDate(value);return date>=startDate&&date<=endDate};
    const sales=data.sales.filter(row=>inRange(row.createdAt));
    const payments=data.payments.filter(row=>inRange(row.createdAt));
    const movements=data.movements.filter(row=>inRange(row.createdAt));
    const xmlEsc=value=>{
      const normalized=value&&typeof value==="object"?JSON.stringify(value):value;
      return esc(normalized).replaceAll("'","&apos;");
    };
    const sheets=[
      {name:"Barang",rows:data.products},
      {name:"Pembeli",rows:data.customers},
      {name:"Transaksi",rows:sales.map(s=>{const row={...s};delete row.items;return row})},
      {name:"Item Transaksi",rows:sales.flatMap(s=>(s.items||[]).map(i=>({invoice:s.invoiceNo,tanggal:s.createdAt,pembeli:s.customerName,...i})))},
      {name:"Pembayaran Bon",rows:payments},
      {name:"Pergerakan Stok",rows:movements}
    ];
    const worksheets=sheets.map(sheet=>{
      const headers=sheet.rows.length?Object.keys(sheet.rows[0]):["Belum ada data"];
      const headerXml=headers.map(header=>`<Cell><Data ss:Type="String">${xmlEsc(header)}</Data></Cell>`).join("");
      const rowXml=sheet.rows.map(row=>`<Row>${headers.map(header=>{
        const value=row[header],isNumber=typeof value==="number"&&Number.isFinite(value);
        return `<Cell><Data ss:Type="${isNumber?"Number":"String"}">${xmlEsc(value)}</Data></Cell>`;
      }).join("")}</Row>`).join("");
      return `<Worksheet ss:Name="${sheet.name}"><Table><Row>${headerXml}</Row>${rowXml}</Table></Worksheet>`;
    }).join("");
    const workbook=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${worksheets}</Workbook>`;
    const blob=new Blob([workbook],{type:"application/vnd.ms-excel"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`Data-Koprasi-${startDate}-sampai-${endDate}.xls`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),0);
    toast(`Laporan ${startDate} sampai ${endDate} berhasil dibuat`);
    return true;
  }catch(error){toast(error.message,true);return false}
}
