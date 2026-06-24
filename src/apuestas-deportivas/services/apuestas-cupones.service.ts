import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class ApuestasCuponesService {
  private readonly logger = new Logger(ApuestasCuponesService.name);
  private readonly dataDir: string;
  private readonly cuponesFile: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), '.data');
    this.cuponesFile = path.join(this.dataDir, 'cupones_compartidos.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.cuponesFile)) {
      fs.writeFileSync(this.cuponesFile, JSON.stringify({}), 'utf-8');
    }
  }

  async compartirCupon(selecciones: any[]): Promise<{ codigo: string }> {
    if (!selecciones || selecciones.length === 0) {
      throw new BadRequestException('El cupón debe tener al menos una selección');
    }

    const codigo = crypto.randomBytes(3).toString('hex').toUpperCase();

    try {
      const data = fs.readFileSync(this.cuponesFile, 'utf-8');
      const cupones = JSON.parse(data);

      cupones[codigo] = {
        fecha: new Date().toISOString(),
        selecciones,
      };

      fs.writeFileSync(this.cuponesFile, JSON.stringify(cupones, null, 2), 'utf-8');
      this.logger.log(`Cupón compartido generado: ${codigo}`);
      return { codigo };
    } catch (error) {
      this.logger.error(`Error al guardar el cupón compartido: ${error.message}`);
      throw new BadRequestException('No se pudo generar el código del cupón');
    }
  }

  async obtenerCupon(codigo: string): Promise<any[]> {
    if (!codigo) {
      throw new BadRequestException('Debe proporcionar un código de cupón');
    }

    const codigoUpper = codigo.toUpperCase();

    try {
      const data = fs.readFileSync(this.cuponesFile, 'utf-8');
      const cupones = JSON.parse(data);

      const cupon = cupones[codigoUpper];
      if (!cupon) {
        throw new NotFoundException('Cupón no encontrado o expirado');
      }

      this.logger.log(`Cupón cargado exitosamente: ${codigoUpper}`);
      return cupon.selecciones;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error al leer el cupón compartido: ${error.message}`);
      throw new BadRequestException('Error al cargar el cupón');
    }
  }
}
