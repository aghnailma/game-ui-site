/* ================================================= */
/* 🛠️ CORE UTILITIES                                 */
/* ================================================= */

// Ganti Baris 5 dengan ini:
const $ = (selector) => document.querySelector(selector) || document.getElementById(selector);
const $$ = (q) => document.querySelectorAll(q);

/* ================================================= */
/* 📦 DATABASE ITEM & HARGA                          */
/* ================================================= */

const ItemDB = {
  // --- HASIL PANEN & MAKANAN ---
  'carrot': { type: 'crop', name: 'Wortel', icon: '🥕', price: 15, desc: 'Sayur sehat. Pulihkan +2 Energi.', energy: 2 },
  'corn':   { type: 'crop', name: 'Jagung', icon: '🌽', price: 40, desc: 'Manis & mahal. Pulihkan +3 Energi.', energy: 3 },
  'fish':   { type: 'crop', name: 'Ikan Mas', icon: '🐟', price: 25, desc: 'Protein tinggi! Pulihkan +5 Energi.', energy: 5 },

  // --- BIBIT (SEED) ---
  'seed_carrot': { 
    type: 'seed', name: 'Bibit Wortel', icon: '🌰', price: 5,  output: 'carrot', growTime: 5000,
    reqLevel: 1 // Level 1 sudah bisa beli
  },
  'seed_corn': { 
    type: 'seed', name: 'Bibit Jagung', icon: '🌽', price: 20, output: 'corn',   growTime: 10000,
    reqLevel: 2 // <--- LEVEL LOCK: Cuma bisa dibeli di Level 2
  },
};

/* ================================================= */
/* 💾 GAME STATE                                     */
/* ================================================= */

const SAVE_KEY = "cozy_life_save";

const Game = {
  scene: "loading",
  isPaused: false,
  
  player: {
    level: 1,
    exp: 0,
    expToNext: 50,
    title: "Wanderer",
  },

  resources: {
    gold: 0,
    energy: 5,
    maxEnergy: 5,
  },

  stats: {
    totalHarvest: 0, // Total tanaman dipanen
    totalGold: 0,    // Total uang dikumpulkan
    totalFish: 0,    // Total ikan ditangkap
    totalSleep: 0,   // Berapa kali tidur
    playTime: 0      // (Nanti bisa buat jam main)
  },

  inventory: {
    'carrot': 0,
    'corn': 0,
    'fish': 0,
    'seed_carrot': 2,
    'seed_corn': 0
  },

  // --- UPDATE STRUKTUR DATA KEBUN ---
  garden: [
    { id: 0, state: 0, crop: null, finishTime: 0, totalTime: 0 }, // Tambah totalTime
    { id: 1, state: 0, crop: null, finishTime: 0, totalTime: 0 },
    { id: 2, state: 0, crop: null, finishTime: 0, totalTime: 0 },
  ],
  // ----------------------------------------

  quest: {
    active: null,
    step: 0,
    completed: {},
  },

  audioState: {
    bgmPlaying: false,
    ambiencePlaying: false
  }
};

/* ================================================= */
/* 🔊 AUDIO MANAGER (SYNTHESIZER + AMBIENCE FIX)     */
/* ================================================= */

const AudioSys = {
  ctx: null,          // Wadah Audio Context
  bgmVolume: 0.3,     // Simpan volume BGM
  sfxVolume: 0.6,     // Simpan volume SFX
  ambienceVolume: 0.5, // Simpan volume Ambience (Hujan)

  init() {
    // 1. Inisialisasi Audio Context
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    
    // Resume jika browser men-suspend audio
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  setVolume(type, val) {
    const volume = parseFloat(val);

    if (type === 'bgm') {
      this.bgmVolume = volume;
      const bgmEl = $("bgm-music");
      if(bgmEl) bgmEl.volume = this.bgmVolume;
    } 
    // --- LOGIKA AMBIENCE (HUJAN) ---
    else if (type === 'ambience') {
      this.ambienceVolume = volume;
      const ambEl = $("sfx-ambience");
      if(ambEl) ambEl.volume = this.ambienceVolume;
    }
    // -------------------------------
    else if (type === 'sfx') {
      this.sfxVolume = volume;
    }
  },

  // --- FUNGSI PENCIPTA SUARA (OSCILLATOR) ---
  playTone(freq, type, duration, time = 0) {
    if (!this.ctx) this.init();

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type; 
    osc.frequency.value = freq;

    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    // Atur Volume sesuai settingan SFX
    gainNode.gain.value = this.sfxVolume;

    // Efek Fade Out
    gainNode.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime + time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + time + duration);

    osc.start(this.ctx.currentTime + time);
    osc.stop(this.ctx.currentTime + time + duration);
  },

  // --- PRESET SUARA SFX (LENGKAP) ---
  playSFX(name) {
    if (!this.ctx) this.init();

    switch (name) {
      case 'click':
        this.playTone(600, 'sine', 0.1); 
        break;

      case 'popup':
      case 'message':
        this.playTone(1200, 'sine', 0.3);
        break;

      case 'coin':
      case 'success':
        this.playTone(523.25, 'sine', 0.1, 0);     // Do
        this.playTone(659.25, 'sine', 0.4, 0.1);   // Mi
        break;

      case 'error':
        this.playTone(150, 'triangle', 0.3);
        break;
        
      case 'type':
        this.playTone(800, 'sine', 0.05);
        break;

      case 'menu_open':
        this.playTone(400, 'sine', 0.2);
        break;
        
      case 'water':
        this.playTone(300, 'triangle', 0.2);
        break;
    }
  },
  
  // Fungsi BGM (MP3)
  playBGM(src) {
    const bgm = $("bgm-music");
    if (bgm && bgm.getAttribute('src') !== src) {
      bgm.src = src;
      bgm.volume = this.bgmVolume; 
      bgm.play().catch(e => console.log("Waiting for interaction"));
    }
  },

  // Fungsi Ambience (MP3) - Sudah diperbaiki
  playAmbience() {
    const amb = $("sfx-ambience");
    if(amb) {
      amb.volume = this.ambienceVolume; // Set volume saat mulai
      amb.play().catch(()=>{});
    }
  }
};

