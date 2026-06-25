const firebaseConfig = {
  apiKey: "AIzaSyBS__oDn1BoIBG8TiYQks6mFwQd9sBFn_Q",
  authDomain: "somtam-da7ab.firebaseapp.com",
  databaseURL: "https://somtam-da7ab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "somtam-da7ab",
  storageBucket: "somtam-da7ab.appspot.com",
  messagingSenderId: "388718531258",
  appId: "1:388718531258:web:f673d147f1c3357d4ea883",
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

const loginPage = document.getElementById('loginPage'); const adminPage = document.getElementById('adminPage');
const totalRevenue = document.getElementById('totalRevenue'); const orderCount = document.getElementById('orderCount');
const orderList = document.getElementById('orderList'); const filterDate = document.getElementById('filterDate');
const slipModal = document.getElementById('slipModal'); const modalSlipImg = document.getElementById('modalSlipImg');

let salesChartInstance = null; let topSellersChartInstance = null;
let allOrdersData = []; let currentFilter = 'all'; let isSoundEnabled = true;

const notificationSound = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3');

const allMenuNames = [
  "เหลาม้า+กุ้งสด+หอยแครง", "เหลาปูม้า+กุ้งสด", "เหลาปูม้า+หอยแครง", "เหลากุ้งสด+หอยโข่ง", "เหลาหอยแครง/หอยโข่ง", "เหลากุ้งสด/กุ้งสุก", "เหลาหอยแครง+กุ้งสด",
  "ตำปูม้า+หอยแครง+กุ้งสด", "ตำปูม้า+หอยแครง", "ตำปูม้า+กุ้งสด", "ตำกุ้งสด+หอยแครง", "ตำกุ้งสุก", "ตำปูม้าสด", "ตำหอยแครง", "ตำหอยโข่ง", "ตำปูปลาร้า", "ตำลาว", "ตำไทย",
  "ตำส้มโอ", "ตำกระท้อน", "ตำมะม่วง", "ตำผลไม้", "ตำข้าวโพด", "ไข่เค็ม", "ไข่เยี่ยวม้า", "หมูยอ", "หอยดอง", "ขนมจีน"
];

document.getElementById('loginBtn').addEventListener("click", () => {
  if (document.getElementById('username').value.trim() === "pinny" && document.getElementById('password').value.trim() === "020116") {
    sessionStorage.setItem("loggedIn", "true"); showAdminPage(); initAdmin();
  } else { document.getElementById("loginError").textContent = "ข้อมูลไม่ถูกต้อง"; document.getElementById("loginError").classList.remove("hidden"); }
});

function checkLogin() { sessionStorage.getItem("loggedIn") === "true" ? (showAdminPage(), initAdmin()) : (loginPage.classList.remove("hidden"), adminPage.classList.add("hidden")); }
document.getElementById('logoutBtn').onclick = () => { sessionStorage.removeItem("loggedIn"); location.reload(); };
function showAdminPage() { loginPage.classList.add("hidden"); adminPage.classList.remove("hidden"); }

document.getElementById('muteBtn').addEventListener('click', function() {
  isSoundEnabled = !isSoundEnabled;
  this.textContent = isSoundEnabled ? '🔊 เปิดเสียง' : '🔇 ปิดเสียง';
  this.classList.toggle('muted', !isSoundEnabled);
});

function initAdmin() {
  if (!filterDate.value) filterDate.value = new Date().toISOString().slice(0, 10);
  loadOrdersRealtime(filterDate.value); listenNewOrdersRealtime(filterDate.value); renderMenuManager();
}

filterDate.addEventListener("change", e => loadOrdersRealtime(e.target.value));

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active'); currentFilter = e.target.getAttribute('data-filter'); renderOrders();
  });
});

