// Длительность условной "задачи" — 30 секунд
const TASK_DURATION_MS = 30000;

// Настройки игры
const STAR_SPAWN_INTERVAL_MS = 600; // минимальный интервал спавна (в конце разгона)
const STAR_SPAWN_INTERVAL_INITIAL_MS = STAR_SPAWN_INTERVAL_MS * 5; // в начале звёзд в 5 раз меньше
const STAR_SPAWN_INTERVAL_STEP_MS = 100; // на сколько уменьшается интервал после каждого спавна
const STAR_FALL_SPEED = 2.2; // пикселей за кадр
const BASKET_SPEED = 6; // пикселей за кадр
const INITIAL_LIVES = 3;

const STAR_SVG =
  '<svg viewBox="0 0 24 24" fill="#facc15" aria-hidden="true"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 7.1-1.01L12 2z"/></svg>';

const HEART_ICON_PATH =
  'M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z';

const startBtn = document.getElementById('start-btn');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const gameField = document.getElementById('game-field');
const basketEl = document.getElementById('basket');
const livesEl = document.getElementById('lives');
const loseModalEl = document.getElementById('lose-modal');
const loseScoreEl = document.getElementById('lose-score');
const restartRoundBtn = document.getElementById('restart-round-btn');
const completeModalEl = document.getElementById('complete-modal');
const completeScoreEl = document.getElementById('complete-score');
const completeOkBtn = document.getElementById('complete-ok-btn');

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
let taskTimerIntervalId = null;
let taskStartTime = 0;
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

updateLivesDisplay();

function updateLivesDisplay() {
  const hearts = Array.from({ length: INITIAL_LIVES }, (_, i) => {
    const filledClass = i < lives ? 'heart-icon--filled' : 'heart-icon--empty';
    return `<svg class="heart-icon ${filledClass}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${HEART_ICON_PATH}"/></svg>`;
  }).join('');

  livesEl.innerHTML = `<span class="sr-only">Жизни: ${lives} из ${INITIAL_LIVES}</span>${hearts}`;
}

function updateTaskTimer() {
  const elapsedSec = Math.min(
    Math.floor((Date.now() - taskStartTime) / 1000),
    TASK_DURATION_MS / 1000
  );
  timerEl.textContent = `${elapsedSec} / ${TASK_DURATION_MS / 1000} сек`;
}

function spawnStar() {
  const el = document.createElement('div');
  el.className = 'star';
  el.innerHTML = STAR_SVG;

  const x = Math.random() * (fieldWidth - 24);
  el.style.left = `${x}px`;
  el.style.transform = 'translateY(-24px)';

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
    star.el.style.transform = `translateY(${star.y}px)`;

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
      loseScoreEl.textContent = `Поймано звёзд: ${score}`;
      loseModalEl.hidden = false;
      restartRoundBtn.focus();
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
  clearInterval(taskTimerIntervalId);
  loseModalEl.hidden = true;

  statusEl.textContent = 'Задача завершена';
  timerEl.textContent = '';
  startBtn.disabled = false;

  completeScoreEl.textContent = `Поймано звёзд: ${score}`;
  completeModalEl.hidden = false;
  completeOkBtn.focus();
}

restartRoundBtn.addEventListener('click', () => {
  loseModalEl.hidden = true;
  resetRoundState();
  scheduleNextStar();
  animationFrameId = requestAnimationFrame(gameLoop);
});

completeOkBtn.addEventListener('click', () => {
  completeModalEl.hidden = true;
});

startBtn.addEventListener('click', () => {
  if (taskRunning) return;

  taskRunning = true;
  startBtn.disabled = true;
  statusEl.textContent = 'Задача выполняется…';
  completeModalEl.hidden = true;

  taskStartTime = Date.now();
  updateTaskTimer();
  taskTimerIntervalId = setInterval(updateTaskTimer, 250);

  startGame();
  taskTimeoutId = setTimeout(finishTask, TASK_DURATION_MS);
});
