import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RetirosService } from './retiros.service';

@Controller('retiros')
@UseGuards(AuthGuard('jwt'))
export class RetirosController {
  constructor(private readonly retirosService: RetirosService) {}

  // --- MÉTODOS DE USUARIO ---

  @Post('cuenta')
  @UseInterceptors(
    FileInterceptor('qr_image', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('Solo imágenes para QR'), false);
        }
        cb(null, true);
      },
    }),
  )
  async addAccount(
    @CurrentUser() user: any,
    @Body() dto: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.retirosService.addAccount(userId, dto, file);
  }

  @Get('cuenta/mis-cuentas')
  async getMyAccounts(@CurrentUser() user: any) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.retirosService.getMyAccounts(userId);
  }

  @Post('solicitar')
  async requestWithdrawal(@CurrentUser() user: any, @Body() dto: { cuenta_retiro_id: number; monto: number }) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.retirosService.requestWithdrawal(userId, dto);
  }

  @Put('usuario/cancelar/:id')
  async cancelWithdrawal(
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const userId = user?.userId || user?.sub || user?.id;
    return this.retirosService.cancelWithdrawal(+id, userId);
  }

  // --- MÉTODOS DE ADMINISTRADOR ---

  @Get('admin/cuentas')
  async getAllAccounts(
    @Query('estado') estado?: string,
    @Query('billetera') billetera?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const lim = limit ? parseInt(limit, 10) : 20;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.retirosService.getAllAccounts(estado, billetera, lim, off);
  }

  @Put('admin/cuentas/:id')
  async processAccount(@Param('id') id: string, @Body('estado') estado: 'aprobada' | 'rechazada') {
    return this.retirosService.processAccount(+id, estado);
  }

  @Get('admin/solicitudes')
  async getPendingWithdrawals(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const lim = limit ? parseInt(limit, 10) : 20;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.retirosService.getPendingWithdrawals(lim, off);
  }

  @Put('admin/procesar/:id')
  @UseInterceptors(
    FileInterceptor('comprobante', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('Solo imágenes para comprobante'), false);
        }
        cb(null, true);
      },
    }),
  )
  async processWithdrawal(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    const adminId = user?.userId || user?.sub || user?.id;
    return this.retirosService.processWithdrawal(+id, adminId, file);
  }

  @Put('admin/rechazar/:id')
  async rejectWithdrawal(
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const adminId = user?.userId || user?.sub || user?.id;
    return this.retirosService.rejectWithdrawal(+id, adminId);
  }
}
