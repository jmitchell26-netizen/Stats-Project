// Simple front-end implementation of the 32+ card betting game.
// Rules:
// - 52-card deck, shuffled each round.
// - Deal 4 face-down cards; ante is 10% of max bet.
// - After first card is revealed, choose bet (0 to skip, up to max bet).
// - Score >= 32 pays 2x bet.
// - Number cards = face value; face cards = 10; aces = 11.

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUIT_CODES = { "♠": "S", "♥": "H", "♦": "D", "♣": "C" };
const CARD_BACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='420'%3E%3Crect width='300' height='420' rx='18' ry='18' fill='%230f172a' stroke='%2322d3ee' stroke-width='6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23e5e7eb' font-family='Inter' font-size='48' font-weight='700'%3E32%2B%3C/text%3E%3C/svg%3E";

const els = {
  bankrollDisplay: document.getElementById("bankrollDisplay"),
  bankrollInput: document.getElementById("bankrollInput"),
  maxBetInput: document.getElementById("maxBetInput"),
  seedInput: document.getElementById("seedInput"),
  sfxToggle: document.getElementById("sfxToggle"),
  startRoundBtn: document.getElementById("startRoundBtn"),
  resetBtn: document.getElementById("resetBtn"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  cardsContainer: document.getElementById("cardsContainer"),
  statusText: document.getElementById("statusText"),
  anteDisplay: document.getElementById("anteDisplay"),
  maxBetDisplay: document.getElementById("maxBetDisplay"),
  historyList: document.getElementById("historyList"),
  houseRound: document.getElementById("houseRound"),
  houseTotal: document.getElementById("houseTotal"),
  summaryOverlay: document.getElementById("summaryOverlay"),
  summaryModal: document.getElementById("summaryModal"),
  summaryValues: document.getElementById("summaryValues"),
  summaryTotal: document.getElementById("summaryTotal"),
  summaryPayout: document.getElementById("summaryPayout"),
  summaryNote: document.getElementById("summaryNote"),
  summaryContinue: document.querySelector(".summary-continue"),
  playerNameInputs: Array.from(document.querySelectorAll(".player-name-input")),
};
els.resultContainer = document.querySelector(".result");
els.tableEl = document.querySelector(".table");
els.sheen = document.createElement("div");
els.sheen.className = "sheen";
if (els.tableEl) {
  els.tableEl.appendChild(els.sheen);
}

let state = {
  players: [],
  maxBet: 50,
  ante: 5,
  deck: [],
  seed: undefined,
  activeIndex: -1,
  roundActive: false,
  sfxEnabled: true,
  audioCtx: null,
  summaryTimer: null,
  houseRound: 0,    // House profit this round
  houseTotal: 0,    // House profit all-time
};

function mulberry32(seed) {
  // Simple deterministic RNG for seeded shuffles
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDeck() {
  const cards = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      cards.push({ rank, suit });
    });
  });
  return cards;
}

