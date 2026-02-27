import { Client, GatewayIntentBits, Events, type TextChannel } from 'discord.js';
import type { ChannelAdapter, Message, MessageHandler } from './types.js';

interface DiscordConfig {
  token: string;
  allowedChannels?: string[];
}

export class DiscordAdapter implements ChannelAdapter {
  readonly name = 'discord';
  private client: Client;
  private handlers: MessageHandler[] = [];
  private allowedChannels?: Set<string>;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
  }

  async connect(config: Record<string, unknown>): Promise<void> {
    const { token, allowedChannels } = config as unknown as DiscordConfig;

    if (allowedChannels?.length) {
      this.allowedChannels = new Set(allowedChannels);
    }

    this.client.on(Events.ClientReady, (c) => {
      console.log(`[discord] Logged in as ${c.user.tag}`);
    });

    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot) return;
      if (this.allowedChannels && !this.allowedChannels.has(msg.channelId)) return;

      const message: Message = {
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          name: msg.author.username,
          platform: 'discord',
        },
        channelId: msg.channelId,
        platform: 'discord',
        timestamp: msg.createdAt,
      };

      for (const handler of this.handlers) {
        await handler(message);
      }
    });

    await this.client.login(token);
  }

  async disconnect(): Promise<void> {
    this.client.destroy();
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      throw new Error(`Channel ${channelId} is not text-based`);
    }

    // Discord has a 2000 character limit - split long messages
    const maxLen = 2000;
    if (content.length <= maxLen) {
      await (channel as TextChannel).send(content);
      return;
    }

    const chunks: string[] = [];
    let remaining = content;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Try to split at a newline near the limit
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen / 2) splitAt = maxLen;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt);
    }

    for (const chunk of chunks) {
      await (channel as TextChannel).send(chunk);
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async getChannels(): Promise<Array<{ id: string; name: string; platform: string }>> {
    const result: Array<{ id: string; name: string; platform: string }> = [];
    const guilds = this.client.guilds.cache;
    for (const [, guild] of guilds) {
      const channels = guild.channels.cache.filter((c) => c.isTextBased());
      for (const [, channel] of channels) {
        result.push({ id: channel.id, name: channel.name, platform: 'discord' });
      }
    }
    return result;
  }
}
