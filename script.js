/* ================================================= */
/* 🛠️ CORE UTILITIES                                 */
/* ================================================= */

// Ganti Baris 5 dengan ini:
const $ = (selector) => document.querySelector(selector) || document.getElementById(selector);
const $$ = (q) => document.querySelectorAll(q);

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

  inventory: {
    'carrot': 0,  // Jumlah wortel
    'fish': 0     // Jumlah ikan
  },

  quest: {
    active: null, // ID quest yang sedang berjalan
    step: 0,      // Progress quest
    completed: {}, // History quest selesai
  },

  // State untuk Audio agar tidak play double
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
  
  container.innerHTML = ""; // Bersihkan isi lama

  // Daftar Barang (Database Item)
  const itemDB = {
    'carrot': { icon: '🥕', name: 'Wortel Segar', desc: 'Hasil panen kebun sendiri.' },
    'fish':   { icon: '🐟', name: 'Ikan Mas',    desc: 'Hasil memancing di kolam.' }
  };

  // Loop semua barang di tas
  for (const [key, qty] of Object.entries(Game.inventory)) {
    if (qty > 0) {
      const item = itemDB[key];
      
      // Buat elemen HTML kotak item
      const div = document.createElement("div");
      div.className = "inv-item glass";
      div.innerHTML = `
        <div class="inv-icon">${item.icon}</div>
        <div class="inv-qty">x${qty}</div>
        <div class="inv-tooltip">
          <strong>${item.name}</strong><br>${item.desc}
        </div>
      `;
      container.appendChild(div);
    }
  }