/* ================================================= */
/* 💬 DIALOG SYSTEM (AUTO CLOSE)                     */
/* ================================================= */

const Dialog = {
  overlay: $("dialog-overlay"),
  title: $("dialog-title"),
  text: $("dialog-text"),
  timer: null,      // Timer untuk efek mengetik
  closeTimer: null, // Timer untuk tutup otomatis (BARU)

  show(name, message) {
    // 1. Reset semua timer lama biar gak tabrakan
    if (this.timer) clearTimeout(this.timer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    
    // 2. Tampilkan Overlay
    this.overlay.classList.remove("hidden");
    this.title.innerText = name;
    this.text.innerText = ""; // Kosongkan teks lama
    
    // 3. Mulai ketik efek
    this.typeWriter(message, 0);

    // --- LOGIKA AUTO CLOSE BARU ---
    // Waktu dasar 2 detik + (50ms per huruf)
    // Contoh: Teks 100 huruf = 2000 + 5000 = 7 detik
    const duration = 1000 + (message.length * 50);

    this.closeTimer = setTimeout(() => {
      this.hide();
    }, duration);
    // ------------------------------
  },

  typeWriter(message, index) {
    if (index < message.length) {
      this.text.innerHTML += message.charAt(index);
      // Kecepatan ngetik (10ms)
      this.timer = setTimeout(() => this.typeWriter(message, index + 1), 10);
    } else {
      this.timer = null; 
    }
  },

  hide() {
    this.overlay.classList.add("hidden");
    
    // Bersihkan semua timer saat ditutup paksa/otomatis
    if (this.timer) clearTimeout(this.timer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }
};

/* ================================================= */
/* 🎬 SCENE SYSTEM                                   */
/* ================================================= */

function switchScene(target) {
  $$(".scene").forEach(s => s.classList.remove("active"));
  $(`scene-${target}`)?.classList.add("active");
  Game.scene = target;

  const bottomUI = document.querySelector(".ui-bottom"); // Ambil elemen UI bawah
  
  if (target === 'minigame') {
    // Kalau sedang main minigame, sembunyikan dialog
    if (bottomUI) bottomUI.style.display = 'none';
    
  } else {
    // Kalau di scene lain (world/home), munculkan lagi
    if (bottomUI) bottomUI.style.display = 'block';
  }
  
  // Audio Logic per Scene
  if (target === "world") {
    AudioSys.playAmbience(); // Mulai suara hujan/alam
    AudioSys.playBGM('bgm_enlivening.mp3'); // Mulai suara bgm
  }
}

/* ================================================= */
/* 💾 SAVE / LOAD SYSTEM                             */
/* ================================================= */

// Fungsi untuk menampilkan indikator save di pojok
function showSaveSpinner() {
  const indicator = $("#save-indicator");
  if (!indicator) return;

  // Munculkan indikator
  indicator.classList.add("saving");

  // Sembunyikan lagi setelah 2 detik
  setTimeout(() => {
    indicator.classList.remove("saving");
  }, 2000);
}

function saveGame() {
  // 1. Simpan Data ke Memory HP/Laptop
  localStorage.setItem(SAVE_KEY, JSON.stringify(Game));
  console.log("Game saved to local storage.");
  
  // 2. Panggil Animasi Spinner (Bukan Popup Teks lagi)
  showSaveSpinner(); 
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    Object.assign(Game.player, data.player);
    Object.assign(Game.resources, data.resources);
    Object.assign(Game.quest, data.quest);
    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  location.reload(); // Reload agar bersih total
}

/* ================================================= */
/* 🌍 TIME & WEATHER ENGINE                          */
/* ================================================= */

function updateTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, "0");

  // 1. WAKTU
  $("#time").innerText = `${String(hours).padStart(2,"0")}:${minutes}`;

  // 2. TIMEZONE (Trik: Ambil string lengkap, potong kata terakhirnya)
  // Contoh hasil: "Jumat, 2 Jan 2026 WIB" -> diambil "WIB"-nya saja
  const fullDateString = now.toLocaleDateString("id-ID", { timeZoneName: "short" });
  const timeZoneName = fullDateString.split(" ").pop(); 
  
  // Pastikan elemen #timezone ada sebelum diisi (buat jaga-jaga)
  const tzElement = $("#timezone");
  if(tzElement) tzElement.innerText = timeZoneName;

  // 3. TANGGAL (Hari, Tgl Bln Thn)
  $("#date").innerText = now.toLocaleDateString("id-ID", {
    weekday: "short", 
    day: "numeric", 
    month: "short",
    year: "numeric" 
  });

  updateDayPhase(hours);
}

