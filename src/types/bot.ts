export type BotMessage = { id: string; role: 'user' | 'assistant'; text: string };

export type BotFeedbackState = Record<string, 'like' | 'dislike'>;

export type BotProgressStep = {
  id: string;
  label: string;
  detail?: string;
  status?: 'pending' | 'completed' | 'warning';
};
