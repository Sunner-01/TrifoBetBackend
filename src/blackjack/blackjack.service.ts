// src/blackjack/blackjack.service.ts
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const SUITS = ['Spade', 'Heart', 'Club', 'Diamond'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Card {
    suit: string;
    value: string;
    isRed: boolean;
    constructor(suit: string, value: string) {
        this.suit = suit;
        this.value = value;
        this.isRed = suit === 'Heart' || suit === 'Diamond';
    }
    get numericValue(): number {
        if (['J', 'Q', 'K'].includes(this.value)) return 10;
        if (this.value === 'A') return 11;
        return parseInt(this.value);
    }
}

class Deck {
    cards: Card[];
    constructor(decks = 6) {
        this.cards = [];
        for (let i = 0; i < decks; i++) {
            for (const s of SUITS) {
                for (const v of VALUES) {
                    this.cards.push(new Card(s, v));
                }
            }
        }
        this.shuffle();
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = crypto.randomInt(0, i + 1);
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal(): Card {
        if (this.cards.length < 20) {
            this.cards = new Deck().cards;
        }
        return this.cards.pop()!;
    }
}

interface GameState {
    deck: Deck;
    dealerHand: Card[];
    playerHands: Card[][];
    handBets: number[];
    handStatus: string[];
    handResults: string[];
    activeHandIndex: number;
    insuranceBet: number;
    balance: number;
    currentBet: number;
    message: string;
    dealerScore: number;
    playerScores: number[];
    showInsurance: boolean;
    canDouble: boolean;
    canSplit: boolean;
    username: string;
}

@Injectable()
export class BlackjackService {
    private supabase: SupabaseClient;
    private games = new Map<string, GameState>();

    constructor(private configService: ConfigService) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL')!;
        const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY')!;
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    async getBalance(userId: string): Promise<number> {
        const { data } = await this.supabase.from('usuario').select('saldo').eq('id', userId).single();
        return data?.saldo || 0;
    }

    async updateBalanceAndLog(userId: string, profit: number, bet: number, result: string): Promise<number> {
        const { data: current } = await this.supabase.from('usuario').select('saldo').eq('id', userId).single();
        const newBalance = (current?.saldo || 0) + profit;
        await this.supabase.from('usuario').update({ saldo: newBalance }).eq('id', userId);
        
        await this.supabase.from('game_logs').insert({
            user_id: userId,
            game_type: 'blackjack',
            bet,
            profit,
            result,
            created_at: new Date().toISOString(),
        });

        const fechaIso = new Date().toISOString();

        if (bet > 0) {
            await this.supabase.from('transaccion').insert({
                usuario_id: userId,
                tipo: 'apuesta',
                monto: bet,
                estado: 'completado',
                descripcion: `Apuesta en Blackjack`,
                fecha_creacion: fechaIso,
                fecha_procesado: fechaIso,
            });
        }

        const totalWin = bet + profit;
        if (totalWin > 0) {
            await this.supabase.from('transaccion').insert({
                usuario_id: userId,
                tipo: 'ganancia',
                monto: totalWin,
                estado: 'completado',
                descripcion: `Ganancia en Blackjack`,
                fecha_creacion: fechaIso,
                fecha_procesado: fechaIso,
            });
        }

        return newBalance;
    }

    initGame(userId: string, balance: number): GameState {
        const state: GameState = {
            deck: new Deck(),
            dealerHand: [],
            playerHands: [[]],
            handBets: [],
            handStatus: [],
            handResults: [],
            activeHandIndex: 0,
            insuranceBet: 0,
            balance,
            currentBet: 0,
            message: 'Haz tu apuesta',
            dealerScore: 0,
            playerScores: [0],
            showInsurance: false,
            canDouble: false,
            canSplit: false,
            username: userId
        };
        this.games.set(userId, state);
        return state;
    }

    getState(userId: string): GameState {
        const state = this.games.get(userId);
        if (!state) throw new Error('No hay juego activo');
        return state;
    }

    async resetGame(userId: string): Promise<GameState> {
        const balance = await this.getBalance(userId);
        const state = this.initGame(userId, balance);
        state.message = 'Haz tu apuesta';

        const { data } = await this.supabase
            .from('usuario')
            .select('nombre_usuario')
            .eq('id', userId)
            .single();

        state.username = data?.nombre_usuario || 'Jugador';

        return state;
    }

    addBet(userId: string, amount: number): Partial<GameState> {
        const state = this.getState(userId);
        if (state.balance < amount) throw new Error('Fondos insuficientes');
        state.currentBet += amount;
        state.balance -= amount;
        state.message = 'Apuesta agregada';
        return this.getPartialState(state);
    }

    clearBet(userId: string): Partial<GameState> {
        const state = this.getState(userId);
        state.balance += state.currentBet;
        state.currentBet = 0;
        state.message = 'Haz tu apuesta';
        return this.getPartialState(state);
    }

    async dealInitial(userId: string): Promise<Partial<GameState>> {
        const state = this.getState(userId);
        if (state.currentBet === 0) throw new Error('No hay apuesta');

        // Reset completo
        state.dealerHand = [];
        state.playerHands = [[]];
        state.handBets = [state.currentBet];
        state.handStatus = ['playing'];
        state.handResults = [];
        state.activeHandIndex = 0;
        state.insuranceBet = 0;
        state.message = 'Repartiendo...';
        state.playerScores = [0];
        state.dealerScore = 0;
        state.showInsurance = false;
        state.canDouble = false;
        state.canSplit = false;

        return this.getPartialState(state);
    }

    dealSingleCardToPlayer(userId: string, handIndex: number): Partial<GameState> {
        this.dealCardToPlayer(userId, handIndex);
        const state = this.getState(userId);
        return this.getPartialState(state);
    }

    dealSingleCardToDealer(userId: string, hidden: boolean): Partial<GameState> {
        this.dealCardToDealer(userId, hidden);
        const state = this.getState(userId);
        return this.getPartialState(state);
    }

    checkInitial(userId: string): Partial<GameState> {
        this.checkInitialState(userId);
        const state = this.getState(userId);
        return this.getPartialState(state);
    }

    private dealCardToPlayer(userId: string, handIndex: number): void {
        const state = this.getState(userId);
        const card = state.deck.deal();
        state.playerHands[handIndex].push(card);
        state.playerScores[handIndex] = this.calculateScore(state.playerHands[handIndex]);
    }

    private dealCardToDealer(userId: string, hidden: boolean): void {
        const state = this.getState(userId);
        const card = state.deck.deal();
        state.dealerHand.push(card);
        if (!hidden && state.dealerHand.length === 1) {
            state.dealerScore = card.numericValue;
        }
    }

    calculateScore(hand: Card[]): number {
        let score = 0;
        let aces = 0;
        for (const card of hand) {
            score += card.numericValue;
            if (card.value === 'A') aces++;
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    }

    private checkInitialState(userId: string) {
        const state = this.getState(userId);
        const dealerFace = state.dealerHand[0];
        const pScore = state.playerScores[0];

        // Blackjack Natural del Jugador (21 con 2 cartas iniciales)
        if (pScore === 21) {
            state.handStatus[0] = 'blackjack';
            state.message = '¡BLACKJACK!';

            // Si el dealer tiene As, ofrecer seguro
            if (dealerFace.value === 'A' && state.balance >= state.currentBet / 2) {
                state.showInsurance = true;
                state.message = '¡BLACKJACK! ¿Seguro?';
                return;
            }

            // Si el dealer NO tiene As, el gateway se encargará de activar el turno del dealer
            return;
        }

        // Oferta de Seguro si Dealer tiene As (y jugador NO tiene blackjack)
        if (dealerFace.value === 'A' && state.balance >= state.currentBet / 2) {
            state.showInsurance = true;
            state.message = '¿Seguro?';
        } else {
            // Turno normal del jugador
            this.startPlayerTurn(userId);
        }
    }

    takeInsurance(userId: string, wantsInsurance: boolean): Partial<GameState> {
        const state = this.getState(userId);
        state.showInsurance = false;

        if (wantsInsurance) {
            const cost = state.currentBet / 2;
            if (state.balance < cost) throw new Error('Fondos insuficientes para seguro');
            state.insuranceBet = cost;
            state.balance -= cost;
            state.message = 'Seguro apostado';
        } else {
            state.message = 'Seguro rechazado';
        }

        // Verificar Blackjack del dealer
        const dScore = this.calculateScore(state.dealerHand);
        if (dScore === 21) {
            this.resolveDealerTurn(userId);
        } else {
            if (state.insuranceBet > 0) {
                state.message = 'Dealer no tiene Blackjack. Seguro perdido.';
                state.insuranceBet = 0;
            }
            if (state.handStatus[0] === 'blackjack') {
                // Si el jugador tiene blackjack, mantener el mensaje
                state.message = '¡BLACKJACK!';
            } else {
                this.startPlayerTurn(userId);
            }
        }

        return this.getPartialState(state);
    }

    private startPlayerTurn(userId: string) {
        const state = this.getState(userId);
        state.message = `Tu turno. Mano ${state.activeHandIndex + 1}`;
        this.updateGameButtons(userId);
    }

    private updateGameButtons(userId: string) {
        const state = this.getState(userId);
        const hand = state.playerHands[state.activeHandIndex];
        state.canSplit = hand.length === 2 && hand[0].value === hand[1].value && state.balance >= state.handBets[state.activeHandIndex];
        state.canDouble = hand.length === 2 && state.balance >= state.handBets[state.activeHandIndex];
    }

    hit(userId: string): Partial<GameState> {
        const state = this.getState(userId);
        this.dealCardToPlayer(userId, state.activeHandIndex);
        const score = state.playerScores[state.activeHandIndex];

        if (score > 21) {
            state.handStatus[state.activeHandIndex] = 'busted';
            state.message = 'Bust!';
            this.nextHand(userId);
        } else {
            // Si llega a 21, solo desactivar botones de split y double
            // pero dejar que el jugador decida cuándo plantarse
            state.canSplit = false;
            state.canDouble = false;
            if (score === 21) {
                state.message = '¡21! Puedes pedir otra carta o plantarte';
            }
        }
        return this.getPartialState(state);
    }

    stand(userId: string): Partial<GameState> {
        const state = this.getState(userId);
        if (state.handStatus[state.activeHandIndex] === 'playing' || state.handStatus[state.activeHandIndex] === 'blackjack') {
            state.handStatus[state.activeHandIndex] = state.handStatus[state.activeHandIndex] === 'blackjack' ? 'blackjack' : 'stood';
        }

        // Verificar si hay más manos
        if (state.activeHandIndex < state.playerHands.length - 1) {
            state.activeHandIndex++;
            this.startPlayerTurn(userId);
        } else {
            this.checkPlayerFinished(userId);
        }

        return this.getPartialState(state);
    }

    double(userId: string): Partial<GameState> {
        const state = this.getState(userId);
        const bet = state.handBets[state.activeHandIndex];
        if (state.balance < bet) throw new Error('Fondos insuficientes para doblar');

        state.balance -= bet;
        state.handBets[state.activeHandIndex] += bet;

        this.dealCardToPlayer(userId, state.activeHandIndex);
        const score = state.playerScores[state.activeHandIndex];

        if (score > 21) {
            state.handStatus[state.activeHandIndex] = 'busted';
            state.message = 'Bust!';
        } else {
            state.handStatus[state.activeHandIndex] = 'stood';
        }

        // Verificar si hay más manos
        if (state.activeHandIndex < state.playerHands.length - 1) {
            state.activeHandIndex++;
            this.startPlayerTurn(userId);
        } else {
            this.checkPlayerFinished(userId);
        }

        return this.getPartialState(state);
    }

    split(userId: string): Partial<GameState> {
        const state = this.getState(userId);
        const handToSplit = state.playerHands[state.activeHandIndex];
        const cardToMove = handToSplit.pop()!;

        if (!cardToMove) throw new Error('No se puede dividir');

        // Crear nueva mano
        state.playerHands.push([cardToMove]);
        state.handBets.push(state.handBets[state.activeHandIndex]);
        state.handStatus.push('playing');
        state.handResults.push('');
        state.playerScores.push(cardToMove.numericValue);
        state.balance -= state.handBets[state.activeHandIndex];

        // Actualizar score de la mano actual
        state.playerScores[state.activeHandIndex] = this.calculateScore(state.playerHands[state.activeHandIndex]);

        return this.getPartialState(state);
    }

    private nextHand(userId: string) {
        const state = this.getState(userId);
        if (state.activeHandIndex < state.playerHands.length - 1) {
            state.activeHandIndex++;
            this.startPlayerTurn(userId);
        } else {
            this.checkPlayerFinished(userId);
        }
    }

    private checkPlayerFinished(userId: string) {
        const state = this.getState(userId);
        if (state.handStatus.every(s => s === 'busted')) {
            state.dealerScore = this.calculateScore(state.dealerHand);
            this.resolveGame(userId);
        } else {
            state.message = 'Turno del dealer';
        }
    }

    private resolveDealerTurn(userId: string): void {
        const state = this.getState(userId);

        // Revelar carta oculta
        state.dealerScore = this.calculateScore(state.dealerHand);

        // Si el dealer tiene blackjack
        if (state.dealerScore === 21 && state.dealerHand.length === 2) {
            if (state.insuranceBet > 0) {
                state.balance += state.insuranceBet * 3;
                state.message = '¡Seguro paga!';
            }
            // No necesita robar más cartas
            return;
        }

        // El dealer ya habrá robado sus cartas desde el gateway con animación
    }

    async resolveGame(userId: string) {
        const state = this.getState(userId);
        const dScore = state.dealerScore;
        let totalWin = 0;
        let overallResult = 'lose';

        state.playerHands.forEach((hand, i) => {
            const pScore = state.playerScores[i];
            const status = state.handStatus[i];
            const bet = state.handBets[i];
            let result = '';

            if (status === 'busted') {
                result = 'TE PASASTE';
            } else if (status === 'blackjack') {
                if (dScore === 21 && state.dealerHand.length === 2) {
                    result = 'PUSH';
                    totalWin += bet;
                    overallResult = 'push';
                } else {
                    result = 'BLACKJACK';
                    totalWin += bet + (bet * 1.5);
                    overallResult = 'win';
                }
            } else {
                if (dScore > 21) {
                    result = 'GANAS';
                    totalWin += bet * 2;
                    overallResult = 'win';
                } else if (pScore > dScore) {
                    result = 'GANAS';
                    totalWin += bet * 2;
                    overallResult = 'win';
                } else if (pScore === dScore) {
                    result = 'PUSH';
                    totalWin += bet;
                    if (overallResult !== 'win') overallResult = 'push';
                } else {
                    result = 'PIERDES';
                }
            }

            state.handResults[i] = result;
        });

        const profit = totalWin - state.handBets.reduce((a, b) => a + b, 0);
        await this.updateBalanceAndLog(userId, profit, state.currentBet, overallResult);
        state.balance += totalWin;
        state.message = 'Juego resuelto';
    }

    getPartialState(state: GameState): any {
        return {
            dealerHand: state.dealerHand.map(c => ({
                suit: c.suit,
                value: c.value,
                isRed: c.isRed,
                numericValue: c.numericValue,
            })),
            playerHands: state.playerHands.map(h => h.map(c => ({
                suit: c.suit,
                value: c.value,
                isRed: c.isRed,
                numericValue: c.numericValue,
            }))),
            handBets: state.handBets,
            handStatus: state.handStatus,
            handResults: state.handResults,
            activeHandIndex: state.activeHandIndex,
            insuranceBet: state.insuranceBet,
            balance: state.balance,
            currentBet: state.currentBet,
            message: state.message,
            dealerScore: state.dealerScore,
            playerScores: state.playerScores,
            showInsurance: state.showInsurance,
            canDouble: state.canDouble,
            canSplit: state.canSplit,
            username: state.username
        };
    }
}