function updateDayPhase(hour) {
  const body = document.body;
  body.classList.remove("day", "evening", "night");

  let phase = "";
  if (hour >= 5 && hour < 16) {
    phase = "day";
  } else if (hour >= 16 && hour < 19) {
    phase = "evening";
  } else {
    phase = "night";
  }
  
  body.classList.add(phase);
}

async function updateWeatherByLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const data = await res.json();
      const code = data.current_weather.weathercode;

      let label = "☀ Cerah";
      if (code > 3) label = "☁ Berawan";
      if (code >= 51) label = "🌧 Hujan";
      if (code >= 80) label = "⛈ Badai";

      $("#weather").innerText = label;
      
      // Update sfx ambience jika hujan (logika lanjutan nanti)
    } catch {
      console.log("Weather offline mode");
    }
  });
}

/* ================================================= */
/* ⚔️ QUEST & INTERACTION SYSTEM                     */
/* ================================================= */

function handleObjectClick(type) {
  AudioSys.playSFX('click');

  switch (type) {
    case 'home':
      openOverlay('home'); // Sekarang membuka menu, bukan dialog teks
      break;

    // --- TAMBAHKAN BAGIAN INI ---
    case 'shop':
      openOverlay('shop'); // Buka menu toko
      break;
    // ----------------------------

    // --- TAMBAHKAN CASE INI ---
    case 'board':
      // Cek jika quest sudah selesai atau belum
      if (!Game.quest.completed['water']) {
        startQuest('water');
        Dialog.show("Quest Board", "Quest Diterima: Siram tanamanmu agar tumbuh subur!");
      } else {
        Dialog.show("Quest Board", "Tidak ada quest baru saat ini.");
      }
      break;
    // --------------------------

    case 'garden':
      handleGardenInteract();
      break;

      case 'pond':
      // Cek dulu, punya energi gak?
      if (Game.resources.energy > 0) {
        switchScene('minigame');
        startMiniGame();
      } else {
        // Kalau habis, suruh tidur
        Dialog.show("Low Energy", "Kamu terlalu lelah. Tidur dulu di rumah.");
      }
      break;
      
    default:
      Dialog.show("System", "Objek ini belum bisa digunakan.");
  }
}

function openQuestBoard() {
  AudioSys.playSFX('menu_open'); // Bunyi buka menu

  // Logika Cek Quest
  const questID = 'water'; // ID Quest pertama kita

  // 1. Jika Quest sudah tamat
  if (Game.quest.completed[questID]) {
    Dialog.show("Quest Board", "Semua quest hari ini sudah selesai. Istirahatlah!");
  } 
  // 2. Jika Quest sedang aktif (sedang dikerjakan)
  else if (Game.quest.active === questID) {
    Dialog.show("Quest Board", "Misi Berjalan: Siram tanamanmu sampai panen.");
  } 
  // 3. Jika Belum ambil quest (Baru mulai)
  else {
    startQuest(questID);
    Dialog.show("Quest Board", "Quest Diterima: Siram tanamanmu agar tumbuh subur! (Tap kebun)");
  }
}

function startQuest(id) {
  Game.quest.active = id;
  updateQuestUI("Water the Plants", "Tap Garden to water");
  saveGame();
}

function completeQuest(id) {
  Game.quest.completed[id] = true;
  Game.quest.active = null;
  gainExp(100);
  updateQuestUI("No Active Quest", "Explore the world");
  saveGame();
}

function updateQuestUI(title, hint) {
  $("active-quest").innerText = title;
  $("quest-impact").innerText = hint;
}

/* ================================================= */
/* 📈 PLAYER PROGRESSION                             */
/* ================================================= */

function gainExp(amount) {
  Game.player.exp += amount;
  showPopup(`+${amount} EXP`);

  if (Game.player.exp >= Game.player.expToNext) {
    levelUp();
  }
  updatePlayerUI();
  saveGame();
}

function levelUp() {
  Game.player.exp -= Game.player.expToNext;
  Game.player.level++;
  Game.player.expToNext = Math.floor(Game.player.expToNext * 1.5);
  
  AudioSys.playSFX('levelup');
  
  // --- EFEK VISUAL LEVEL UP ---
  // Ledakan partikel Emas di tengah layar (window.innerWidth / 2)
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, "#ffd700");
  // ----------------------------
  
  Dialog.show("Level Up!", `Selamat! Kamu mencapai Level ${Game.player.level}!`);
}

function updatePlayerUI() {
  $("player-level").innerText = Game.player.level;
  
  const percent = (Game.player.exp / Game.player.expToNext) * 100;
  document.querySelector(".exp-fill").style.width = `${percent}%`;
}

/* ================================================= */
/* 🎮 MINIGAME LOGIC (TIMING BAR)                    */
/* ================================================= */

function startMiniGame() {
  // 1. Reset Tampilan
  const cursor = $("#fish-cursor");
  const target = $("#fish-target");
  const btnCatch = $("#btn-catch");
  
  cursor.classList.remove("stopped"); // Jalankan animasi
  btnCatch.disabled = false; // Aktifkan tombol
  btnCatch.innerText = "🎣 TARIK!";
  
  // 2. Acak Posisi Target (Biar gak monoton)
  // Lebar target antara 20% s/d 40%
  const width = Math.floor(Math.random() * 20) + 20; 
  // Posisi kiri antara 0% s/d (100% - lebar)
  const left = Math.floor(Math.random() * (90 - width)); 
  
  target.style.width = `${width}%`;
  target.style.left = `${left}%`;

  // 3. Bind Event Klik
  btnCatch.onclick = () => catchFish(width, left);
}