// Jika tas kosong (GANTI BAGIAN INI)
  if (container.innerHTML === "") {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍂</div>
        <div class="empty-title">Tas Kosong</div>
        <div class="empty-desc">
          Belum ada barang.<br>
          Coba siram tanaman atau memancing!
        </div>
      </div>
    `;
  }
}

function renderShop() {
  const container = $("#shop-list");
  if (!container) return;
  
  container.innerHTML = "";

  // Database Harga Jual
  const prices = {
    'carrot': 15, // 1 Wortel = 15 Gold
    'fish': 25    // 1 Ikan = 25 Gold
  };
  
  const itemDB = {
    'carrot': { icon: '🥕', name: 'Wortel' },
    'fish':   { icon: '🐟', name: 'Ikan' }
  };

  let hasItem = false;

  // Loop item di tas
  for (const [key, qty] of Object.entries(Game.inventory)) {
    // Hanya munculkan di toko jika punya barangnya (Qty > 0)
    if (qty > 0 && prices[key]) {
      hasItem = true;
      const item = itemDB[key];
      const price = prices[key];

      const div = document.createElement("div");
      div.className = "shop-item";
      div.innerHTML = `
        <div class="shop-info">
          <div class="shop-icon">${item.icon}</div>
          <div>
            <strong>${item.name}</strong>
            <div style="font-size:14px; opacity:0.7;">Punya: ${qty}</div>
          </div>
        </div>
        
        <button class="btn-sell" onclick="sellItem('${key}', ${price})">
          Jual (${price} G)
        </button>
      `;
      container.appendChild(div);
    }
  }

  // Kalau tidak ada barang untuk dijual
  if (!hasItem) {
    container.innerHTML = `
      <div style="text-align:center; opacity:0.6; padding:20px;">
        <div style="font-size:40px; margin-bottom:10px;">🤷‍♂️</div>
        Tidak ada barang untuk dijual.<br>Ayo panen dulu!
      </div>
    `;
  }
}

function sellItem(key, price) {
  if (Game.inventory[key] > 0) {
    // 1. Kurangi Barang
    Game.inventory[key]--;
    
    // 2. Tambah Gold
    Game.resources.gold += price;
    
    // 3. Update UI & Save
    renderShop();       // Refresh tampilan toko (biar jumlah berkurang)
    updateResourcesUI(); // Update angka Gold di pojok
    saveGame();
    
    // 4. Efek Suara & Notif
    AudioSys.playSFX('coin'); // Pastikan ada sfx coin
    showPopup(`Terjual! +${price} Gold 💰`);
  }
}

function showPopup(text) {
  const popup = $("popup");
  popup.innerText = text;
  popup.classList.remove("hidden");
  setTimeout(() => popup.classList.add("hidden"), 2000);
}

function openOverlay(id) {
  $$(".overlay").forEach(o => o.classList.remove("active"));
  $(`overlay-${id}`)?.classList.add("active");
  AudioSys.playSFX('menu_open');
  
  if (id === 'shop') renderShop();
  
  if (id === 'inventory') renderInventory();

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
    saveGame();
  };

  // Continue
  $("[data-action='continue']").onclick = () => {
    AudioSys.init();
    if (loadGame()) {
      switchScene("world");
      updatePlayerUI();
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
/* 🌱 GARDEN SYSTEM LOGIC (REVISI GABUNGAN)          */
/* ================================================= */

// Status Kebun: 0=Kering, 1=Tumbuh, 2=Siap Panen
let gardenState = 0; 

function handleGardenInteract() {
  const garden = document.querySelector(".garden");

// --- FASE 1: MENYIRAM (Jika masih bibit/kering) ---
  if (gardenState === 0) {
    
    // Cek Energi dulu
    if (Game.resources.energy > 0) {
      
      // 1. Kurangi Energi
      Game.resources.energy--;
      updateResourcesUI();
      
      // 2. Ubah Status
      gardenState = 1;
      
      // --- UBAH BAGIAN INI (TAMPILKAN BAR) ---
      // Kita masukkan ikon DAN bar loading ke dalam elemen Garden
      garden.innerHTML = `
        🌿
        <div class="growth-container">
          <div class="growth-fill"></div>
        </div>
      `;
      // ---------------------------------------

      AudioSys.playSFX('water');

      // 3. Trigger Animasi Bar (Kasih delay 50ms biar browser render dulu)
      setTimeout(() => {
        const fill = garden.querySelector(".growth-fill");
        if(fill) fill.style.width = "100%"; // Animasi jalan ke 100%
      }, 50);

      // 4. CEK QUEST (Tetap sama)
      if (Game.quest.active === 'water') {
        completeQuest('water'); 
        Dialog.show("Quest Complete", "Kerja bagus! Tanaman mulai tumbuh.");
      } else {
        Dialog.show("Garden", "Tanaman disiram! Sedang berfotosintesis...");
      }

      // 5. Timer Tumbuh (5 Detik)
      setTimeout(() => {
        gardenState = 2;
        
        // Hapus bar loading, ganti jadi Wortel
        garden.innerHTML = "🥕"; 
        
        garden.classList.add("ready"); 
        AudioSys.playSFX('success');
        
        if(Game.scene === 'world') showPopup("Tanaman siap panen! 🥕");
      }, 5000); 

    } else {
      Dialog.show("Low Energy", "Kamu terlalu lelah. Tidur dulu di rumah.");
    }
  }
  
  // --- FASE 2: SEDANG TUMBUH ---
  else if (gardenState === 1) {
    Dialog.show("Garden", "Sabar... Tanaman sedang berfotosintesis.");
  }

  // --- FASE 3: PANEN (Harvest) ---
  else if (gardenState === 2) {
    // Reset ke awal
    gardenState = 0;
    garden.innerText = "🌱"; 
    garden.classList.remove("ready");
    
    // Kasih Hadiah
    const goldReward = 15;
    const expReward = 50;
    
    // Update Data
    Game.resources.gold += goldReward;
    Game.inventory['carrot']++; // Tambah wortel
    gainExp(expReward);
    
    // Update UI
    updateResourcesUI(); 
    
    // Tampilkan Pesan
    Dialog.show("Harvest", `Panen berhasil! Dapat 1x 🥕 Wortel, ${goldReward} Gold & ${expReward} XP.`);
    AudioSys.playSFX('coin');
  } 
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
}