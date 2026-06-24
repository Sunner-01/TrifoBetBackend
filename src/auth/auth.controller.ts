// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto) {
    const identifier = loginDto.correo || loginDto.nombreUsuario;

    if (!identifier) {
      throw new Error('Debe proporcionar correo o nombreUsuario');
    }

    return this.authService.login(identifier, loginDto.contrasena);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req) {
    return req.user;
  }
}