function catchFish(targetWidth, targetLeft) {
  const cursor = $("#fish-cursor");
  const btnCatch = $("#btn-catch");

  // 1. Stop Animasi
  cursor.classList.add("stopped");
  btnCatch.disabled = true; // Matikan tombol biar gak spam

  Game.resources.energy--; // Kurangi 1
  updateResourcesUI();     // Update tampilan angka
  saveGame();              // Simpan otomatis

  // 2. Hitung Posisi (Matematika dikit)
  // Ambil posisi jarum saat ini dari CSS yang sedang jalan
  const containerWidth = $(".fishing-bar-container").offsetWidth;
  const cursorLeftPx = cursor.offsetLeft;
  
  // Konversi posisi jarum ke Persen (%) biar sama dengan target
  const cursorPercent = (cursorLeftPx / containerWidth) * 100;

  // 3. Cek Apakah Kena?
  // Jarum harus lebih besar dari batas kiri target DAN lebih kecil dari batas kanan target
  const targetRight = targetLeft + targetWidth;
  const isHit = cursorPercent >= targetLeft && cursorPercent <= targetRight;

  if (isHit) {
    // --- SUKSES ---
    AudioSys.playSFX('success');
    btnCatch.innerText = "DAPAT! 🐟";
    
    // Reward
    const rewardExp = 25;
    Game.inventory['fish']++;

    // --- CATAT STATISTIK ---
    Game.stats.totalFish++;
    // -----------------------

    gainExp(rewardExp);
    
    // Kembali ke dunia setelah 1 detik
    setTimeout(() => {
      switchScene('world');
      Dialog.show("Fishing Success", `Mantap! Kamu menangkap 1x 🐟 Ikan Mas (+${rewardExp} XP)`);
      
      // Update inventory UI kalau sedang terbuka (opsional)
      updateResourcesUI();
    }, 1000);

  } else {
    // --- GAGAL ---
    AudioSys.playSFX('error'); // Pastikan ada suara error/buzzer
    btnCatch.innerText = "LEPAS... 💨";
    btnCatch.style.background = "#ff5555"; // Merah tanda gagal

    setTimeout(() => {
      switchScene('world');
      Dialog.show("Fishing Failed", "Yah... Ikannya kabur. Coba lagi nanti!");
      
      // Reset warna tombol
      btnCatch.style.background = ""; 
    }, 1000);
  }
}

/* ================================================= */
/* 🖥️ UI HANDLERS                                    */
/* ================================================= */

