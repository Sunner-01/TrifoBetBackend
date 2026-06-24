// src/juegos-casino/juegos-casino.controller.ts
import { Controller, Get, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { JuegosCasinoService } from './juegos-casino.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('juegos-casino')
export class JuegosCasinoController {
  constructor(private readonly juegosCasinoService: JuegosCasinoService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('historial/me')
  async getUserCasinoHistory(@Req() req) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    return this.juegosCasinoService.getUserHistory(userId);
  }

  @Get()
  async getActiveGames() {
    return this.juegosCasinoService.getActiveGames();
  }

  @Get(':id')
  async getGameById(@Param('id', ParseIntPipe) id: number) {
    return this.juegosCasinoService.getGameById(id);
  }
}
