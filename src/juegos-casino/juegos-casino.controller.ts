import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JuegosCasinoService } from './juegos-casino.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('juegos-casino')
export class JuegosCasinoController {
    constructor(private readonly juegosCasinoService: JuegosCasinoService) {}

    // Público: Retorna solo juegos habilitados
    @Get()
    async getActiveGames() {
        return this.juegosCasinoService.getActiveGames();
    }

    // Admin: Retorna todos los juegos
    @UseGuards(AuthGuard('jwt'))
    @Get('admin')
    async getAllGamesAdmin() {
        // Todo: Añadir validación de rol de admin aquí si es necesario
        return this.juegosCasinoService.getAllGamesAdmin();
    }

    // Admin: Retorna estadísticas detalladas de todos los juegos
    @UseGuards(AuthGuard('jwt'))
    @Get('admin/stats')
    async getAllGamesAdminStats() {
        return this.juegosCasinoService.getAllGamesAdminStats();
    }

    // Público: Retorna un juego específico
    @Get(':id')
    async getGameById(@Param('id', ParseIntPipe) id: number) {
        return this.juegosCasinoService.getGameById(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    async createGame(@Body() createDto: any) {
        return this.juegosCasinoService.createGame(createDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Put(':id')
    async updateGame(@Param('id', ParseIntPipe) id: number, @Body() updateDto: any) {
        return this.juegosCasinoService.updateGame(id, updateDto);
    }

    @UseGuards(AuthGuard('jwt'))
    @Delete(':id')
    async deleteGame(@Param('id', ParseIntPipe) id: number) {
        return this.juegosCasinoService.deleteGame(id);
    }
}
