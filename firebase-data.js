import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  addDoc, collection, doc, getDoc, getDocs, getFirestore, limit, query, runTransaction,
  serverTimestamp, where, writeBatch
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const text = (value, label) => {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} wajib diisi`);
  return result;
};
const number = (value, label, min = 0) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min) throw new Error(`${label} tidak valid`);
  return result;
};
const code = prefix => {
  const now = new Date();
  return `${prefix}-${now.toISOString().slice(0,10).replaceAll("-","")}-${now.toISOString().slice(11,19).replaceAll(":","")}-${crypto.randomUUID().slice(0,4).toUpperCase()}`;
};
const iso = value => value?.toDate ? value.toDate().toISOString() : (typeof value === "string" ? value : new Date(0).toISOString());
const newest = (a, b) => b.createdAt.localeCompare(a.createdAt);
const mapProduct = row => ({ id: row.id, ...row.data(), createdAt: iso(row.data().createdAt) });
const mapSale = row => ({ id: row.id, ...row.data(), createdAt: iso(row.data().createdAt), updatedAt:row.data().updatedAt?iso(row.data().updatedAt):null, voidedAt:row.data().voidedAt?iso(row.data().voidedAt):null });
const mapPayment = row => ({ id: row.id, ...row.data(), createdAt: iso(row.data().createdAt) });
const mapMovement = row => ({ id: row.id, ...row.data(), createdAt: iso(row.data().createdAt) });

export { firebaseConfigured };
export const watchAuth = callback => onAuthStateChanged(auth, callback);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export async function checkAccess(user) {
  if (!user) return false;
  try {
    const result = await getDoc(doc(db, "users", user.uid));
    return result.exists() && result.data().active === true;
  } catch { return false; }
}

async function listProducts() {
  const result = await getDocs(collection(db, "products"));
  return result.docs.map(mapProduct).sort((a,b) => a.name.localeCompare(b.name,"id"));
}
async function listSales() {
  const result = await getDocs(collection(db, "sales"));
  return result.docs.map(mapSale).filter(sale => sale.voided !== true).sort(newest);
}
async function listCustomers(sales = null) {
  const [result, allSales] = await Promise.all([
    getDocs(collection(db, "customers")),
    sales ? Promise.resolve(sales) : listSales()
  ]);
  return result.docs.map(row => {
    const transactions = allSales.filter(sale => sale.customerId === row.id);
    return {
      id: row.id, ...row.data(), createdAt: iso(row.data().createdAt),
      debtBalance: transactions.reduce((sum,sale) => sum + Number(sale.remaining || 0), 0),
      transactionCount: transactions.length
    };
  }).sort((a,b) => a.name.localeCompare(b.name,"id"));
}

export async function loadData() {
  const [products, sales] = await Promise.all([listProducts(), listSales()]);
  const customers = await listCustomers(sales);
  return { products, sales, customers, debts: sales.filter(sale => Number(sale.remaining) > 0) };
}

export async function addCustomer(data) {
  const result = await addDoc(collection(db,"customers"), {
    name: text(data.name,"Nama pembeli"),
    phone: String(data.phone || "").trim(),
    address: String(data.address || "").trim(),
    notes: String(data.notes || "").trim(),
    createdAt: serverTimestamp()
  });
  return result.id;
}

export async function addProduct(data) {
  const sku = text(data.sku,"Kode / SKU").toUpperCase();
  const duplicate = await getDocs(query(collection(db,"products"),where("sku","==",sku),limit(1)));
  if (!duplicate.empty) throw new Error("Kode / SKU sudah digunakan");
  const stock = number(data.initialStock || 0,"Stok awal");
  const productRef = doc(collection(db,"products"));
  const batch = writeBatch(db);
  batch.set(productRef, {
    sku, name:text(data.name,"Nama barang"), category:String(data.category||"Umum").trim()||"Umum",
    unit:text(data.unit,"Satuan"), purchasePrice:Math.round(number(data.purchasePrice,"Harga beli")),
    salePrice:Math.round(number(data.salePrice,"Harga jual")), stock,
    minStock:number(data.minStock||0,"Stok minimum"), createdAt:serverTimestamp(), updatedAt:serverTimestamp()
  });
  batch.set(doc(collection(db,"stockMovements")), {
    productId:productRef.id, movementType:"stok_awal", qtyChange:stock, balanceAfter:stock,
    referenceType:"barang", referenceId:productRef.id, notes:"Stok awal saat barang dibuat", createdAt:serverTimestamp()
  });
  await batch.commit();
}

export async function adjustStock(productId, delta, notes) {
  delta = number(Math.abs(Number(delta)),"Jumlah",0.000001) * (Number(delta) < 0 ? -1 : 1);
  notes = text(notes,"Keterangan");
  await runTransaction(db, async transaction => {
    const productRef = doc(db,"products",productId);
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists()) throw new Error("Barang tidak ditemukan");
    const product = snapshot.data();
    const balance = Number(product.stock) + delta;
    if (balance < 0) throw new Error(`Stok ${product.name} tidak cukup`);
    transaction.update(productRef,{stock:balance,updatedAt:serverTimestamp()});
    transaction.set(doc(collection(db,"stockMovements")), {
      productId, movementType:delta>0?"stok_masuk":"koreksi", qtyChange:delta, balanceAfter:balance,
      referenceType:"penyesuaian", referenceId:null, notes, createdAt:serverTimestamp()
    });
  });
}

export async function addSale(data) {
  const paymentType = text(data.paymentType,"Jenis pembayaran");
  if (!["tunai","bon"].includes(paymentType)) throw new Error("Jenis pembayaran tidak valid");
  const customerId = String(data.customerId || "").trim();
  if (paymentType === "bon" && !customerId) throw new Error("Pembeli wajib dipilih untuk transaksi bon");
  if (!Array.isArray(data.items) || !data.items.length) throw new Error("Minimal satu barang wajib dipilih");

  return runTransaction(db, async transaction => {
    let customer = null;
    if (customerId) {
      const customerSnapshot = await transaction.get(doc(db,"customers",customerId));
      if (!customerSnapshot.exists()) throw new Error("Pembeli tidak ditemukan");
      customer = customerSnapshot.data();
    }
    const productIds = [...new Set(data.items.map(item => text(item.productId,"Barang")))];
    const products = new Map();
    for (const productId of productIds) {
      const snapshot = await transaction.get(doc(db,"products",productId));
      if (!snapshot.exists()) throw new Error("Barang tidak ditemukan");
      products.set(productId,snapshot.data());
    }
    const items = data.items.map(item => {
      const product = products.get(item.productId);
      const qty = number(item.qty,"Jumlah",0.000001);
      const unitPrice = item.unitPrice === "" ? Number(product.salePrice) : number(item.unitPrice,"Harga jual");
      return { id:crypto.randomUUID(), productId:item.productId, productName:product.name, sku:product.sku,
        qty, unit:product.unit, unitPrice:Math.round(unitPrice), purchasePrice:Number(product.purchasePrice),
        subtotal:Math.round(qty*unitPrice) };
    });
    const requested = new Map();
    items.forEach(item => requested.set(item.productId,(requested.get(item.productId)||0)+item.qty));
    requested.forEach((qty,productId) => {
      const product = products.get(productId);
      if (Number(product.stock) < qty) throw new Error(`Stok ${product.name} tidak cukup. Tersedia ${product.stock} ${product.unit}`);
    });
    const total = items.reduce((sum,item) => sum+item.subtotal,0);
    const paidAmount = paymentType === "tunai" ? total : 0;
    const cashReceived = paymentType === "tunai" ? Math.round(number(data.cashReceived,"Uang diterima")) : 0;
    if (paymentType === "tunai" && cashReceived < total) throw new Error("Uang diterima kurang dari total");
    const debtSaleId = paymentType === "tunai" ? String(data.debtSaleId||"") : "";
    const debtAmount = debtSaleId ? Math.round(number(data.debtAmount,"Cicilan",1)) : 0;
    const excess = cashReceived-total;
    let targetDebt = null;
    if (debtSaleId) {
      const snapshot = await transaction.get(doc(db,"sales",debtSaleId));
      if (!snapshot.exists()) throw new Error("Bon tidak ditemukan");
      targetDebt = snapshot.data();
      if (!customerId || targetDebt.customerId !== customerId) throw new Error("Bon tidak sesuai pembeli");
      if (Number(targetDebt.remaining) <= 0) throw new Error("Bon sudah lunas");
      if (debtAmount > Number(targetDebt.remaining) || debtAmount > excess) throw new Error("Jumlah cicilan terlalu besar");
    }
    const saleRef = doc(collection(db,"sales"));
    const invoiceNo = code("TRX");
    const remaining = total-paidAmount;
    const changeReturned = paymentType === "tunai" ? excess-debtAmount : 0;
    transaction.set(saleRef, {
      invoiceNo, customerId:customerId||null, customerName:customer?.name||"Pembeli umum",
      phone:customer?.phone||"", address:customer?.address||"", paymentType, total, paidAmount,
      cashReceived, changeReturned, debtApplied:debtAmount, remaining,
      status:paymentType==="tunai"?"lunas":"belum_lunas", notes:String(data.notes||""),
      itemSummary:items.map(item=>`${item.productName} (${item.qty} ${item.unit})`).join(", "),
      itemCount:items.length, items, voided:false, editCount:0, createdAt:serverTimestamp()
    });
    const running = new Map();
    items.forEach(item => {
      const current = running.has(item.productId) ? running.get(item.productId) : Number(products.get(item.productId).stock);
      const balance = current-item.qty;
      running.set(item.productId,balance);
      transaction.set(doc(collection(db,"stockMovements")), {
        productId:item.productId, movementType:"penjualan", qtyChange:-item.qty, balanceAfter:balance,
        referenceType:"transaksi", referenceId:saleRef.id, notes:invoiceNo, createdAt:serverTimestamp()
      });
    });
    running.forEach((balance,productId) => transaction.update(doc(db,"products",productId),{stock:balance,updatedAt:serverTimestamp()}));
    if (targetDebt) {
      const next = Number(targetDebt.remaining)-debtAmount;
      transaction.update(doc(db,"sales",debtSaleId), {
        paidAmount:Number(targetDebt.paidAmount)+debtAmount, remaining:next, status:next===0?"lunas":"sebagian"
      });
      transaction.set(doc(collection(db,"payments")), {
        paymentNo:code("BYR"), saleId:debtSaleId, sourceSaleId:saleRef.id,
        targetInvoiceNo:targetDebt.invoiceNo, customerId, customerName:customer.name,
        amount:debtAmount, method:"Uang lebih transaksi", notes:`Dialihkan dari ${invoiceNo}`, createdAt:serverTimestamp()
      });
    }
    return invoiceNo;
  });
}

export async function payDebt(saleId, amount, method, notes) {
  amount = Math.round(number(amount,"Jumlah pembayaran",1));
  await runTransaction(db, async transaction => {
    const saleRef = doc(db,"sales",saleId);
    const snapshot = await transaction.get(saleRef);
    if (!snapshot.exists()) throw new Error("Bon tidak ditemukan");
    const sale = snapshot.data();
    if (sale.voided === true) throw new Error("Transaksi sudah dibatalkan");
    if (Number(sale.remaining) <= 0) throw new Error("Bon sudah lunas");
    if (amount > Number(sale.remaining)) throw new Error("Pembayaran melebihi sisa bon");
    const remaining = Number(sale.remaining)-amount;
    transaction.update(saleRef,{paidAmount:Number(sale.paidAmount)+amount,remaining,status:remaining===0?"lunas":"sebagian"});
    transaction.set(doc(collection(db,"payments")), {
      paymentNo:code("BYR"), saleId, sourceSaleId:null, targetInvoiceNo:sale.invoiceNo,
      customerId:sale.customerId||null, customerName:sale.customerName, amount,
      method:method||"Tunai", notes:notes||"", createdAt:serverTimestamp()
    });
  });
}

export async function updateSale(saleId, data) {
  const paymentType = text(data.paymentType,"Jenis pembayaran");
  if (!["tunai","bon"].includes(paymentType)) throw new Error("Jenis pembayaran tidak valid");
  const customerId = String(data.customerId || "").trim();
  if (paymentType === "bon" && !customerId) throw new Error("Pembeli wajib dipilih untuk transaksi bon");
  if (!Array.isArray(data.items) || !data.items.length) throw new Error("Minimal satu barang wajib dipilih");
  const reason = text(data.editNotes,"Alasan koreksi");

  const [incomingResult,outgoingResult] = await Promise.all([
    getDocs(query(collection(db,"payments"),where("saleId","==",saleId))),
    getDocs(query(collection(db,"payments"),where("sourceSaleId","==",saleId)))
  ]);
  const incoming = incomingResult.docs.filter(row => row.data().voided !== true);
  const outgoing = outgoingResult.docs.filter(row => row.data().voided !== true);

  return runTransaction(db, async transaction => {
    const saleRef = doc(db,"sales",saleId);
    const saleSnapshot = await transaction.get(saleRef);
    if (!saleSnapshot.exists()) throw new Error("Transaksi tidak ditemukan");
    const previous = saleSnapshot.data();
    if (previous.voided === true) throw new Error("Transaksi sudah dibatalkan");
    if ((incoming.length || outgoing.length) && paymentType !== previous.paymentType) {
      throw new Error("Jenis pembayaran tidak dapat diubah karena sudah terhubung dengan cicilan");
    }
    if ((incoming.length || outgoing.length) && customerId !== String(previous.customerId || "")) {
      throw new Error("Pembeli tidak dapat diubah karena sudah terhubung dengan cicilan");
    }

    let customer = null;
    if (customerId) {
      const customerSnapshot = await transaction.get(doc(db,"customers",customerId));
      if (!customerSnapshot.exists()) throw new Error("Pembeli tidak ditemukan");
      customer = customerSnapshot.data();
    }

    const requestedProductIds = data.items.map(item => text(item.productId,"Barang"));
    const previousProductIds = (previous.items || []).map(item => item.productId);
    const productIds = [...new Set([...requestedProductIds,...previousProductIds])];
    const products = new Map();
    for (const productId of productIds) {
      const snapshot = await transaction.get(doc(db,"products",productId));
      if (!snapshot.exists()) throw new Error("Barang tidak ditemukan");
      products.set(productId,snapshot.data());
    }

    const items = data.items.map((item,index) => {
      const product = products.get(requestedProductIds[index]);
      const itemQty = number(item.qty,"Jumlah",0.000001);
      const unitPrice = item.unitPrice === "" ? Number(product.salePrice) : number(item.unitPrice,"Harga jual");
      return { id:item.id || crypto.randomUUID(), productId:requestedProductIds[index], productName:product.name, sku:product.sku,
        qty:itemQty, unit:product.unit, unitPrice:Math.round(unitPrice), purchasePrice:Number(product.purchasePrice),
        subtotal:Math.round(itemQty*unitPrice) };
    });

    const oldQty = new Map(), newQty = new Map();
    (previous.items || []).forEach(item => oldQty.set(item.productId,(oldQty.get(item.productId)||0)+Number(item.qty)));
    items.forEach(item => newQty.set(item.productId,(newQty.get(item.productId)||0)+Number(item.qty)));
    const nextStocks = new Map();
    productIds.forEach(productId => {
      const next = Number(products.get(productId).stock)+(oldQty.get(productId)||0)-(newQty.get(productId)||0);
      if (next < 0) throw new Error(`Stok ${products.get(productId).name} tidak cukup untuk koreksi ini`);
      nextStocks.set(productId,next);
    });

    const total = items.reduce((sum,item) => sum+item.subtotal,0);
    const linkedDebtAmount = outgoing.reduce((sum,row) => sum+Number(row.data().amount||0),0);
    let paidAmount, cashReceived, changeReturned, remaining, status;
    if (paymentType === "tunai") {
      cashReceived = Math.round(number(data.cashReceived,"Uang diterima"));
      if (cashReceived < total+linkedDebtAmount) throw new Error("Uang diterima kurang dari total dan cicilan yang sudah dialihkan");
      paidAmount = total; remaining = 0; status = "lunas";
      changeReturned = cashReceived-total-linkedDebtAmount;
    } else {
      cashReceived = 0; changeReturned = 0;
      paidAmount = previous.paymentType==="bon" ? Number(previous.paidAmount||0) : 0;
      if (total < paidAmount) throw new Error("Total baru lebih kecil dari cicilan yang sudah dibayar");
      remaining = total-paidAmount;
      status = remaining===0 ? "lunas" : paidAmount>0 ? "sebagian" : "belum_lunas";
    }

    transaction.update(saleRef, {
      customerId:customerId||null, customerName:customer?.name||"Pembeli umum",
      phone:customer?.phone||"", address:customer?.address||"", paymentType, total, paidAmount,
      cashReceived, changeReturned, debtApplied:linkedDebtAmount, remaining, status,
      itemSummary:items.map(item=>`${item.productName} (${item.qty} ${item.unit})`).join(", "),
      itemCount:items.length, items, editNotes:reason,
      editCount:Number(previous.editCount||0)+1, updatedAt:serverTimestamp()
    });

    productIds.forEach(productId => {
      const delta = (oldQty.get(productId)||0)-(newQty.get(productId)||0);
      if (!delta) return;
      const balance = nextStocks.get(productId);
      transaction.update(doc(db,"products",productId),{stock:balance,updatedAt:serverTimestamp()});
      transaction.set(doc(collection(db,"stockMovements")), {
        productId, movementType:"koreksi_edit_transaksi", qtyChange:delta, balanceAfter:balance,
        referenceType:"transaksi", referenceId:saleId,
        notes:`Koreksi ${previous.invoiceNo}: ${reason}`, createdAt:serverTimestamp()
      });
    });
    return previous.invoiceNo;
  });
}

export async function voidSale(saleId, reason) {
  reason = text(reason,"Alasan pembatalan");
  const [incomingResult,outgoingResult] = await Promise.all([
    getDocs(query(collection(db,"payments"),where("saleId","==",saleId))),
    getDocs(query(collection(db,"payments"),where("sourceSaleId","==",saleId)))
  ]);
  const incoming = incomingResult.docs.filter(row => row.data().voided !== true);
  const outgoing = outgoingResult.docs.filter(row => row.data().voided !== true);

  await runTransaction(db, async transaction => {
    const saleRef = doc(db,"sales",saleId);
    const saleSnapshot = await transaction.get(saleRef);
    if (!saleSnapshot.exists()) throw new Error("Transaksi tidak ditemukan");
    const sale = saleSnapshot.data();
    if (sale.voided === true) throw new Error("Transaksi sudah dibatalkan");

    const soldQty = new Map();
    (sale.items||[]).forEach(item => soldQty.set(item.productId,(soldQty.get(item.productId)||0)+Number(item.qty)));
    const products = new Map();
    for (const productId of soldQty.keys()) {
      const snapshot = await transaction.get(doc(db,"products",productId));
      if (!snapshot.exists()) throw new Error("Barang transaksi tidak ditemukan");
      products.set(productId,snapshot.data());
    }

    const linkedIds = [...new Set([
      ...incoming.map(row=>row.data().sourceSaleId).filter(Boolean),
      ...outgoing.map(row=>row.data().saleId).filter(Boolean)
    ])].filter(id=>id!==saleId);
    const linkedSales = new Map();
    for (const id of linkedIds) {
      const snapshot = await transaction.get(doc(db,"sales",id));
      if (snapshot.exists()) linkedSales.set(id,snapshot.data());
    }

    soldQty.forEach((amount,productId) => {
      const balance = Number(products.get(productId).stock)+amount;
      transaction.update(doc(db,"products",productId),{stock:balance,updatedAt:serverTimestamp()});
      transaction.set(doc(collection(db,"stockMovements")), {
        productId, movementType:"pembatalan_transaksi", qtyChange:amount, balanceAfter:balance,
        referenceType:"transaksi", referenceId:saleId,
        notes:`Pembatalan ${sale.invoiceNo}: ${reason}`, createdAt:serverTimestamp()
      });
    });

    const returnedToSources = new Map();
    incoming.forEach(row => {
      const sourceId = row.data().sourceSaleId;
      if (sourceId) returnedToSources.set(sourceId,(returnedToSources.get(sourceId)||0)+Number(row.data().amount||0));
      transaction.update(row.ref,{voided:true,voidReason:reason,voidedAt:serverTimestamp()});
    });
    returnedToSources.forEach((amount,sourceId) => {
      const source = linkedSales.get(sourceId);
      if (!source || source.voided===true) return;
      transaction.update(doc(db,"sales",sourceId),{
        debtApplied:Math.max(0,Number(source.debtApplied||0)-amount),
        changeReturned:Number(source.changeReturned||0)+amount,
        updatedAt:serverTimestamp()
      });
    });

    const restoredToTargets = new Map();
    outgoing.forEach(row => {
      const targetId = row.data().saleId;
      if (targetId) restoredToTargets.set(targetId,(restoredToTargets.get(targetId)||0)+Number(row.data().amount||0));
      transaction.update(row.ref,{voided:true,voidReason:reason,voidedAt:serverTimestamp()});
    });
    restoredToTargets.forEach((amount,targetId) => {
      const target = linkedSales.get(targetId);
      if (!target || target.voided===true) return;
      const paidAmount = Math.max(0,Number(target.paidAmount||0)-amount);
      const remaining = Math.min(Number(target.total||0),Number(target.remaining||0)+amount);
      transaction.update(doc(db,"sales",targetId),{
        paidAmount,remaining,status:remaining===0?"lunas":paidAmount>0?"sebagian":"belum_lunas",
        updatedAt:serverTimestamp()
      });
    });

    transaction.update(saleRef,{
      voided:true,voidReason:reason,voidedAt:serverTimestamp(),updatedAt:serverTimestamp()
    });
  });
}

export async function getTrace(kind, id) {
  if (kind === "transaction") {
    const saleSnapshot = await getDoc(doc(db,"sales",id));
    if (!saleSnapshot.exists()) throw new Error("Transaksi tidak ditemukan");
    const sale = mapSale(saleSnapshot);
    const [paymentsResult, allocationsResult] = await Promise.all([
      getDocs(query(collection(db,"payments"),where("saleId","==",id))),
      getDocs(query(collection(db,"payments"),where("sourceSaleId","==",id)))
    ]);
    return {kind,sale,items:sale.items||[],payments:paymentsResult.docs.filter(row=>row.data().voided!==true).map(mapPayment).sort(newest),allocations:allocationsResult.docs.filter(row=>row.data().voided!==true).map(mapPayment).sort(newest)};
  }
  if (kind === "customer") {
    const snapshot = await getDoc(doc(db,"customers",id));
    if (!snapshot.exists()) throw new Error("Pembeli tidak ditemukan");
    const sales = (await listSales()).filter(sale=>sale.customerId===id);
    return {kind,customer:{id,...snapshot.data(),createdAt:iso(snapshot.data().createdAt),debtBalance:sales.reduce((sum,s)=>sum+Number(s.remaining),0)},transactions:sales};
  }
  if (kind === "product") {
    const snapshot = await getDoc(doc(db,"products",id));
    if (!snapshot.exists()) throw new Error("Barang tidak ditemukan");
    const [movementResult,sales] = await Promise.all([
      getDocs(query(collection(db,"stockMovements"),where("productId","==",id))),listSales()
    ]);
    const transactions = sales.flatMap(sale=>(sale.items||[]).filter(item=>item.productId===id).map(item=>({sale,...item}))).sort((a,b)=>newest(a.sale,b.sale));
    return {kind,product:mapProduct(snapshot),movements:movementResult.docs.map(mapMovement).sort(newest),transactions};
  }
  throw new Error("Jejak tidak ditemukan");
}

export async function getExportData() {
  const [data,paymentResult,movementResult] = await Promise.all([
    loadData(),getDocs(collection(db,"payments")),getDocs(collection(db,"stockMovements"))
  ]);
  return {
    products:data.products, customers:data.customers, sales:data.sales,
    payments:paymentResult.docs.map(mapPayment).sort(newest),
    movements:movementResult.docs.map(mapMovement).sort(newest)
  };
}
