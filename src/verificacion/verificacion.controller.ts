import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { VerificacionService } from './verificacion.service';

@Controller('verificacion')
@UseGuards(AuthGuard('jwt'))
export class VerificacionController {
  constructor(private readonly verificacionService: VerificacionService) {}

  
 
   // Obtiene el estado actual de verificación del usuario
   
  @Get('estado')
  async getEstado(@Request() req) {
    console.log('--- GET ESTADO ---');
    console.log('req.user:', req.user);

    // Extraer userId asegurándose de que no sea undefined
    const userId = req.user.userId || req.user.sub || req.user.id;

    if (!userId) {
      throw new BadRequestException(
        'No se pudo identificar el usuario desde el token',
      );
    }

    return this.verificacionService.getEstado(userId);
  }


   //Sube las fotos de anverso y reverso del documento

  @Post('subir')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'anverso', maxCount: 1 },
      { name: 'reverso', maxCount: 1 },
    ]),
  )
  async subirDocumentos(
    @Request() req,
    @UploadedFiles()
    files: { anverso?: Express.Multer.File[]; reverso?: Express.Multer.File[] },
  ) {
    console.log('--- POST SUBIR ---');
    console.log('req.user:', req.user);

    const userId = req.user.userId || req.user.sub || req.user.id;

    if (!userId) {
      throw new BadRequestException(
        'No se pudo identificar el usuario desde el token',
      );
    }

    if (
      !files ||
      !files.anverso ||
      !files.anverso[0] ||
      !files.reverso ||
      !files.reverso[0]
    ) {
      throw new BadRequestException(
        'Debe proporcionar las imágenes del anverso y reverso del documento.',
      );
    }

    const anverso = files.anverso[0];
    const reverso = files.reverso[0];

    // Validar tipo de archivo (solo imágenes)
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'image/webp',
    ];
    if (
      !allowedMimeTypes.includes(anverso.mimetype) ||
      !allowedMimeTypes.includes(reverso.mimetype)
    ) {
      throw new BadRequestException(
        'Solo se permiten imágenes (JPEG, PNG, WEBP).',
      );
    }

    // Validar tamaño (máximo 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (anverso.size > maxSize || reverso.size > maxSize) {
      throw new BadRequestException('Las imágenes no deben superar los 2MB.');
    }

    return this.verificacionService.subirDocumentos(userId, anverso, reverso);
  }
}