function shuffleDeck(cards, seed) {
  const rng = seed !== undefined && !Number.isNaN(seed) ? mulberry32(seed) : Math.random;
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function cardValue(card) {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}

function scoreHand(hand) {
  return hand.reduce((sum, c) => sum + cardValue(c), 0);
}

function buildHandElement(
  hand,
  { revealAll = false, animate = false, firstCardRevealed = true, isActive = false } = {}
) {
  const wrapper = document.createElement("div");
  wrapper.className = "cards";
  const cardsForAnimation = [];

  hand.forEach((card, idx) => {
    const shouldShow = revealAll || (firstCardRevealed && idx === 0);
    const cardEl = document.createElement("div");
    cardEl.className = "card-view";
    if (isActive && shouldShow) {
      cardEl.classList.add("active-glow");
    }

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const backFace = document.createElement("div");
    backFace.className = "card-face back";
    const backImg = document.createElement("img");
    backImg.src = CARD_BACK;
    backImg.alt = "Card back";
    backFace.appendChild(backImg);

    const frontFace = document.createElement("div");
    frontFace.className = "card-face front";
    const frontImg = document.createElement("img");
    frontImg.src = cardImageUrl(card);
    frontImg.alt = formatCard(card);
    frontFace.appendChild(frontImg);

    inner.appendChild(backFace);
    inner.appendChild(frontFace);
    cardEl.appendChild(inner);

    if (shouldShow) {
      cardEl.classList.add("flipped");
    }

    const footEl = document.createElement("div");
    footEl.className = "foot";
    footEl.textContent = shouldShow ? formatCard(card) : "Face down";

    cardEl.appendChild(footEl);
    wrapper.appendChild(cardEl);
    cardsForAnimation.push(cardEl);
  });

  if (animate && revealAll) {
    cardsForAnimation.forEach((cardEl, idx) => {
      cardEl.classList.remove("flipped");
      setTimeout(() => {
        cardEl.classList.add("flipped");
      }, 120 * idx);
    });
  }

  return wrapper;
}

function updateDisplays() {
  const primaryBankroll =
    state.players.length > 0 ? state.players[0].bankroll : Number(els.bankrollInput.value) || 0;
  els.bankrollDisplay.textContent = `$${primaryBankroll.toFixed(2)}`;
  if (state.players.length > 0) {
    els.bankrollInput.value = primaryBankroll;
  }
  els.anteDisplay.textContent = `Ante: $${state.ante.toFixed(2)}`;
  els.maxBetDisplay.textContent = `Max Bet: $${state.maxBet.toFixed(2)}`;
  if (els.sfxToggle) {
    els.sfxToggle.checked = state.sfxEnabled;
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function updateRoundButtons() {
  // Update start/end button text based on round state
  if (state.roundActive) {
    els.startRoundBtn.textContent = "End Round";
    els.startRoundBtn.classList.add("end-round");
    if (els.nextRoundBtn) els.nextRoundBtn.classList.add("hidden");
  } else {
    els.startRoundBtn.textContent = "Start Round";
    els.startRoundBtn.classList.remove("end-round");
    // Show "Next Round" button if we have players (i.e., a round just finished)
    if (els.nextRoundBtn && state.players.length > 0) {
      els.nextRoundBtn.classList.remove("hidden");
    }
  }
}

function endRound() {
  state.roundActive = false;
  state.activeIndex = -1;
  state.players.forEach((p) => {
    p.awaitingBet = false;
    p.settled = true;
  });
  renderPlayers();
  updateRoundButtons();
  setStatus("Round ended early.");
}

function handleStartEndClick() {
  if (state.roundActive) {
    endRound();
  } else {
    startRound();
  }
}

function addHistoryEntry(text, outcome) {
  const li = document.createElement("li");
  li.innerHTML = `${outcome ? `<span class="highlight">${outcome}</span> — ` : ""}${text}`;
  els.historyList.prepend(li);
}

function startRound() {
  resumeAudioCtx();
  const bankroll = Number(els.bankrollInput.value);
  const maxBet = Number(els.maxBetInput.value);
  const seedRaw = els.seedInput.value;
  const seed = seedRaw === "" ? undefined : Number(seedRaw);
  const playerNames = els.playerNameInputs
    .map((input, idx) => {
      const trimmed = input.value.trim();
      if (trimmed) return trimmed;
      if (idx === 0) return "Player 1";
      return "";
    })
    .filter((n) => n !== "");
  const playerCount = Math.max(1, Math.min(5, playerNames.length || 1));

  if (Number.isNaN(bankroll) || bankroll <= 0) {
    setStatus("Enter a valid bankroll above 0.");
    return;
  }
  if (Number.isNaN(maxBet) || maxBet <= 0) {
    setStatus("Enter a valid max bet above 0.");
    return;
  }

  state.maxBet = maxBet;
  state.ante = Number((maxBet * 0.1).toFixed(2));
  state.seed = seed;
  state.deck = shuffleDeck(buildDeck(), seed);
  state.sfxEnabled = els.sfxToggle?.checked ?? true;

  state.players = Array.from({ length: playerCount }, (_v, idx) => {
    const hand = state.deck.slice(idx * 4, idx * 4 + 4);
    return {
      id: idx,
      name: playerNames[idx] || `Player ${idx + 1}`,
      bankroll,
      hand,
      awaitingBet: false,
      settled: false,
      outcome: "",
      payout: 0,
      total: 0,
      revealAll: false,
    };
  });

  // Reset round profit
  state.houseRound = 0;

  state.players.forEach((p) => {
    if (p.bankroll >= state.ante) {
      p.bankroll -= state.ante;
      p.outcome = `Paid ante $${state.ante.toFixed(2)}.`;
      // House collects ante
      state.houseRound += state.ante;
      state.houseTotal += state.ante;
    } else {
      p.awaitingBet = false;
      p.settled = true;
      p.outcome = "Insufficient bankroll for ante.";
    }
  });

  state.activeIndex = state.players.findIndex((p) => !p.settled);
  if (state.activeIndex !== -1) {
    state.players[state.activeIndex].awaitingBet = true;
  }
  state.roundActive = state.activeIndex !== -1;

  renderPlayers();
  updateDisplays();
  updateHouseDisplay();
  updateRoundButtons();
  setStatus(
    state.roundActive
      ? `Dealt ${playerCount} player${playerCount > 1 ? "s" : ""}. ${state.players[state.activeIndex].name}'s turn.`
      : "No eligible players for this round."
  );
}

function placeBet(playerId, betValue) {
  resumeAudioCtx();
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  if (playerId !== state.activeIndex) {
    setStatus("Wait for your turn. The game goes player by player.");
    return;
  }
  if (!player.awaitingBet) {
    setStatus(`${player.name} is not awaiting a bet.`);
    return;
  }

  const bet = Number(betValue);
  if (Number.isNaN(bet) || bet < 0) {
    setStatus("Enter a valid bet (0 to skip).");
    return;
  }
  if (bet > state.maxBet) {
    setStatus(`Bet cannot exceed $${state.maxBet.toFixed(2)}.`);
    return;
  }
  if (bet > player.bankroll) {
    setStatus(`${player.name} has insufficient bankroll for that bet.`);
    return;
  }

  let outcome;
  let payout = 0;
  let total = 0;
  player.awaitingBet = false;
  player.revealAll = true;

  if (bet === 0) {
    outcome = "No bet placed. Round ended.";
    player.settled = true;
    player.outcome = outcome;
    renderPlayers(player.id);
    playSfx("flip");
    updateHouseDisplay();
    addHistoryEntry(`${player.name}: ${outcome}`, "Push");
    setStatus(`${player.name}: ${outcome}`);
    playSfx("push");
    triggerSheen();
    showSummaryOverlay({ total: 0, payout: 0, outcome: "Push" });
    advanceTurn();
    return;
  }

  player.bankroll -= bet;
  total = scoreHand(player.hand);
  player.total = total;
  
  // Calculate house profit from this bet
  // House collects bet, pays out payout
  let houseProfit = bet; // House receives bet
  
  if (total >= 32) {
    payout = bet * 2;
    outcome = `Win! Score ${total} pays 2x.`;
    houseProfit -= payout; // House pays out (net: bet - 2*bet = -bet)
  } else {
    outcome = `Lose. Score ${total} below 32.`;
    // House keeps the bet (net: +bet)
  }
  
  state.houseRound += houseProfit;
  state.houseTotal += houseProfit;

  player.bankroll += payout;
  player.payout = payout;
  player.settled = true;
  player.outcome = outcome;

  renderPlayers(player.id);
  playSfx("flip");
  updateDisplays();
  updateHouseDisplay();

  const detail = `${player.name} bet $${bet.toFixed(2)} | Payout $${payout.toFixed(
    2
  )} | ${outcome}`;
  setStatus(detail);
  addHistoryEntry(detail, total >= 32 ? "Win" : "Lose");

  animateHouseFlash();
  showSummaryOverlay({
    total,
    payout,
    outcome: payout > 0 ? "Win" : total === 0 ? "Push" : "Lose",
  });
  playSfx(total >= 32 ? "win" : "lose");
  triggerSheen();

  advanceTurn();
}

function resetBankroll() {
  const bankroll = Number(els.bankrollInput.value);
  if (Number.isNaN(bankroll) || bankroll <= 0) {
    setStatus("Enter a valid bankroll above 0.");
    return;
  }
  state.players.forEach((p) => {
    p.bankroll = bankroll;
  });
  // Also reset house stats
  state.houseRound = 0;
  state.houseTotal = 0;
  updateDisplays();
  updateHouseDisplay();
  renderPlayers();
  setStatus("Bankroll & house stats reset.");
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

function cardImageUrl(card) {
  const suitCode = SUIT_CODES[card.suit] || "S";
  const rankCode = card.rank === "10" ? "0" : card.rank;
  // Public, hotlink-friendly sprite from deckofcardsapi.com
  return `https://deckofcardsapi.com/static/img/${rankCode}${suitCode}.png`;
}

function clearResult() {
  // Reset round profit but keep total
  state.houseRound = 0;
  updateHouseDisplay();
  clearResultClasses();
}

function updateHouseDisplay() {
  if (els.houseRound) {
    const sign = state.houseRound >= 0 ? "+" : "";
    els.houseRound.textContent = `${sign}$${state.houseRound.toFixed(2)}`;
    els.houseRound.classList.toggle("positive", state.houseRound > 0);
    els.houseRound.classList.toggle("negative", state.houseRound < 0);
  }
  if (els.houseTotal) {
    const sign = state.houseTotal >= 0 ? "+" : "";
    els.houseTotal.textContent = `${sign}$${state.houseTotal.toFixed(2)}`;
    els.houseTotal.classList.toggle("positive", state.houseTotal > 0);
    els.houseTotal.classList.toggle("negative", state.houseTotal < 0);
  }
}

function clearResultClasses() {
  if (els.resultContainer) {
    els.resultContainer.classList.remove("result-win", "result-lose", "result-push");
  }
  if (els.houseRound) {
    els.houseRound.classList.remove("flash-anim", "flash");
  }
  if (els.houseTotal) {
    els.houseTotal.classList.remove("flash-anim", "flash");
  }
}

function animateCount(el, target, { duration = 1000, prefix = "", suffix = "", decimals = 0 } = {}) {
  if (!el || target === null || target === undefined) return;
  const start = performance.now();
  const startVal = 0;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const format = (val) => {
    const fixed = val.toFixed(decimals);
    return `${prefix}${fixed}${suffix}`;
  };
  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = ease(progress);
    const current = startVal + (target - startVal) * eased;
    el.textContent = format(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = format(target);
    }
  };
  requestAnimationFrame(step);
}

function showSummaryOverlay({ total, payout, outcome }) {
  if (!els.summaryOverlay) return;
  const isWin = outcome?.toLowerCase().includes("win");
  const isLose = outcome?.toLowerCase().includes("lose");
  const isPush = outcome?.toLowerCase().includes("push");
  if (state.summaryTimer) {
    clearTimeout(state.summaryTimer);
    state.summaryTimer = null;
  }
  els.summaryOverlay.classList.remove("hidden", "summary-win", "summary-lose", "summary-push");
  if (isWin) els.summaryOverlay.classList.add("summary-win");
  else if (isLose) els.summaryOverlay.classList.add("summary-lose");
  else if (isPush) els.summaryOverlay.classList.add("summary-push");

  // Show only the outcome (no numbers), centered in both slots
  const outcomeText = outcome || "—";
  if (els.summaryTotal) {
    els.summaryTotal.textContent = outcomeText;
    els.summaryTotal.classList.add("summary-outcome");
  }
  if (els.summaryPayout) {
    els.summaryPayout.textContent = "";
    els.summaryPayout.classList.remove("summary-outcome");
  }
  if (els.summaryValues) {
    els.summaryValues.classList.add("outcome-phase");
    els.summaryValues.classList.remove("show-numbers");
  }
  if (els.summaryNote) {
    els.summaryNote.textContent = "";
  }

  // Hide "Click to continue" initially for win/lose; show immediately for push
  if (els.summaryContinue) {
    if (isPush) {
      els.summaryContinue.classList.remove("hidden");
    } else {
      els.summaryContinue.classList.add("hidden");
    }
  }

  els.summaryOverlay.classList.remove("hidden");
  if (els.summaryModal) {
    els.summaryModal.classList.remove("pop");
    // force reflow
    void els.summaryModal.offsetWidth;
    els.summaryModal.classList.add("pop");
  }
  // retrigger confetti animation
  const confetti = els.summaryOverlay.querySelector(".summary-confetti");
  if (confetti) {
    confetti.style.animation = "none";
    confetti.offsetHeight; // force reflow
    confetti.style.animation = "";
  }

  // For push: stop here, no number animation.
  if (isPush) {
    return;
  }

  // Delay numbers by 1.5s, then animate total and payout.
  state.summaryTimer = setTimeout(() => {
    state.summaryTimer = null;
    // Show "Click to continue" now that numbers are animating
    if (els.summaryContinue) {
      els.summaryContinue.classList.remove("hidden");
    }
    if (els.summaryValues) {
      els.summaryValues.classList.remove("outcome-phase");
      els.summaryValues.classList.add("show-numbers");
    }
    if (els.summaryTotal) {
      els.summaryTotal.classList.remove("summary-outcome");
      els.summaryTotal.textContent = "";
      animateCount(els.summaryTotal, total, { duration: 1400, decimals: 0 });
    }
    if (els.summaryPayout) {
      els.summaryPayout.classList.remove("summary-outcome");
      els.summaryPayout.textContent = "";
      animateCount(els.summaryPayout, payout, {
        duration: 1500,
        decimals: 2,
        prefix: payout > 0 ? "+$" : "$",
      });
    }
  }, 1500);
}

function animateHouseFlash() {
  clearResultClasses();
  const isPositive = state.houseRound > 0;
  const isNegative = state.houseRound < 0;
  
  if (els.resultContainer) {
    els.resultContainer.classList.toggle("result-win", isNegative); // House down = player won
    els.resultContainer.classList.toggle("result-lose", isPositive); // House up = player lost
  }
  
  if (els.houseRound) {
    els.houseRound.classList.add("flash-anim");
    setTimeout(() => els.houseRound.classList.add("flash"), 400);
  }
  if (els.houseTotal) {
    els.houseTotal.classList.add("flash-anim");
    setTimeout(() => els.houseTotal.classList.add("flash"), 400);
  }
}

function advanceTurn() {
  if (!state.roundActive) return;
  let next = state.activeIndex + 1;
  while (next < state.players.length && state.players[next].settled) {
    next += 1;
  }
  if (next < state.players.length) {
    state.activeIndex = next;
    state.players[next].awaitingBet = true;
    renderPlayers();
    setStatus(`${state.players[next].name}'s turn.`);
  } else {
    state.roundActive = false;
    state.activeIndex = -1;
    renderPlayers();
    updateRoundButtons();
    setStatus("Round complete.");
  }
}

function ensureAudioCtx() {
  if (!state.sfxEnabled) return null;
  if (!state.audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    state.audioCtx = new Ctx();
  }
  if (state.audioCtx.state === "suspended") {
    state.audioCtx.resume().catch(() => {});
  }
  return state.audioCtx;
}

function resumeAudioCtx() {
  if (!state.sfxEnabled) return;
  if (state.audioCtx && state.audioCtx.state === "suspended") {
    state.audioCtx.resume().catch(() => {});
  } else if (!state.audioCtx) {
    ensureAudioCtx();
  }
}

function playSfx(type) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  let freq = 440;
  let duration = 0.18;
  switch (type) {
    case "flip":
      freq = 600;
      duration = 0.16;
      break;
    case "win":
      freq = 760;
      duration = 0.22;
      break;
    case "lose":
      freq = 220;
      duration = 0.24;
      break;
    case "push":
      freq = 360;
      duration = 0.2;
      break;
    default:
      break;
  }
  osc.frequency.value = freq;
  gain.gain.value = 0.2;
  osc.connect(gain).connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

function triggerSheen() {
  if (!els.sheen) return;
  els.sheen.classList.remove("active");
  // force reflow to restart animation
  void els.sheen.offsetWidth;
  els.sheen.classList.add("active");
  setTimeout(() => els.sheen.classList.remove("active"), 1500);
}

function renderPlayers(animatePlayerId = null) {
  els.cardsContainer.innerHTML = "";

  state.players.forEach((player) => {
    const panel = document.createElement("div");
    panel.className = "card player-panel";
    const isActive = player.id === state.activeIndex;
    if (isActive) {
      panel.classList.add("active");
    }
    if (!isActive && state.activeIndex !== -1) {
      panel.classList.add("inactive");
    }

    const head = document.createElement("div");
    head.className = "player-head";
    const badgeClass = player.settled
      ? player.payout > 0
        ? "badge win"
        : player.outcome && player.outcome.toLowerCase().includes("lose")
        ? "badge lose"
        : "badge push"
      : "badge";
    const badgeText = player.settled
      ? player.payout > 0
        ? "Win"
        : player.outcome && player.outcome.toLowerCase().includes("lose")
        ? "Lose"
        : "Push"
      : isActive
      ? "Your turn"
      : "Awaiting bet";

    head.innerHTML = `<div><div class="player-name">${player.name}</div><div class="player-note"><span class="${badgeClass}">${badgeText}</span></div></div>
    <div class="player-bankroll">Bankroll: $${player.bankroll.toFixed(2)}</div>`;
    panel.appendChild(head);

    const handEl = buildHandElement(player.hand, {
      revealAll: player.revealAll || player.settled,
      animate: animatePlayerId === player.id && (player.revealAll || player.settled),
      firstCardRevealed: isActive && player.awaitingBet && !player.revealAll && !player.settled,
      isActive,
    });
    panel.appendChild(handEl);

    const actions = document.createElement("div");
    actions.className = "betting";
    const betInfo = document.createElement("div");
    betInfo.className = "bet-info";

    const label = document.createElement("label");
    label.textContent = "Bet after first flip";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = "0";
    input.dataset.playerId = player.id;
    input.className = "bet-input";

    betInfo.appendChild(label);
    betInfo.appendChild(input);

    const btn = document.createElement("button");
    btn.textContent = "Place Bet & Reveal";
    btn.className = "primary bet-btn";
    btn.dataset.playerId = player.id;
    btn.disabled = !isActive || !player.awaitingBet;

    const pushBtn = document.createElement("button");
    pushBtn.textContent = "Push (no bet)";
    pushBtn.className = "ghost push-btn";
    pushBtn.dataset.playerId = player.id;
    pushBtn.disabled = !isActive || !player.awaitingBet;

    actions.appendChild(betInfo);
    actions.appendChild(btn);
    actions.appendChild(pushBtn);
    panel.appendChild(actions);

    els.cardsContainer.appendChild(panel);
  });
}

// Wire events
els.startRoundBtn.addEventListener("click", handleStartEndClick);
els.resetBtn.addEventListener("click", resetBankroll);
if (els.nextRoundBtn) {
  els.nextRoundBtn.addEventListener("click", startRound);
}
els.cardsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("bet-btn")) {
    const id = Number(e.target.dataset.playerId);
    const panel = e.target.closest(".player-panel");
    const input = panel?.querySelector(`input[data-player-id="${id}"]`);
    resumeAudioCtx();
    e.target.classList.add("success-glow");
    setTimeout(() => e.target.classList.remove("success-glow"), 400);
    placeBet(id, input.value);
  } else if (e.target.classList.contains("push-btn")) {
    const id = Number(e.target.dataset.playerId);
    resumeAudioCtx();
    e.target.classList.add("success-glow");
    setTimeout(() => e.target.classList.remove("success-glow"), 400);
    placeBet(id, 0);
  }
});

// Initialize UI
els.cardsContainer.innerHTML =
  "<p class='help-text'>Start a round to deal cards to up to 5 players.</p>";
updateDisplays();
updateHouseDisplay();
setStatus("Waiting to start a round.");

// SFX toggle
if (els.sfxToggle) {
  els.sfxToggle.addEventListener("change", () => {
    state.sfxEnabled = els.sfxToggle.checked;
    if (state.sfxEnabled) {
      resumeAudioCtx();
    }
  });
}

// Unlock audio on first user interaction (required by some browsers)
window.addEventListener(
  "pointerdown",
  () => {
    resumeAudioCtx();
  },
  { once: true }
);

// Dismiss overlay on click
if (els.summaryOverlay) {
  els.summaryOverlay.addEventListener("click", () => {
    els.summaryOverlay.classList.add("hidden");
  });
}

// Dismiss overlay on any screen click if visible
document.addEventListener("pointerdown", () => {
  if (els.summaryOverlay && !els.summaryOverlay.classList.contains("hidden")) {
    els.summaryOverlay.classList.add("hidden");
  }
});
