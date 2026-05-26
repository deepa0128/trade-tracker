import { z } from 'zod';

export const CreatePortfolioDTO = z.object({
  name: z.string().min(1).max(100),
  exchange: z.enum(['NSE', 'BSE', 'NSE_BSE']),
});

export const RecordTransactionDTO = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('BUY'),
    ticker: z.string().min(2).max(20),
    shares: z.number().positive(),
    price: z.number().positive(),
    name: z.string().min(1).max(100),
    sector: z.string().min(1).max(50),
    exchange: z.enum(['NSE', 'BSE', 'NSE_BSE']),
    note: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal('SELL'),
    ticker: z.string().min(2).max(20),
    shares: z.number().positive(),
    price: z.number().positive(),
    note: z.string().max(500).optional(),
  }),
]);

export type CreatePortfolioInput = z.infer<typeof CreatePortfolioDTO>;
export type RecordTransactionInput = z.infer<typeof RecordTransactionDTO>;