function renderInventory() {
  const container = $("#inventory-grid");
  if (!container) return;
  container.innerHTML = ""; 

  let hasItem = false;

  for (const [key, qty] of Object.entries(Game.inventory)) {
    if (qty > 0) {
      hasItem = true;
      const item = ItemDB[key]; 
      if (!item) continue; 

      const div = document.createElement("div");
      div.className = "inv-item glass";
      
      // Cek: Apakah item ini punya nilai 'energy'? Kalau ya, munculkan tombol Makan
      let actionBtn = "";
      if (item.energy) {
        actionBtn = `<button class="btn-eat" onclick="event.stopPropagation(); eatItem('${key}')">🍽 Makan</button>`;
      }

      div.innerHTML = `
        <div class="inv-icon">${item.icon}</div>
        <div class="inv-qty">x${qty}</div>
        
        ${actionBtn}

        <div class="inv-tooltip">
          <strong>${item.name}</strong><br>
          ${item.desc || ''}
        </div>
      `;
      container.appendChild(div);
    }
  }

  // Jika tas kosong
  if (!hasItem) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍂</div>
        <div class="empty-title">Tas Kosong</div>
        <div class="empty-desc">Belum ada barang.</div>
      </div>
    `;
  }
}

/* ================================================= */
/* 📖 JOURNAL SYSTEM                                 */
/* ================================================= */

function renderJournal() {
  const container = document.querySelector("#overlay-journal");
  if (!container) return;

  // Kita isi HTML-nya dengan layout rapi
  container.innerHTML = `
    <h2>📖 Jurnal Petualang</h2>
    <p>Catatan perjalananmu selama di Cozy Life.</p>

    <div class="journal-grid">
      <div class="stat-card">
        <div class="stat-icon">🌾</div>
        <div class="stat-info">
          <div class="stat-val">${Game.stats.totalHarvest}</div>
          <div class="stat-label">Kali Panen</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-info">
          <div class="stat-val">${Game.stats.totalGold}</div>
          <div class="stat-label">Gold Didapat</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🐟</div>
        <div class="stat-info">
          <div class="stat-val">${Game.stats.totalFish}</div>
          <div class="stat-label">Ikan Ditangkap</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🛏️</div>
        <div class="stat-info">
          <div class="stat-val">${Game.stats.totalSleep}</div>
          <div class="stat-label">Kali Tidur</div>
        </div>
      </div>
    </div>
    
    <button data-close style="margin-top:30px;">Tutup Buku</button>
  `;

  // Re-bind tombol tutup (karena kita menimpa HTML, tombol lamanya hilang)
  container.querySelector("[data-close]").onclick = closeOverlay;
}

/* ================================================= */
/* 🏪 SHOP SYSTEM (JUAL HASIL & BELI BIBIT)          */
/* ================================================= */

function renderShop() {
  const container = $("#shop-list");
  if (!container) return;
  container.innerHTML = "";

  // --- BAGIAN 1: JUAL HASIL PANEN ---
  const sellTitle = document.createElement("h3");
  sellTitle.className = "shop-section-title";
  sellTitle.innerText = "💰 Jual Hasil Panen";
  container.appendChild(sellTitle);

  let hasSellItem = false;
  for (const [key, qty] of Object.entries(Game.inventory)) {
    const item = ItemDB[key];
    if (item && item.type === 'crop' && qty > 0) {
      hasSellItem = true;
      const div = document.createElement("div");
      div.className = "shop-item";
      div.innerHTML = `
        <div class="shop-info">
          <div class="shop-icon">${item.icon}</div>
          <div>
            <strong>${item.name}</strong>
            <div style="font-size:12px; opacity:0.7;">Tas: ${qty}</div>
          </div>
        </div>
        <button class="btn-sell" onclick="sellItem('${key}', event)">Jual (${item.price} G)</button>
      `;
      container.appendChild(div);
    }
  }
  if (!hasSellItem) {
    const msg = document.createElement("div");
    msg.style.opacity = "0.5";
    msg.style.padding = "10px";
    msg.innerText = "Tidak ada hasil panen.";
    container.appendChild(msg);
  }

  // --- BAGIAN 2: BELI BIBIT (DENGAN LOCK) ---
  const buyTitle = document.createElement("h3");
  buyTitle.className = "shop-section-title";
  buyTitle.innerText = "🌱 Beli Bibit";
  container.appendChild(buyTitle);

  for (const [key, item] of Object.entries(ItemDB)) {
    if (item.type === 'seed') {
      const currentQty = Game.inventory[key] || 0;
      
      // 1. Cek Level (Lock System)
      const reqLevel = item.reqLevel || 1;
      const isLocked = Game.player.level < reqLevel;

      let btnHTML = "";

      if (isLocked) {
        // TAMPILAN TERKUNCI
        btnHTML = `<button class="btn-locked">🔒 Lv. ${reqLevel}</button>`;
      } else {
        // TAMPILAN TERBUKA (Cek Uang)
        const canBuy = Game.resources.gold >= item.price;
        const btnClass = canBuy ? "btn-buy" : "btn-buy disabled";
        btnHTML = `<button class="${btnClass}" onclick="buyItem('${key}')">Beli (${item.price} G)</button>`;
      }
      
      const div = document.createElement("div");
      div.className = "shop-item";
      // Kalau terkunci, itemnya agak transparan dikit
      if(isLocked) div.style.opacity = "0.6"; 
      
      div.innerHTML = `
        <div class="shop-info">
          <div class="shop-icon">${item.icon}</div>
          <div>
            <strong>${item.name}</strong>
            <div style="font-size:12px; opacity:0.7;">Tas: ${currentQty}</div>
          </div>
        </div>
        ${btnHTML}
      `;
      container.appendChild(div);
    }
  }
}

// --- FUNGSI TRANSAKSI ---

// Tambahkan parameter 'e' (event)
function sellItem(key, e) { 
  const item = ItemDB[key];
  if (Game.inventory[key] > 0) {
    Game.inventory[key]--;
    Game.resources.gold += item.price;

    // --- CATAT STATISTIK ---
    Game.stats.totalGold += item.price; // Tambah sesuai harga jual
    // -----------------------

    AudioSys.playSFX('coin');

    // --- EFEK ANGKA TERBANG ---
    // Jika ada data mouse event (e), pakai posisinya. Kalau gak ada, pakai tengah layar.
    if (e) {
      showFloatingText(e.clientX, e.clientY, `+${item.price} G`, "#ffd700"); // Warna Emas
    }
    // --------------------------

    renderShop();
    updateResourcesUI();
    saveGame();
    // showPopup tidak perlu lagi kalau sudah ada angka terbang
  }
}

function buyItem(key) {
  const item = ItemDB[key];
  
  // Cek Uang
  if (Game.resources.gold >= item.price) {
    Game.resources.gold -= item.price; // Kurangi uang
    Game.inventory[key]++;             // Tambah bibit
    
    AudioSys.playSFX('success');
    
    // --- EFEK VISUAL BELI (PARTIKEL) ---
    spawnParticles(window.innerWidth / 2, window.innerHeight / 2, "#4ca1af"); 
    
    renderShop();        // Refresh Toko
    updateResourcesUI(); // Update Angka Gold
    saveGame();
    showPopup(`Membeli ${item.name}`);
  } else {
    AudioSys.playSFX('error'); // Bunyi Error
    showPopup("Gold tidak cukup!");
  }
}

/* --- FUNGSI MAKAN --- */
function eatItem(key) {
  const item = ItemDB[key];
  
  // 1. Cek Apakah Energi Penuh?
  if (Game.resources.energy >= Game.resources.maxEnergy) {
    showPopup("Energi Penuh! ⚡");
    return;
  }

  // 2. Proses Makan
  if (Game.inventory[key] > 0) {
    Game.inventory[key]--; // Kurangi barang
    
    // Tambah Energi
    Game.resources.energy += item.energy;
    
    // Jangan sampai energi melebihi batas (Max 5)
    if (Game.resources.energy > Game.resources.maxEnergy) {
      Game.resources.energy = Game.resources.maxEnergy;
    }
    
    // 3. Update UI & Save
    AudioSys.playSFX('coin'); // Atau nanti ganti suara makan
    renderInventory();        // Refresh tas (biar jumlah berkurang)
    updateResourcesUI();      // Update angka petir
    saveGame();
    
    showPopup(`Nyam! +${item.energy} Energi ⚡`);
  }
}

function showPopup(text) {
  const popup = $("popup");
  popup.innerText = text;
  popup.classList.remove("hidden");
  setTimeout(() => popup.classList.add("hidden"), 2000);
}

/* --- FUNGSI ANGKA TERBANG --- */
function showFloatingText(x, y, text, color = "#fff") {
  const el = document.createElement("div");
  el.className = "floating-text";
  el.innerText = text;
  
  // Set Posisi
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color; // Bisa ganti warna (Misal: Emas buat Gold, Biru buat XP)
  
  document.body.appendChild(el);
  
  // Hapus elemen setelah animasi selesai (1 detik) agar tidak menuhin memori
  setTimeout(() => el.remove(), 1000);
}

/* --- FUNGSI PARTIKEL LEDAKAN --- */
function spawnParticles(x, y, color = "#fff") {
  const particleCount = 12; // Jumlah butiran

  for (let i = 0; i < particleCount; i++) {
    const p = document.createElement("div");
    p.classList.add("particle");
    
    // Set Posisi Awal
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.backgroundColor = color;
    
    // Arah Sebar Acak (Trigonometri sederhana)
    // Jarak sebar antara 50px sampai 100px
    const angle = Math.random() * Math.PI * 2;
    const velocity = 50 + Math.random() * 50; 
    
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    // Masukkan variabel arah ke CSS
    p.style.setProperty('--x', `${tx}px`);
    p.style.setProperty('--y', `${ty}px`);

    document.body.appendChild(p);

    // Hapus setelah animasi selesai
    setTimeout(() => p.remove(), 1000);
  }
}

function openOverlay(id) {
  $$(".overlay").forEach(o => o.classList.remove("active"));
  $(`overlay-${id}`)?.classList.add("active");
  AudioSys.playSFX('menu_open');
  
  if (id === 'shop') renderShop();
  
  if (id === 'inventory') renderInventory();

  // --- TAMBAHKAN INI ---
  if (id === 'journal') renderJournal(); 
  // ---------------------

}

function closeOverlay() {
  $$(".overlay").forEach(o => o.classList.remove("active"));
}

/* ================================================= */
/* 🔌 EVENTS & INIT                                  */
/* ================================================= */

function bindEvents() {
  
  document.body.addEventListener('click', (e) => {
  if (e.target.closest('button')) {
    AudioSys.playSFX('click');
  }
  });
  // Start Game
  $("[data-action='start']").onclick = () => {
    AudioSys.init(); // Init audio konteks
    switchScene("world");
    initGardenVisuals();
    saveGame();
  };

  // Continue
  $("[data-action='continue']").onclick = () => {
    AudioSys.init();
    if (loadGame()) {
      switchScene("world");
      updatePlayerUI();
      initGardenVisuals(); // <--- TAMBAHKAN INI
      // Restore Quest UI jika ada
      if(Game.quest.active === 'water') updateQuestUI("Water the Plants", "Tap Garden");
    } else {
      showPopup("No save data found!");
    }
  };

  // World Interactions (Delegation)
  $$(".world-object").forEach(el => {
    el.onclick = () => {
      // Cek apakah punya data-open atau data-quest
      if (el.dataset.open) handleObjectClick(el.dataset.open);
      else if (el.dataset.quest) handleObjectClick('garden'); // Hardcode dulu utk garden
    };
  });

  // UI Buttons
  $$(".action-dock button").forEach(btn => {
    btn.onclick = () => openOverlay(btn.dataset.open);
  });

  $$("[data-close]").forEach(btn => btn.onclick = closeOverlay);
  
  // Dialog Next Button
  // 1. Klik Tombol Panah Kecil (Tetap ada)
  $("dialog-next").onclick = (e) => {
    e.stopPropagation(); // Mencegah klik ganda
    Dialog.hide();
  };

  // 2. Klik DI MANA SAJA pada Kotak Dialog -> Langsung Tutup
  document.querySelector(".dialog-box").onclick = () => {
    Dialog.hide();
    AudioSys.playSFX('click'); // Opsional: Bunyi klik biar enak
  };

  // 3. Klik Popup Notifikasi (yang di atas) -> Langsung Hilang
  $("popup").onclick = function() {
    this.classList.add("hidden");
  };

  // Minigame
  $("[data-exit]").onclick = () => switchScene("world");

  // UI Buttons (Overlay)
  $$(".action-dock button[data-open]").forEach(btn => {
    btn.onclick = () => openOverlay(btn.dataset.open);
  });

  // --- TAMBAHKAN INI (Tombol Quest Board) ---
  const questBtn = $("[data-action='quest-board']");
  if (questBtn) questBtn.onclick = openQuestBoard;
  // ------------------------------------------

  // --- LOGIKA SETTINGS ---
  
  // 1. Slider Musik (BGM)
  $("#vol-bgm").oninput = (e) => {
    AudioSys.setVolume('bgm', e.target.value);
  };

  // 2. Slider Ambience (Hujan/Alam)
  $("#vol-ambience").oninput = (e) => {
    AudioSys.setVolume('ambience', e.target.value);
  };

  // 3. Slider SFX (Efek Suara)
  $("#vol-sfx").oninput = (e) => {
    // 1. Update nilai volume di sistem
    const val = e.target.value;
    AudioSys.setVolume('sfx', val);
    
    // 2. Mainkan suara tes (Bunyi "Tik")
    // Kita pakai suara 'click' karena durasinya pendek & tidak berisik
    AudioSys.playSFX('click'); 
  };

  // 4. Tombol RESET GAME (Bahaya)
  $("#btn-reset").onclick = () => {
    // Konfirmasi ganda biar gak kepencet
    const yakin = confirm("YAKIN HAPUS DATA? \nProgress, Level, dan Item akan hilang selamanya.");
    if (yakin) {
      clearSave(); // Panggil fungsi reset yg sudah ada
    }
  };
  
  // -----------------------
}

function init() {
  bindEvents();
  updateTime();
  setInterval(updateTime, 60000); // Update jam tiap menit
  updateWeatherByLocation();

  // --- NYALAKAN TIMER KEBUN ---
  startGardenTicker(); 
  // ----------------------------

  // --- LOGIKA BARU: ANIMASI LOADING ---
  const bar = document.querySelector(".loading-fill");
  let progress = 0;

  // Jalankan animasi setiap 30 milidetik
  const loader = setInterval(() => {
    progress += 2; // Nambah 2% tiap putaran
    
    // Update lebar bar di layar
    if (bar) bar.style.width = `${progress}%`;

    // Kalau sudah 100%, setop animasi & pindah scene
    if (progress >= 100) {
      clearInterval(loader);
      
      // Tunggu sebentar biar user lihat barnya penuh, baru pindah
      setTimeout(() => {
        switchScene("start"); 
      }, 500);
    }
  }, 30); // Kecepatan animasi (makin kecil angka, makin ngebut)

  // Cek save data
  if(localStorage.getItem(SAVE_KEY)) {
    // Opsional: Ubah teks tombol jika ada save data
    const btn = document.querySelector("[data-action='start']");
    if(btn) btn.innerText = "New Game";
  }
}

// Start
document.addEventListener("DOMContentLoaded", init);

/* ================================================= */
/* 🌱 NEW GARDEN SYSTEM (MULTI-SLOT)                 */
/* ================================================= */

// Fungsi dipanggil saat salah satu pot diklik
function handleGardenSlot(index) {
  const slotData = Game.garden[index]; // Ambil data slot (0, 1, atau 2)
  const slotEl = document.getElementById(`slot-${index}`); // Ambil elemen HTML-nya

  // --- FASE 1: TANAH KOSONG (State 0) -> MENANAM ---
  if (slotData.state === 0) {
    
    // Cek Energi
    if (Game.resources.energy <= 0) {
      Dialog.show("Low Energy", "Kamu terlalu lelah. Tidur dulu.");
      return;
    }

    // Cek Bibit (Prioritas: Jagung > Wortel)
    let seedUsed = null;
    if (Game.inventory['seed_corn'] > 0) seedUsed = 'seed_corn';
    else if (Game.inventory['seed_carrot'] > 0) seedUsed = 'seed_carrot';

    if (!seedUsed) {
      Dialog.show("Butuh Bibit", "Tidak punya bibit! Beli di Toko.");
      return;
    }

    // PROSES TANAM
    const seedDB = ItemDB[seedUsed];
    
    // Update Data Game
    Game.resources.energy--;
    Game.inventory[seedUsed]--;
    
    slotData.state = 1; // Sedang tumbuh
    slotData.crop = seedDB.output;
    slotData.totalTime = seedDB.growTime;
    slotData.finishTime = Date.now() + seedDB.growTime; // Simpan waktu selesai (timestamp)

    updateResourcesUI();
    saveGame(); // Simpan biar kalau direfresh tetap tumbuh

    // Update Visual
    renderGardenSlot(index);
    AudioSys.playSFX('water');
  }

  // --- FASE 2: SEDANG TUMBUH (State 1) ---
  else if (slotData.state === 1) {
    // Cek apakah waktu tumbuh sudah selesai?
    const now = Date.now();
    if (now >= slotData.finishTime) {
      // Sudah matang! Ubah status jadi siap panen
      slotData.state = 2;
      saveGame();
      renderGardenSlot(index); // Refresh visual
    } else {
      // Belum matang
      const sisaDetik = Math.ceil((slotData.finishTime - now) / 1000);
      showFloatingText(event.clientX, event.clientY, `⏳ ${sisaDetik}s`, "#fff");
    }
  }

  // --- FASE 3: PANEN (State 2) ---
  else if (slotData.state === 2) {
    // Ambil data tanaman
    const cropName = slotData.crop;
    const cropDB = ItemDB[cropName];
    const expReward = cropDB.price * 2;

    // Reset Slot
    slotData.state = 0;
    slotData.crop = null;
    slotData.finishTime = 0;
    slotData.totalTime = 0; // Reset timer total juga

    // Hadiah
    Game.inventory[cropName]++;
    gainExp(expReward);

    // --- CATAT STATISTIK ---
    Game.stats.totalHarvest++; // Nambah 1
    // -----------------------
    
    // Efek Visual
    const rect = slotEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    showFloatingText(centerX, centerY - 20, `+1 ${cropDB.name}`, "#fff");
    setTimeout(() => showFloatingText(centerX, centerY + 20, `+${expReward} XP`, "#d6a2e8"), 200);
    spawnParticles(centerX, centerY, "#86cf8c");

    AudioSys.playSFX('coin');
    
    // Cek Quest (Kalau ada quest siram tanaman)
    if(Game.quest.active === 'water') completeQuest('water');

    updateResourcesUI();
    saveGame();
    renderGardenSlot(index);
  }
}

// --- FUNGSI LOOP TIMER KEBUN (REAL-TIME) ---
function startGardenTicker() {
  // Jalankan setiap 100 milidetik (biar bar terlihat halus)
  setInterval(() => {
    
    // Cek semua slot (0, 1, 2)
    Game.garden.forEach((slot, index) => {
      
      // Hanya proses jika statusnya SEDANG TUMBUH (State 1)
      if (slot.state === 1) {
        const now = Date.now();
        const timeLeft = slot.finishTime - now;

        // Ambil elemen HTML
        const slotEl = document.getElementById(`slot-${index}`);
        if (!slotEl) return;

        // A. Jika Waktu Habis -> MATANGKAN TANAMAN
        if (timeLeft <= 0) {
          slot.state = 2; // Ubah jadi Siap Panen
          renderGardenSlot(index); // Render ulang jadi ikon sayur
          saveGame(); // Simpan otomatis
        } 
        
        // B. Jika Belum Habis -> UPDATE VISUAL (Timer & Bar)
        else {
          // 1. Update Teks Timer (misal: "05s")
          let timerEl = slotEl.querySelector(".slot-timer");
          if (!timerEl) {
             // Kalau belum ada, buat elemennya
             timerEl = document.createElement("div");
             timerEl.className = "slot-timer";
             slotEl.appendChild(timerEl);
          }
          // Ubah milidetik ke detik (pembulatan ke atas)
          const seconds = Math.ceil(timeLeft / 1000);
          timerEl.innerText = `${seconds}s`;

          // 2. Update Lebar Bar (Persentase)
          let barEl = slotEl.querySelector(".slot-loader");
          if (!barEl) {
             barEl = document.createElement("div");
             barEl.className = "slot-loader";
             slotEl.appendChild(barEl);
          }
          
          // Rumus: (Waktu Total - Sisa Waktu) / Waktu Total * 100
          // Contoh: (10dtk - 3dtk) / 10dtk = 0.7 (70%)
          // Tapi kita mau barnya mengecil atau membesar? 
          // Mari kita buat MEMBESAR (0% -> 100%)
          const timePassed = slot.totalTime - timeLeft;
          const percent = (timePassed / slot.totalTime) * 100;
          
          barEl.style.width = `${percent}%`;
        }
      }
    });

  }, 100); // Update setiap 0.1 detik
}

// Fungsi Pembantu: Menggambar ulang tampilan pot berdasarkan data
function renderGardenSlot(index) {
  const slotData = Game.garden[index];
  const slotEl = document.getElementById(`slot-${index}`);
  if (!slotEl) return;

  // Hapus class ready biar gak kedip-kedip kalau belum waktunya
  slotEl.classList.remove("ready");

  // Jika Kosong
  if (slotData.state === 0) {
    slotEl.innerText = "🌱"; 
    slotEl.innerHTML = "🌱"; // Reset isi (hapus timer/bar sisa)
  } 
  
  // Jika Sedang Tumbuh
  else if (slotData.state === 1) {
    // Kita cukup set ikon dasarnya saja.
    // Timer & Bar akan otomatis dibuat/diupdate oleh startGardenTicker()
    // Jadi kita tidak perlu bikin div-nya di sini.
    if (!slotEl.querySelector(".slot-loader")) {
       slotEl.innerText = "🌿"; 
    }
  } 
  
  // Jika Siap Panen
  else if (slotData.state === 2) {
    const cropDB = ItemDB[slotData.crop];
    slotEl.innerHTML = cropDB.icon; // Tampilkan Wortel/Jagung
    slotEl.classList.add("ready");  // Efek bersinar
  }
}

// UPDATE INIT: Agar saat game dibuka, tanaman yg disimpan muncul lagi
// Tambahkan baris ini di dalam fungsi init() atau setelah loadGame()
function initGardenVisuals() {
  // Render ulang ketiga slot
  renderGardenSlot(0);
  renderGardenSlot(1);
  renderGardenSlot(2);
}

// Helper untuk update UI Resource (Energy & Gold)
function updateResourcesUI() {
  $("#gold").innerText = `💰 ${Game.resources.gold}`;
  $("#energy").innerText = `⚡ ${Game.resources.energy}/${Game.resources.maxEnergy}`;
}

/* ================================================= */
/* 🛌 SLEEP LOGIC                                    */
/* ================================================= */

function startSleep() {
  // 1. Tutup menu dulu
  closeOverlay();
  
  // 2. Mainkan efek layar hitam
  const curtain = $("#curtain");
  curtain.classList.add("active"); // Layar jadi gelap
  
  // Opsional: Bunyi sfx tidur (nanti bisa ditambah)
  // AudioSys.playSFX('sleep');

  // 3. Proses Tidur (Tunggu 2 detik dalam gelap)
  setTimeout(() => {
    
    // ISI ULANG ENERGI
    Game.resources.energy = Game.resources.maxEnergy;
    updateResourcesUI();
    
    // Simpan Game
    saveGame();

    // 4. Bangun (Buka layar hitam)
    curtain.classList.remove("active");
    
    // Munculkan dialog setelah bangun
    setTimeout(() => {
      Dialog.show("Good Morning!", "Tidur yang nyenyak! Energimu sudah pulih sepenuhnya ⚡");
      AudioSys.playSFX('success'); // Bunyi "Tring!"
    }, 1500); // Tunggu layar terang dulu baru dialog muncul

  }, 2500); // Durasi tidur (2.5 detik)
  
  // --- CATAT STATISTIK ---
  Game.stats.totalSleep++;
  // -----------------------

}

