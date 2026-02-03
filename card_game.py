"""
Text-based implementation of a simple 54-card betting game.

Rules covered:
- Standard 54-card deck (52 + 2 jokers), shuffled each round.
- Each player is dealt 4 facedown cards.
- Players pay a mandatory ante equal to 10% of max bet (default max bet: $50, ante: $5).
- After the first card is flipped, the player may place an additional bet up to the max bet.
- If the player declines to bet (bet = 0), their round ends (ante is still paid).
- Scoring: number cards = face value, face cards = 10, aces = 11.
- Goal: total score of 32 or higher across the 4 cards pays 2x the bet.
- Any joker automatically pays 3x the bet.

Run:
    python card_game.py --players Alice Bob
Optional flags:
    --max-bet 50 --bankroll 200 --seed 1234
"""

from __future__ import annotations

import argparse
import random
from dataclasses import dataclass, field
from typing import List, Optional, Sequence


SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A"] + [str(n) for n in range(2, 11)] + ["J", "Q", "K"]
JOKER = "JOKER"


@dataclass(frozen=True)
class Card:
    rank: str
    suit: Optional[str] = None  # Jokers have no suit

    def value(self) -> int:
        if self.rank == JOKER:
            return 0  # Special handling elsewhere
        if self.rank == "A":
            return 11
        if self.rank in {"K", "Q", "J"}:
            return 10
        return int(self.rank)

    def __str__(self) -> str:
        return self.rank if self.rank == JOKER else f"{self.rank}{self.suit}"


class Deck:
    def __init__(self) -> None:
        self.cards: List[Card] = []
        for suit in SUITS:
            for rank in RANKS:
                self.cards.append(Card(rank=rank, suit=suit))
        # Two jokers
        self.cards.append(Card(rank=JOKER))
        self.cards.append(Card(rank=JOKER))

    def shuffle(self, seed: Optional[int] = None) -> None:
        rng = random.Random(seed)
        rng.shuffle(self.cards)

    def draw(self, count: int) -> List[Card]:
        if count > len(self.cards):
            raise ValueError("Not enough cards to draw")
        drawn, self.cards = self.cards[:count], self.cards[count:]
        return drawn


@dataclass
class Player:
    name: str
    bankroll: float
    hand: List[Card] = field(default_factory=list)
    ante_paid: float = 0.0
    bet: float = 0.0
    outcome: str = ""
    payout: float = 0.0

    def reset_round(self) -> None:
        self.hand.clear()
        self.ante_paid = 0.0
        self.bet = 0.0
        self.outcome = ""
        self.payout = 0.0

    def pay(self, amount: float) -> None:
        if amount > self.bankroll:
            raise ValueError(f"{self.name} cannot cover ${amount:.2f}")
        self.bankroll -= amount

    def credit(self, amount: float) -> None:
        self.bankroll += amount


def score_hand(hand: Sequence[Card]) -> int:
    return sum(card.value() for card in hand if card.rank != JOKER)


def hand_has_joker(hand: Sequence[Card]) -> bool:
    return any(card.rank == JOKER for card in hand)


def prompt_bet(player: Player, max_bet: float) -> float:
    while True:
        raw = input(f"Bet for {player.name} (0 to skip, max ${max_bet:.0f}): ").strip()
        if raw == "":
            return 0.0
        try:
            value = float(raw)
        except ValueError:
            print("Please enter a number.")
            continue
        if value < 0:
            print("Bet cannot be negative.")
            continue
        if value > max_bet:
            print(f"Bet cannot exceed ${max_bet:.0f}.")
            continue
        if value > player.bankroll:
            print(f"Insufficient funds. Available: ${player.bankroll:.2f}")
            continue
        return value


def play_round(players: List[Player], max_bet: float, ante: float, seed: Optional[int]) -> None:
    deck = Deck()
    deck.shuffle(seed=seed)

    # Deal four facedown cards to each player.
    for player in players:
        player.reset_round()
        player.hand = deck.draw(4)

    for player in players:
        if player.bankroll < ante:
            player.outcome = "Cannot cover ante; skipped."
            continue

        player.pay(ante)
        player.ante_paid = ante
        print(f"\n{player.name} pays ante ${ante:.2f}. Bankroll now ${player.bankroll:.2f}.")

        # Reveal first card
        first_card = player.hand[0]
        print(f"First card for {player.name}: {first_card}")

        player.bet = prompt_bet(player, max_bet)
        if player.bet == 0:
            player.outcome = "No bet placed; round ended."
            continue

        player.pay(player.bet)
        print(f"{player.name} bets ${player.bet:.2f}. Bankroll now ${player.bankroll:.2f}.")

        # Reveal remaining cards
        remaining = player.hand[1:]
        remaining_str = ", ".join(str(c) for c in remaining)
        print(f"Remaining cards: {remaining_str}")

        if hand_has_joker(player.hand):
            win_amount = player.bet * 3
            player.credit(win_amount)
            player.payout = win_amount
            player.outcome = f"Joker! Wins ${win_amount:.2f} (3x bet)."
        else:
            total = score_hand(player.hand)
            print(f"Total score: {total}")
            if total >= 32:
                win_amount = player.bet * 2
                player.credit(win_amount)
                player.payout = win_amount
                player.outcome = f"Win! Score {total} pays ${win_amount:.2f} (2x bet)."
            else:
                player.outcome = f"Lose. Score {total} below 32."

        print(player.outcome)
        print(f"{player.name} bankroll: ${player.bankroll:.2f}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Play the 54-card betting game.")
    parser.add_argument(
        "--players",
        nargs="+",
        required=True,
        help="Names of players, e.g. --players Alice Bob",
    )
    parser.add_argument("--max-bet", type=float, default=50.0, help="Maximum bet amount.")
    parser.add_argument(
        "--bankroll", type=float, default=200.0, help="Starting bankroll per player."
    )
    parser.add_argument(
        "--ante",
        type=float,
        default=None,
        help="Ante amount; defaults to 10%% of max bet.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional RNG seed for deterministic shuffles.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ante = args.ante if args.ante is not None else args.max_bet * 0.10

    players = [Player(name=p, bankroll=args.bankroll) for p in args.players]
    play_round(players, max_bet=args.max_bet, ante=ante, seed=args.seed)

    print("\nRound summary:")
    for p in players:
        print(
            f"- {p.name}: {p.outcome or 'Skipped'} | "
            f"Bet ${p.bet:.2f} | Ante ${p.ante_paid:.2f} | "
            f"Payout ${p.payout:.2f} | Bankroll ${p.bankroll:.2f}"
        )


if __name__ == "__main__":
    main()

