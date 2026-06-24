// src/blackjack/blackjack.gateway.ts
import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BlackjackService } from './blackjack.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class BlackjackGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private blackjackService: BlackjackService,
    private jwtService: JwtService,
  ) {
    console.log('🎮 BlackjackGateway: Inicializado');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')?.[1];

      console.log('🔌 Intento de conexión WebSocket');
      if (!token) {
        console.error('❌ Conexión rechazada: No se proporcionó token');
        client.emit('error', { message: 'Token requerido' });
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub.toString();
      client.data.userId = userId;

      console.log(`✅ Cliente conectado: ${userId}`);

      const balance = await this.blackjackService.getBalance(userId);
      const state = this.blackjackService.initGame(userId, balance);

      const { data } = await this.blackjackService['supabase']
        .from('usuario')
        .select('nombre_usuario')
        .eq('id', userId)
        .single();

      state.username = data?.nombre_usuario || 'Jugador';

      client.emit('gameState', {
        balance: state.balance,
        currentBet: 0,
        message: 'Haz tu apuesta',
        username: state.username,
        dealerHand: [],
        playerHands: [[]],
        playerScores: [0],
        dealerScore: 0,
        handStatus: [],
        handResults: [],
        showInsurance: false,
        canDouble: false,
        canSplit: false,
      });
    } catch (error) {
      console.error('❌ Error en conexión:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Cliente desconectado: ${client.data.userId}`);
  }

  @SubscribeMessage('joinGame')
  async handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    console.log('📥 joinGame recibido | User:', userId);

    if (!userId) {
      client.emit('error', { message: 'No autenticado' });
      return;
    }

    const state = await this.blackjackService.resetGame(userId);
    client.join(userId.toString());
    client.emit('gameState', state);
  }

  @SubscribeMessage('addBet')
  handleAddBet(
    @MessageBody() data: { amount: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    try {
      const update = this.blackjackService.addBet(userId, data.amount);
      client.emit('gameUpdate', update);
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('clearBet')
  handleClearBet(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const update = this.blackjackService.clearBet(userId);
    client.emit('gameUpdate', update);
  }

  @SubscribeMessage('dealInitial')
  async handleDealInitial(@ConnectedSocket() client: Socket) {
    try {
      const userId = client.data.userId;

      const initialState = await this.blackjackService.dealInitial(userId);
      client.emit('gameUpdate', initialState);

      const wait = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      await wait(500);
      client.emit(
        'gameUpdate',
        this.blackjackService.dealSingleCardToPlayer(userId, 0),
      );

      await wait(500);
      client.emit(
        'gameUpdate',
        this.blackjackService.dealSingleCardToDealer(userId, false),
      );

      await wait(500);
      client.emit(
        'gameUpdate',
        this.blackjackService.dealSingleCardToPlayer(userId, 0),
      );

      await wait(500);
      client.emit(
        'gameUpdate',
        this.blackjackService.dealSingleCardToDealer(userId, true),
      );

      await wait(300);
      const stateAfterCheck = this.blackjackService.checkInitial(userId);
      client.emit('gameUpdate', stateAfterCheck);

      // Si el jugador tiene blackjack y no hay seguro, automáticamente pasar al turno del dealer
      const currentState = this.blackjackService.getState(userId);
      if (
        currentState.handStatus[0] === 'blackjack' &&
        !currentState.showInsurance
      ) {
        await wait(1500);
        await this.animateDealerTurn(client, userId);
      }
    } catch (error) {
      client.emit('gameUpdate', { message: error.message });
    }
  }

  @SubscribeMessage('hit')
  handleHit(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      client.emit('gameUpdate', this.blackjackService.hit(userId));
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('stand')
  async handleStand(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      const update = this.blackjackService.stand(userId);
      client.emit('gameUpdate', update);

      const state = this.blackjackService.getState(userId);
      if (
        update.message === 'Turno del dealer' ||
        !state.handStatus.includes('playing')
      ) {
        await this.animateDealerTurn(client, userId);
      }
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('double')
  async handleDouble(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      const update = this.blackjackService.double(userId);
      client.emit('gameUpdate', update);

      const state = this.blackjackService.getState(userId);
      if (
        update.message === 'Turno del dealer' ||
        !state.handStatus.includes('playing')
      ) {
        await this.animateDealerTurn(client, userId);
      }
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('split')
  handleSplit(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      client.emit('gameUpdate', this.blackjackService.split(userId));
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('takeInsurance')
  async handleTakeInsurance(
    @MessageBody() data: { wantsInsurance: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    try {
      const update = this.blackjackService.takeInsurance(
        userId,
        data.wantsInsurance,
      );
      client.emit('gameUpdate', update);

      const state = this.blackjackService.getState(userId);
      if (state.handStatus[0] === 'blackjack' && !state.showInsurance) {
        const wait = (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms));
        await wait(1500);
        await this.animateDealerTurn(client, userId);
      }
    } catch (err) {
      client.emit('gameUpdate', { message: err.message });
    }
  }

  @SubscribeMessage('resetGame')
  async handleResetGame(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const state = await this.blackjackService.resetGame(userId);
    client.emit('gameState', state);
  }

  private async animateDealerTurn(client: Socket, userId: string) {
    const state = this.blackjackService.getState(userId);
    if (state.isDealerTurnActive) return; // Lock prevents multiple executions
    state.isDealerTurnActive = true;

    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    await wait(800);

    state.dealerScore = this.blackjackService['calculateScore'](
      state.dealerHand,
    );
    client.emit('gameUpdate', {
      dealerScore: state.dealerScore,
      message: 'Dealer revela...',
    });

    await wait(800);

    // Si el jugador tiene blackjack, el dealer NO roba cartas (solo revela)
    const playerHasBlackjack = state.handStatus.some((s) => s === 'blackjack');

    if (!playerHasBlackjack) {
      while (state.dealerScore < 17) {
        await wait(800);
        const card = state.deck.deal();
        state.dealerHand.push(card);
        state.dealerScore = this.blackjackService['calculateScore'](
          state.dealerHand,
        );

        client.emit('gameUpdate', {
          dealerHand: state.dealerHand.map((c) => ({
            suit: c.suit,
            value: c.value,
            isRed: c.isRed,
            numericValue: c.numericValue,
          })),
          dealerScore: state.dealerScore,
          message: `Dealer roba: ${state.dealerScore}`,
        });
      }
    }

    await wait(500);

    await this.blackjackService['resolveGame'](userId);
    const finalState = this.blackjackService['getPartialState'](state);
    client.emit('gameUpdate', finalState);
    state.isDealerTurnActive = false; // Release lock
  }
}
