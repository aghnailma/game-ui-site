/* ================================================= */
/* GAME CORE STATE                                   */
/* ================================================= */

const Game = {
  scene: "loading", // loading | start | world | minigame
  time: {
    hour: 0,
    minute: 0,
  },
  weather: "Sunny",
  resources: {
    gold: 0,
    energy: 5,
    maxEnergy: 5,
  },
  quest: {
    active: null,
    completed: {},
  },
};


/* ================================================= */
/* DOM HELPERS                                       */
/* ================================================= */

const $ = (id) => document.getElementById(id);
const $$ = (q) => document.querySelectorAll(q);


/* ================================================= */
/* SCENE SYSTEM                                      */
/* ================================================= */

function switchScene(target) {
  $$(".scene").forEach(scene => scene.classList.remove("active"));

  const sceneEl = $(`scene-${target}`);
  if (sceneEl) {
    sceneEl.classList.add("active");
    Game.scene = target;
  }
}


/* ================================================= */
/* REAL TIME SYSTEM (SYNC WITH COMPUTER CLOCK)       */
/* ================================================= */

function updateRealTime() {
  const now = new Date();

  Game.time.hour = now.getHours();
  Game.time.minute = now.getMinutes();

  // Update HUD Time
  $("time").innerText =
    `${String(Game.time.hour).padStart(2, "0")}:${String(Game.time.minute).padStart(2, "0")}`;

  // Update HUD Date (REAL DATE)
  $("date").innerText = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
  });

  // Day / Evening / Night
  document.body.classList.remove("night", "evening");

  if (Game.time.hour >= 18 || Game.time.hour < 5) {
    document.body.classList.add("night");
  } else if (Game.time.hour >= 16) {
    document.body.classList.add("evening");
  }
}


/* ================================================= */
/* WEATHER SYSTEM                                    */
/* ================================================= */

function updateWeather() {
  const isNight = document.body.classList.contains("night");
  const rainSound = $("rain-sound");

  // Simple rule: rain only at night
  Game.weather = isNight ? "Rain" : "Sunny";

  $("weather").innerText =
    Game.weather === "Rain" ? "🌧 Rain" : "☀ Sunny";

  document.body.classList.toggle("rain", Game.weather === "Rain");

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
/* HUD UPDATE                                        */
/* ================================================= */

function updateHUD() {
  $("gold").innerText = `💰 ${Game.resources.gold}`;
  $("energy").innerText = `⚡ ${Game.resources.energy}/${Game.resources.maxEnergy}`;

  $("active-quest").innerText =
    Game.quest.active ? Game.quest.active : "No Active Quest";
}


/* ================================================= */
/* QUEST SYSTEM                                      */
/* ================================================= */

function startQuest(id) {
  if (Game.quest.completed[id]) return;

  Game.quest.active = id;
  updateHUD();
}

function completeQuest(id) {
  Game.quest.completed[id] = true;
  Game.quest.active = null;

  Game.resources.gold += 10;
  updateHUD();

  showPopup("Quest Complete! 🌱");

  // Unlock garden example
  if (id === "water") {
    document.querySelector(".garden")?.classList.remove("locked");
  }
}


/* ================================================= */
/* POPUP FEEDBACK                                    */
/* ================================================= */

function showPopup(text) {
  const popup = $("popup");
  popup.innerText = text;
  popup.classList.remove("hidden");

  setTimeout(() => {
    popup.classList.add("hidden");
  }, 2000);
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

  /* START MENU */
  $$("[data-action='start']").forEach(btn => {
    btn.onclick = () => {
      switchScene("world");
      updateHUD();
    };
  });

  /* WORLD OBJECT OPEN */
  $$("[data-open]").forEach(el => {
    el.onclick = () => {
      const target = el.dataset.open;
      if (target === "minigame") {
        switchScene("minigame");
      } else {
        openOverlay(target);
      }
    };
  });

  /* QUEST BOARD */
  $$("[data-quest]").forEach(el => {
    el.onclick = () => {
      startQuest(el.dataset.quest);
    };
  });

  /* CLOSE OVERLAY */
  $$("[data-close]").forEach(btn => {
    btn.onclick = closeOverlay;
  });

  /* EXIT MINIGAME */
  $$("[data-exit]").forEach(btn => {
    btn.onclick = () => switchScene("world");
  });
}


/* ================================================= */
/* AUDIO CLICK FEEDBACK                               */
/* ================================================= */

function enableClickSound() {
  const clickSound = $("click-sound");
  if (!clickSound) return;

  $$("button, .world-object").forEach(el => {
    el.addEventListener("click", () => {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    });
  });
}


/* ================================================= */
/* GAME INIT                                         */
/* ================================================= */

function initGame() {
  bindUIEvents();
  enableClickSound();

  updateRealTime();
  updateWeather();
  updateHUD();

  setInterval(() => {
    updateRealTime();
    updateWeather();
  }, 60000);

  // Simulate loading
  setTimeout(() => {
    switchScene("start");
  }, 1500);
}


/* ================================================= */
/* START GAME                                        */
/* ================================================= */

document.addEventListener("DOMContentLoaded", initGame);
