import {
  ClientProfile,
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
} from '../types/tax';

// Clean slate: All preexisting demo clients and transactions removed
export const DEFAULT_CLIENTS: ClientProfile[] = [];

export const INITIAL_DATA_1701Q: Record<string, Data1701Q> = {};

export const INITIAL_DATA_1702Q: Record<string, Data1702Q> = {};

export const INITIAL_DATA_2550Q: Record<string, Data2550Q> = {};

export const INITIAL_DATA_2551Q: Record<string, Data2551Q> = {};

export const INITIAL_DATA_1601C: Record<string, Data1601C> = {};

export const INITIAL_DATA_1601EQ: Record<string, Data1601EQ> = {};
