import type { OperationalReadModule } from '../utils/botOperationalRead';

export type BotInvoicePdf = { id: number; numeroFactura: string; date?: string; client?: string; total?: number };
export type BotCatalogList = {
  kind: OperationalReadModule;
  rows: Array<{ name: string; detail?: string }>;
  inicio?: number;
  siguiente?: number;
};

export type BotMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: number;
  invoicePdfs?: BotInvoicePdf[];
  emittedInvoiceNumber?: string;
  awaitingInvoicePdfNumber?: boolean;
  catalogList?: BotCatalogList;
};

export type BotFeedbackState = Record<string, 'like' | 'dislike'>;

export type BotProgressStep = {
  id: string;
  label: string;
  detail?: string;
  status?: 'pending' | 'completed' | 'warning';
};