function loadOrdersRealtime(date) {
  db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").once("value").then(snapshot => {
    allOrdersData = []; let sum = 0;
    snapshot.forEach(snap => { if (snap.val().timestamp?.startsWith(date)) { allOrdersData.push({key: snap.key, ...snap.val()}); sum += snap.val().total; } });
    allOrdersData.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    totalRevenue.textContent = sum.toLocaleString('th-TH', {minimumFractionDigits: 2}); orderCount.textContent = allOrdersData.length;
    updateSalesChart(allOrdersData); updateTopSellersChart(allOrdersData); renderOrders();
  });
}

function renderOrders() {
  orderList.innerHTML = "";
  const filteredOrders = allOrdersData.filter(o => currentFilter === 'all' || o.status === currentFilter);
  if (filteredOrders.length === 0) return orderList.innerHTML = `<div style="padding: 20px; color:#999; text-align:center;">ไม่มีออเดอร์</div>`;
  const queueMap = {}; [...allOrdersData].reverse().forEach((o, i) => queueMap[o.key] = i + 1);

  filteredOrders.forEach((order) => {
    const div = document.createElement("div"); div.className = `order-item status-${order.status || 'รอทำ'}`;
    let slipHtml = '';
    if (order.paymentMethod === 'พร้อมเพย์' && order.slipImage) {
      slipHtml = `<div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:8px;">
        <p style="color:${order.slipVerified ? 'green' : 'orange'}; font-weight:bold; font-size:0.9rem;">${order.slipVerified ? '✅ สลิปตรวจสอบแล้ว' : '⚠️ รอตรวจสลิป'}</p>
        <img src="${order.slipImage}" style="max-width:80px; cursor:pointer; border-radius:8px; margin-top:5px;" onclick="viewSlip('${order.slipImage}')">
        ${!order.slipVerified ? `<button onclick="verifySlip('${order.key}')" style="margin-left:10px; padding:5px 10px; background:#00b894; color:white; border:none; border-radius:5px; cursor:pointer;">กดยืนยันสลิป</button>` : ''}
      </div>`;
    }
    div.innerHTML = `
      <div class="order-header"><span class="q-num" style="font-size:1.2rem; font-weight:bold; color:#00b894;">คิวที่ #${queueMap[order.key]}</span> <span style="color:#666; font-size:0.8rem;">${new Date(order.timestamp).toLocaleTimeString()}</span></div>
      <div><strong>จ่าย:</strong> <span style="background:#e1f5fe; color:#0288d1; padding:2px 8px; border-radius:10px; font-size:0.85rem;">${order.paymentMethod}</span> ${order.phone ? `| 📞 ${order.phone}` : ''}</div>
      <ul>${order.items.map(i => `<li>${i.name} x${i.qty}</li>`).join('')}</ul>
      <div style="text-align:right; font-weight:bold;">รวม ${order.total} ฿</div>
      ${order.note ? `<div style="color:#856404; background:#fff3cd; padding:5px; border-radius:5px; font-size:0.9rem; margin:5px 0;">📝 ${order.note}</div>` : ""} ${slipHtml}
      <div class="order-actions" style="margin-top:15px; display:flex; gap:10px;">
        <button onclick="updateOrderStatus('${order.key}', 'รอทำ')" style="flex:1; padding:8px; background:#fdcb6e; border:none; border-radius:5px; cursor:pointer;">⏳ รอทำ</button>
        <button onclick="updateOrderStatus('${order.key}', 'ทำเสร็จแล้ว')" style="flex:1; padding:8px; background:#00b894; color:white; border:none; border-radius:5px; cursor:pointer;">✅ เสร็จแล้ว</button>
        <button onclick="deleteOrder('${order.key}')" style="padding:8px; background:#ff7675; color:white; border:none; border-radius:5px; cursor:pointer;">🗑️</button>
      </div>
    `; orderList.appendChild(div);
  });
}

