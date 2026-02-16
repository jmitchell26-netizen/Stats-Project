# 32+ Card Bet

**A casino-style card betting game by Alvin and Joey**

🎰 [Play the Game](https://jmitchell26-netizen.github.io/Stats-Project/)

---

## About

32+ Card Bet is a web-based card game where players try to score 32 or higher with 4 cards to double their bet. Built as a statistics project to explore probability and expected value in gambling scenarios.

---

## How to Play

1. **Set up players** — Enter names for up to 5 players (leave blank to exclude)
2. **Set bankroll** — Choose starting money for each player (default: $200)
3. **Start a round** — Each player pays an ante (10% of max bet) and receives 4 face-down cards
4. **First card flips** — See your first card, then decide how much to bet (or push with no bet)
5. **Reveal all cards** — Your remaining 3 cards flip over
6. **Score your hand** — Cards 2-10 = face value, Face cards = 10, Aces = 11
7. **Win or lose**:
   - **Score 32+** → Win 2x your bet!
   - **Score below 32** → Lose your bet
   - **Push (no bet)** → Only lose the ante

---

## Features

### Gameplay
- 🃏 Standard 52-card deck, shuffled each round
- 👥 Support for 1-5 players with turn-based play
- 💰 Quick bet buttons ($10, $25, $50, All-in)
- 🏠 House tracker showing profit/loss per round and total

### Statistics
- 📊 Player statistics panel tracking:
  - Win rate percentage
  - Average score
  - Highest score achieved
  - Biggest payout won
  - Current and best win streaks
  - Win/Loss/Push record
- 💾 Stats persist in browser (localStorage)

### Visual Effects
- 🎴 Card dealing animations with shuffle effect
- 🎆 Fireworks for high scores (40+)
- 🪙 Coin rain for big payouts ($50+)
- ✨ Glowing buttons and smooth transitions

### Audio
- 🔊 Sound effects for card flips, wins, and losses
- 🎵 Background casino music (toggle on/off)

### Display
- 📺 Fullscreen mode for TV/presentation
- 📱 Responsive design for desktop and mobile

---

## Card Values

| Card | Value |
|------|-------|
| 2-10 | Face value |
| Jack, Queen, King | 10 |
| Ace | 11 |

**Maximum possible score:** 44 (four Aces)  
**Target score:** 32 or higher to win

---

## Probability Notes

- With 4 random cards, the probability of scoring 32+ is approximately **28%**
- Expected value favors the house due to the ante and payout structure
- This makes it a great tool for studying gambling mathematics!

---

## Tech Stack

- HTML5, CSS3, JavaScript (vanilla)
- No frameworks or dependencies
- Hosted on GitHub Pages
- Card images from [Deck of Cards API](https://deckofcardsapi.com/)

---

## Authors

- **Alvin** 
- **Joey Mitchell**

*Created for Statistics class project*
