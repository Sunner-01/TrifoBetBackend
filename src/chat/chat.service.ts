import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ChatService {
  private supabase;
  private readonly logger = new Logger(ChatService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async saveMessage(
    userId: number,
    username: string,
    message: string,
    replyTo: any = null,
  ) {
    // Primero, obtenemos el avatar del usuario si está disponible
    const { data: usuario } = await this.supabase
      .from('usuario')
      .select('foto_perfil_url')
      .eq('id', userId)
      .single();

    const avatarUrl = usuario?.foto_perfil_url || null;

    // Guardar el mensaje en la base de datos
    const { data, error } = await this.supabase
      .from('chat_messages')
      .insert([
        {
          user_id: userId,
          username: username,
          avatar_url: avatarUrl,
          message: message,
          reply_to: replyTo,
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error(`Error saving message: ${error.message}`);
      throw error;
    }

    return data;
  }

  async editMessage(messageId: number, userId: number, newText: string) {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .update({ message: newText, is_edited: true })
      .eq('id', messageId)
      .eq('user_id', userId) // Asegurarse de que el usuario es el dueño
      .select()
      .single();

    if (error) {
      this.logger.error(`Error editing message: ${error.message}`);
      throw error;
    }

    return data;
  }

  async reactMessage(messageId: number, userId: number, reaction: string) {
    // Obtener las reacciones actuales
    const { data: msg } = await this.supabase
      .from('chat_messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    if (!msg) return null;

    const currentReactions = msg.reactions || {};

    if (!currentReactions[reaction]) {
      currentReactions[reaction] = [];
    }

    const userIndex = currentReactions[reaction].indexOf(userId);
    if (userIndex > -1) {
      currentReactions[reaction].splice(userIndex, 1);
      if (currentReactions[reaction].length === 0) {
        delete currentReactions[reaction];
      }
    } else {
      currentReactions[reaction].push(userId);
    }

    const { data, error } = await this.supabase
      .from('chat_messages')
      .update({ reactions: currentReactions })
      .eq('id', messageId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Error reacting to message: ${error.message}`);
      throw error;
    }

    return data;
  }

  async getRecentMessages(limit: number = 50) {
    const { data, error } = await this.supabase
      .from('chat_messages')
      .select('*, usuario:user_id(foto_perfil_url)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Error fetching recent messages: ${error.message}`);
      return [];
    }

    // Actualizamos el avatar_url con el más reciente de la tabla usuario
    const mappedData = data.map((msg) => ({
      ...msg,
      avatar_url: msg.usuario?.foto_perfil_url || msg.avatar_url,
      usuario: undefined, // Removemos la relación anidada para mantener la estructura original
    }));

    // Los obtenemos descendentes por fecha, pero para el chat es mejor enviarlos cronológicamente (más viejos primero)
    return mappedData.reverse();
  }
}
