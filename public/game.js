// Длительность условной "задачи" — 30 секунд
const TASK_DURATION_MS = 30000;

// Настройки игры
const STAR_SPAWN_INTERVAL_MS = 600; // минимальный интервал спавна (в конце разгона)
const STAR_SPAWN_INTERVAL_INITIAL_MS = STAR_SPAWN_INTERVAL_MS * 5; // в начале звёзд в 5 раз меньше
const STAR_SPAWN_INTERVAL_STEP_MS = 100; // на сколько уменьшается интервал после каждого спавна
const STAR_FALL_SPEED = 2.2; // пикселей за кадр
const BASKET_SPEED = 6; // пикселей за кадр
const INITIAL_LIVES = 3;

const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const gameField = document.getElementById('game-field');
const basketEl = document.getElementById('basket');
const livesEl = document.getElementById('lives');
const resultEl = document.getElementById('result');
const resultStatusEl = document.getElementById('result-status');
const resultScoreEl = document.getElementById('result-score');
const loseModalEl = document.getElementById('lose-modal');
const restartRoundBtn = document.getElementById('restart-round-btn');

const fieldWidth = gameField.clientWidth;
const fieldHeight = gameField.clientHeight;
const basketWidth = basketEl.offsetWidth;

let basketX = fieldWidth / 2 - basketWidth / 2;
const pressedKeys = new Set();

let stars = [];
let score = 0;
let lives = INITIAL_LIVES;
let taskRunning = false;
let spawnIntervalId = null;
let animationFrameId = null;
let taskTimeoutId = null;
let currentSpawnInterval = STAR_SPAWN_INTERVAL_INITIAL_MS;

// Отслеживаем нажатые стрелки
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    pressedKeys.add(e.key);
  }
});

document.addEventListener('keyup', (e) => {
  pressedKeys.delete(e.key);
});

function updateLivesDisplay() {
  livesEl.textContent = `Жизни: ${lives}`;
}

function spawnStar() {
  const el = document.createElement('div');
  el.className = 'star';
  el.textContent = '⭐';

  const x = Math.random() * (fieldWidth - 24);
  el.style.left = `${x}px`;
  el.style.top = '-24px';

  gameField.appendChild(el);
  stars.push({ el, x, y: -24 });
}

function updateBasket() {
  if (pressedKeys.has('ArrowLeft')) {
    basketX -= BASKET_SPEED;
  }
  if (pressedKeys.has('ArrowRight')) {
    basketX += BASKET_SPEED;
  }

  basketX = Math.max(0, Math.min(fieldWidth - basketWidth, basketX));
  basketEl.style.left = `${basketX}px`;
}

function updateStars() {
  const basketTop = fieldHeight - 8 - 24;
  let missedCount = 0;

  stars = stars.filter((star) => {
    star.y += STAR_FALL_SPEED;
    star.el.style.top = `${star.y}px`;

    // Проверка поимки корзиной
    const caught =
      star.y + 24 >= basketTop &&
      star.y <= basketTop + 24 &&
      star.x + 24 >= basketX &&
      star.x <= basketX + basketWidth;

    if (caught) {
      score += 1;
      star.el.remove();
      return false;
    }

    // Звезда упала мимо корзины — минус жизнь
    if (star.y > fieldHeight) {
      star.el.remove();
      missedCount += 1;
      return false;
    }

    return true;
  });

  if (missedCount > 0) {
    lives = Math.max(0, lives - missedCount);
    updateLivesDisplay();

    if (lives === 0) {
      stopGame();
      loseModalEl.hidden = false;
    }
  }
}

function gameLoop() {
  updateBasket();
  updateStars();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Интервал спавна постепенно уменьшается с каждой звездой (не зависит от длительности задачи)
// от STAR_SPAWN_INTERVAL_INITIAL_MS до минимума STAR_SPAWN_INTERVAL_MS
function scheduleNextStar() {
  spawnStar();

  currentSpawnInterval = Math.max(
    STAR_SPAWN_INTERVAL_MS,
    currentSpawnInterval - STAR_SPAWN_INTERVAL_STEP_MS
  );

  spawnIntervalId = setTimeout(scheduleNextStar, currentSpawnInterval);
}

// Сброс состояния раунда — используется и при первом запуске, и при перезапуске из-за потери жизней
function resetRoundState() {
  score = 0;
  lives = INITIAL_LIVES;
  updateLivesDisplay();

  stars.forEach((star) => star.el.remove());
  stars = [];
  currentSpawnInterval = STAR_SPAWN_INTERVAL_INITIAL_MS;
}

function startGame() {
  resetRoundState();
  basketX = fieldWidth / 2 - basketWidth / 2;

  scheduleNextStar();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGame() {
  clearTimeout(spawnIntervalId);
  cancelAnimationFrame(animationFrameId);
  stars.forEach((star) => star.el.remove());
  stars = [];
}

function finishTask() {
  taskRunning = false;
  stopGame();
  loseModalEl.hidden = true;

  resultEl.hidden = false;
  resultStatusEl.textContent = 'Задача выполнена ✅';
  resultScoreEl.textContent = `Поймано звёзд: ${score}`;

  statusEl.textContent = 'Задача завершена';
  startBtn.disabled = false;
}

restartRoundBtn.addEventListener('click', () => {
  loseModalEl.hidden = true;
  resetRoundState();
  scheduleNextStar();
  animationFrameId = requestAnimationFrame(gameLoop);
});

startBtn.addEventListener('click', () => {
  if (taskRunning) return;

  taskRunning = true;
  startBtn.disabled = true;
  statusEl.textContent = 'Задача выполняется…';
  resultEl.hidden = true;

  startGame();
  taskTimeoutId = setTimeout(finishTask, TASK_DURATION_MS);
});
