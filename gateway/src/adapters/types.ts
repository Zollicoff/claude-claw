export interface Message {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    platform: string;
  };
  channelId: string;
  platform: string;
  timestamp: Date;
  replyTo?: string;
  attachments?: Array<{
    url: string;
    type: string;
    name: string;
  }>;
}

export type MessageHandler = (message: Message) => Promise<void>;

export interface ChannelAdapter {
  readonly name: string;
  connect(config: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(channelId: string, content: string): Promise<void>;
  onMessage(handler: MessageHandler): void;
  getChannels(): Promise<Array<{ id: string; name: string; platform: string }>>;
}
