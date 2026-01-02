/* ================================================= */
/* GAME CORE STATE                                   */
/* ================================================= */

const SAVE_KEY = "cozy_life_save";

const Game = {
  scene: "loading",

  time: {
    hour: 0,
    minute: 0,
    timezone: "",
  },

  weather: "Sunny",

  resources: {
    gold: 0,
    energy: 5,
    maxEnergy: 5,
  },

  player: {
    level: 1,
    exp: 0,
    expToNext: 30,
    title: "Wanderer",
  },

  quest: {
    active: null,
    completed: {},
  },

  world: {
    gardenUnlocked: false,
  },

  minigame: {
    score: 0,
    timer: 0,
    active: false,
  },
};


/* ================================================= */
/* DOM HELPERS                                       */
/* ================================================= */

const $ = (id) => document.getElementById(id);
const $$ = (q) => document.querySelectorAll(q);


/* ================================================= */
/* SAVE SYSTEM                                       */
/* ================================================= */

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    player: Game.player,
    resources: Game.resources,
    quest: Game.quest,
    world: Game.world,
    lastPlayed: Date.now(),
  }));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    Object.assign(Game.player, data.player);
    Object.assign(Game.resources, data.resources);
    Object.assign(Game.quest, data.quest);
    Object.assign(Game.world, data.world || {});

    if (Game.world.gardenUnlocked) {
      document.querySelector(".garden")?.classList.remove("locked");
    }
    
    updateGardenVisual();

    return true;
  } catch {
    return false;
  }
}

function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}


/* ================================================= */
/* SCENE SYSTEM                                      */
/* ================================================= */

function switchScene(target) {
  $$(".scene").forEach(scene => scene.classList.remove("active"));
  $(`scene-${target}`)?.classList.add("active");
  Game.scene = target;
  if (target === "world") {
  updateGardenVisual();
}
}


/* ================================================= */
/* REAL TIME SYSTEM                                  */
/* ================================================= */

function updateRealTime() {
  const now = new Date();

  Game.time.hour = now.getHours();
  Game.time.minute = now.getMinutes();

  $("time").innerText =
    `${String(Game.time.hour).padStart(2, "0")}:${String(Game.time.minute).padStart(2, "0")}`;

  $("date").innerText = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const offset = -now.getTimezoneOffset() / 60;
  const sign = offset >= 0 ? "+" : "";
  Game.time.timezone = `GMT${sign}${offset}`;
  $("time").dataset.tz = Game.time.timezone;

  document.body.classList.toggle(
    "night",
    Game.time.hour >= 18 || Game.time.hour < 5
  );
}


/* ================================================= */
/* WEATHER SYSTEM                                    */
/* ================================================= */

function updateWeather() {
  const isNight = document.body.classList.contains("night");
  const rainSound = $("rain-sound");

  Game.weather = isNight ? "Rain" : "Sunny";
  $("weather").innerText = Game.weather === "Rain" ? "🌧 Rain" : "☀ Sunny";

  if (rainSound) {
    if (Game.weather === "Rain") {
      rainSound.volume = 0.3;
      rainSound.play().catch(() => {});
    } else {
      rainSound.pause();
      rainSound.currentTime = 0;
    }
  }
}


/* ================================================= */
/* PLAYER PROGRESSION                                */
/* ================================================= */

function gainExp(amount) {
  Game.player.exp += amount;

  while (Game.player.exp >= Game.player.expToNext) {
    Game.player.exp -= Game.player.expToNext;
    levelUp();
  }

  updatePlayerUI();
  saveGame();
}

function levelUp() {
  Game.player.level++;
  Game.player.expToNext = 20 + Game.player.level * 10;
  showPopup(`Level Up! 🎉 Lv.${Game.player.level}`);
  updateGardenVisual();
}

function updatePlayerUI() {
  $("player-level").innerText = Game.player.level;
  $("player-title").innerText = Game.player.title;

  const percent =
    (Game.player.exp / Game.player.expToNext) * 100;

  document.querySelector(".exp-fill").style.width = `${percent}%`;
}

function updateGardenVisual() {
  const garden = document.querySelector(".garden");
  if (!garden) return;

  garden.classList.remove("dry", "sprout", "growing", "alive");

  if (Game.player.level >= 4) {
    garden.classList.add("alive");
    garden.innerText = "🌸";
  } else if (Game.player.level >= 3) {
    garden.classList.add("growing");
    garden.innerText = "🌾";
  } else if (Game.player.level >= 2) {
    garden.classList.add("sprout");
    garden.innerText = "🌿";
  } else {
    garden.classList.add("dry");
    garden.innerText = "🌱";
  }
}


/* ================================================= */
/* HUD UPDATE                                        */
/* ================================================= */

function updateHUD() {
  $("gold").innerText = `💰 ${Game.resources.gold}`;
  $("energy").innerText =
    `⚡ ${Game.resources.energy}/${Game.resources.maxEnergy}`;

  $("active-quest").innerText =
    Game.quest.active ? Game.quest.active : "No Active Quest";

  updatePlayerUI();
}