window.verifySlip = (key) => db.ref("orders/" + key + "/slipVerified").set(true).then(() => { Toastify({ text: "✅ ยืนยันสลิปสำเร็จ", duration: 2500, style: {background: "#00b894"} }).showToast(); loadOrdersRealtime(filterDate.value); });
window.updateOrderStatus = (key, status) => db.ref("orders/" + key + "/status").set(status).then(() => loadOrdersRealtime(filterDate.value));
window.deleteOrder = (key) => { if(confirm("ลบคำสั่งซื้อ?")) db.ref("orders/" + key).remove().then(() => loadOrdersRealtime(filterDate.value)); }
window.viewSlip = (b64) => { modalSlipImg.src = b64; slipModal.classList.remove('hidden'); }
document.querySelector('.close-modal').onclick = () => slipModal.classList.add('hidden');

function listenNewOrdersRealtime(date) {
  db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").on("child_added", snap => {
    if (snap.val().timestamp?.startsWith(date) && !allOrdersData.some(o => o.key === snap.key)) {
      if(isSoundEnabled) notificationSound.play().catch(e=>e);
      Toastify({ text: "🚨 มีออเดอร์ใหม่เข้า!", duration: 4000, style: { background: "#e17055" } }).showToast(); loadOrdersRealtime(date);
    }
  });
}

function updateTopSellersChart(orders) {
  const itemCounts = {}; orders.forEach(o => o.items.forEach(i => itemCounts[i.name] = (itemCounts[i.name] || 0) + i.qty));
  const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const data = { labels: sorted.map(i => i[0]), datasets: [{ data: sorted.map(i => i[1]), backgroundColor: ["#ff7675", "#74b9ff", "#55efc4", "#ffeaa7", "#a29bfe"] }] };
  if (topSellersChartInstance) { topSellersChartInstance.data = data; topSellersChartInstance.update(); } 
  else { topSellersChartInstance = new Chart(document.getElementById('topSellersChart').getContext('2d'), { type: "pie", data }); }
}

function updateSalesChart(orders) {
  const dataByDate = {}; orders.forEach(o => { const d = o.timestamp.slice(0, 10); dataByDate[d] = (dataByDate[d] || 0) + o.total; });
  const labels = Object.keys(dataByDate).sort(); const dataArr = labels.map(d => dataByDate[d]);
  const data = { labels, datasets: [{ label: "รายได้ (บาท)", data: dataArr, borderColor: "#00b894", backgroundColor: "rgba(0, 184, 148, 0.1)", fill: true, tension: 0.3 }] };
  if (salesChartInstance) { salesChartInstance.data = data; salesChartInstance.update(); } 
  else { salesChartInstance = new Chart(document.getElementById('salesChart').getContext('2d'), { type: "line", data, options: { responsive: true, scales: { y: { beginAtZero: true } } } }); }
}

function renderMenuManager() {
  db.ref("menuStatus").on("value", snap => {
    const status = snap.val() || {}; const c = document.getElementById('adminMenuList'); c.innerHTML = "";
    allMenuNames.forEach(menu => {
      const isOut = status[menu] === false;
      const div = document.createElement('div'); div.style = `padding:8px 15px; border:1px solid #dfe6e9; border-radius:8px; background:${isOut ? '#fff3cd' : '#fff'};`;
      div.innerHTML = `<label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" ${isOut ? 'checked' : ''} onchange="db.ref('menuStatus/${menu}').set(!this.checked)"> <span style="${isOut ? 'text-decoration:line-through; color:#d63031;' : ''}">${menu}</span></label>`;
      c.appendChild(div);
    });
  });
}

document.getElementById('resetQueueBtn').onclick = () => {
  if (confirm("🚨 คำเตือน: ต้องการลบคำสั่งซื้อวันนี้ทั้งหมดใช่หรือไม่?")) {
    const date = filterDate.value;
    db.ref("orders").orderByChild("timestamp").startAt(date).endAt(date + "\uf8ff").once("value").then(snap => {
      const updates = {}; snap.forEach(s => { if (s.val().timestamp?.startsWith(date)) updates[s.key] = null; });
      return db.ref("orders").update(updates);
    }).then(() => db.ref("lastOrderNumber").set(0)).then(() => loadOrdersRealtime(date));
  }
};

checkLogin();