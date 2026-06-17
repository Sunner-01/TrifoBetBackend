// src/perfil/perfil.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PerfilService } from './perfil.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('perfil')
@UseGuards(AuthGuard('jwt'))
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) { }

  @Get('me')
  getProfile(@CurrentUser() user: any) {
    const userId = user?.userId || user?.sub || user?.id;
    if (!userId) throw new BadRequestException('Usuario no identificado en el token');
    return this.perfilService.getProfile(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.perfilService.updateProfile(userId, dto);
  }

  @Patch('me/photo')
  @UseInterceptors(
    FileInterceptor('foto', {
      limits: { fileSize: 2 * 1024 * 1024 }, // Límite de 2MB
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('Solo imágenes'), false);
        }
        cb(null, true);
      },
    }),
  )
  updatePhoto(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Falta la foto');
    const userId = user?.userId || user?.sub || user?.id;
    return this.perfilService.updateProfilePhoto(userId, file);
  }

  @Delete('me/photo')
  deletePhoto(@CurrentUser() user: any) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.perfilService.deleteProfilePhoto(userId);
  }
}