/* ================================================= */
/* QUEST SYSTEM                                      */
/* ================================================= */

const QuestChain = {
  water: {
    minLevel: 1,
    next: "sprout",
  },
  sprout: {
    minLevel: 2,
    next: "bloom",
  },
  bloom: {
    minLevel: 3,
    next: null,
  },
};

function startQuest(id) {
  const rule = QuestChain[id];
  if (rule && Game.player.level < rule.minLevel) {
  showPopup("Garden belum siap 🌱");
  return;
  }

  if (Game.quest.completed[id]) return;

  Game.quest.active = id;

const questEl = document.querySelector(`[data-quest="${id}"]`);
if (questEl) {
  $("quest-exp").innerText = questEl.dataset.exp || 0;
  $("quest-impact").innerText = questEl.dataset.impact || "";
}

if (id === "water") {
  $("quest-impact").innerText =
    "Klik kebun (🌱) di world untuk menyiram tanah.";
}


  updateHUD();
  saveGame();
}

function completeQuest(id) {
  if (Game.quest.completed[id]) return;

  Game.quest.completed[id] = true;
  Game.quest.active = null;

  const questEl = document.querySelector(`[data-quest="${id}"]`);
  const expGain = questEl ? Number(questEl.dataset.exp) : 10;

  Game.resources.gold += 10;
  gainExp(expGain);

  showPopup(`Quest Complete! +${expGain} EXP`);

  if (id === "water") {
    Game.world.gardenUnlocked = true;
    document.querySelector(".garden")?.classList.remove("locked");
  }

  updateHUD();
  saveGame();
  
  const nextQuest = QuestChain[id]?.next;
  if (nextQuest) {
  showPopup("New garden task available 🌱");
  }

}


/* ================================================= */
/* MINI GAME SYSTEM                                  */
/* ================================================= */

function startMiniGame() {
  Game.minigame.score = 0;
  Game.minigame.timer = 10;
  Game.minigame.active = true;

  $("score").innerText = 0;
  switchScene("minigame");

  const area = document.querySelector(".minigame-area");

  area.onclick = () => {
    if (!Game.minigame.active) return;
    Game.minigame.score++;
    $("score").innerText = Game.minigame.score;
  };

  const interval = setInterval(() => {
    Game.minigame.timer--;

    if (Game.minigame.timer <= 0) {
      clearInterval(interval);
      endMiniGame();
    }
  }, 1000);
}

function endMiniGame() {
  Game.minigame.active = false;

  const expGained = Math.min(Game.minigame.score * 2, 30);
  gainExp(expGained);

  showPopup(`Mini Game Complete! +${expGained} EXP`);
  switchScene("world");
}


/* ================================================= */
/* POPUP FEEDBACK                                    */
/* ================================================= */

function showPopup(text) {
  const popup = $("popup");
  popup.innerText = text;
  popup.classList.remove("hidden");
  setTimeout(() => popup.classList.add("hidden"), 2000);
}


/* ================================================= */
/* OVERLAY SYSTEM                                    */
/* ================================================= */

function openOverlay(id) {
  $$(".overlay").forEach(o => o.classList.remove("active"));
  $(`overlay-${id}`)?.classList.add("active");
}

function closeOverlay() {
  $$(".overlay").forEach(o => o.classList.remove("active"));
}


/* ================================================= */
/* EVENT BINDINGS                                    */
/* ================================================= */

function bindUIEvents() {

  $$("[data-action='start']").forEach(btn => {
    btn.onclick = () => {
      clearSave();
      switchScene("world");
      updateHUD();
      saveGame();
    };
  });

  $$("[data-action='continue']").forEach(btn => {
    btn.onclick = () => {
      if (loadGame()) {
        switchScene("world");
        updateHUD();
      }
    };
  });

  $$("[data-open]").forEach(el => {
    el.onclick = () => {
      const target = el.dataset.open;
      if (target === "minigame") {
        startMiniGame();
      } else {
        openOverlay(target);
      }
    };
  });

$$("[data-quest]").forEach(el => {
  el.onclick = () => {
    const questId = el.dataset.quest;

    if (questId === "water") {
      if (Game.quest.active !== "water") {
        startQuest("water");
      } else {
        completeQuest("water");
      }
    } else {
      startQuest(questId);
    }
  };
});


  $$("[data-close]").forEach(btn => btn.onclick = closeOverlay);
  $$("[data-exit]").forEach(btn => btn.onclick = () => switchScene("world"));
}


/* ================================================= */
/* GAME INIT                                         */
/* ================================================= */

function initGame() {
  bindUIEvents();
  updateRealTime();
  updateWeather();

  setInterval(() => {
    updateRealTime();
    updateWeather();
  }, 60000);

  setTimeout(() => switchScene("start"), 1500);
}

document.addEventListener("DOMContentLoaded", initGame);
