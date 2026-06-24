// src/auth/entities/usuario.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nombre_usuario', unique: true })
  nombreUsuario: string;

  @Column({ unique: true })
  correo: string;

  @Column({ name: 'contrasena_hash' })
  contrasenaHash: string;

  @Column({ nullable: true })
  nombre?: string;

  @Column({ name: 'apellido1', nullable: true })
  apellido1?: string;

  @Column({ name: 'apellido2', nullable: true })
  apellido2?: string;

  @Column({ unique: true, nullable: true })
  ci?: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: string;

  @Column({ name: 'pais_codigo', length: 2, default: 'BO' })
  paisCodigo: string;

  @Column({ nullable: true })
  telefono?: string;

  @Column({ name: 'foto_perfil_url', nullable: true })
  fotoPerfilUrl?: string;

  @Column({ default: false })
  verificado: boolean;

  @Column({ default: true })
  habilitado: boolean;

  @Column({ name: 'rol_id', default: 2 })
  rolId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  saldo: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
