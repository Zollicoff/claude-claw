import { Bot } from 'grammy';
import type { ChannelAdapter, Message, MessageHandler } from './types.js';

interface TelegramConfig {
  token: string;
  allowedChats?: string[];
}

export class TelegramAdapter implements ChannelAdapter {
  readonly name = 'telegram';
  private bot: Bot | null = null;
  private handlers: MessageHandler[] = [];
  private allowedChats?: Set<string>;

  async connect(config: Record<string, unknown>): Promise<void> {
    const { token, allowedChats } = config as unknown as TelegramConfig;

    if (allowedChats?.length) {
      this.allowedChats = new Set(allowedChats);
    }

    this.bot = new Bot(token);

    this.bot.on('message:text', async (ctx) => {
      const chatId = String(ctx.chat.id);
      if (this.allowedChats && !this.allowedChats.has(chatId)) return;

      const message: Message = {
        id: String(ctx.message.message_id),
        content: ctx.message.text,
        author: {
          id: String(ctx.from.id),
          name: ctx.from.username || ctx.from.first_name,
          platform: 'telegram',
        },
        channelId: chatId,
        platform: 'telegram',
        timestamp: new Date(ctx.message.date * 1000),
      };

      for (const handler of this.handlers) {
        await handler(message);
      }
    });

    this.bot.start();
    console.log('[telegram] Bot started');
  }

  async disconnect(): Promise<void> {
    this.bot?.stop();
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    if (!this.bot) throw new Error('Telegram bot not connected');

    // Telegram has a 4096 character limit
    const maxLen = 4096;
    if (content.length <= maxLen) {
      await this.bot.api.sendMessage(channelId, content);
      return;
    }

    let remaining = content;
    while (remaining.length > 0) {
      const chunk = remaining.slice(0, maxLen);
      remaining = remaining.slice(maxLen);
      await this.bot.api.sendMessage(channelId, chunk);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async getChannels(): Promise<Array<{ id: string; name: string; platform: string }>> {
    // Telegram doesn't have a "list all chats" API - return known chats from history
    return [];
  }
}
