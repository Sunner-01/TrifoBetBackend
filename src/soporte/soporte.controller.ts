import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { SoporteService } from './soporte.service';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';

@Controller('soporte')
export class SoporteController {
  constructor(private readonly soporteService: SoporteService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('ticket')
  async createTicket(@Req() req, @Body() body: { asunto: string; categoria: string }) {
    return this.soporteService.createTicket(req.user.userId, body.asunto, body.categoria);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mis-tickets')
  async getUserTickets(@Req() req) {
    return this.soporteService.getUserTickets(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('ticket/:id/mensajes')
  async getTicketMessages(@Param('id') id: string) {
    return this.soporteService.getTicketMessages(parseInt(id));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/tickets')
  async getAllTickets() {
    return this.soporteService.getAllTickets();
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('admin/ticket/:id')
  async updateTicketStatus(@Param('id') id: string, @Body() body: { estado: string }) {
    return this.soporteService.updateTicketStatus(parseInt(id), body.estado);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'soporte_chat' },
        (error, result) => {
          if (error) return reject(new BadRequestException('Error uploading to Cloudinary'));
          if (!result) return reject(new BadRequestException('No result from Cloudinary'));
          resolve({ url: result.secure_url });
        }
      ).end(file.buffer);
    });
  }
}
