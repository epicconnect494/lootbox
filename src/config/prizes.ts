import { Prize, PrizeTier } from '../models/types';

// ─── Game Constants ────────────────────────────────────────────────────────
export const ENTRY_COST = 2.00;
export const TARGET_RTP = 0.94;
export const TARGET_EV = ENTRY_COST * TARGET_RTP; // $1.88
export const SELLBACK_RATE = 0.90;
export const COMMISSION_RATE = 1 - SELLBACK_RATE; // 0.10

// ─── Prize Definitions ─────────────────────────────────────────────────────
// 15 prizes across 4 tiers. Prize #15 weight is set to -1 (auto-calibrated
// by the paytable engine to hit exactly 94% RTP).
export const PRIZES: Prize[] = [
  // ── High Tier (Prizes 1-3): Rare, high-value gift cards ──
  {
    id: 1,
    name: '$50 Amazon Gift Card',
    value: 50.00,
    tier: PrizeTier.HIGH,
    imageSlug: 'amazon-50',
    weight: 1,
  },
  {
    id: 2,
    name: '$25 Steam Gift Card',
    value: 25.00,
    tier: PrizeTier.HIGH,
    imageSlug: 'steam-25',
    weight: 2,
  },
  {
    id: 3,
    name: '$15 Netflix Gift Card',
    value: 15.00,
    tier: PrizeTier.HIGH,
    imageSlug: 'netflix-15',
    weight: 3.5,
  },

  // ── Medium Tier (Prizes 4-6): Mid-range gift cards ──
  {
    id: 4,
    name: '$10 Spotify Gift Card',
    value: 10.00,
    tier: PrizeTier.MEDIUM,
    imageSlug: 'spotify-10',
    weight: 5,
  },
  {
    id: 5,
    name: '$7 iTunes Gift Card',
    value: 7.00,
    tier: PrizeTier.MEDIUM,
    imageSlug: 'itunes-7',
    weight: 7,
  },
  {
    id: 6,
    name: '$5 Starbucks Gift Card',
    value: 5.00,
    tier: PrizeTier.MEDIUM,
    imageSlug: 'starbucks-5',
    weight: 10,
  },

  // ── Average Tier (Prizes 7-12): Common rewards ──
  {
    id: 7,
    name: '$3.50 DoorDash Credit',
    value: 3.50,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'doordash-350',
    weight: 15,
  },
  {
    id: 8,
    name: '$3 Uber Eats Credit',
    value: 3.00,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'ubereats-300',
    weight: 18,
  },
  {
    id: 9,
    name: '$2.50 Google Play Credit',
    value: 2.50,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'googleplay-250',
    weight: 22,
  },
  {
    id: 10,
    name: '$2 App Store Credit',
    value: 2.00,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'appstore-200',
    weight: 28,
  },
  {
    id: 11,
    name: '$1.50 Game Currency Pack',
    value: 1.50,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'gamecurrency-150',
    weight: 35,
  },
  {
    id: 12,
    name: '$1 Bonus Credit',
    value: 1.00,
    tier: PrizeTier.AVERAGE,
    imageSlug: 'bonus-100',
    weight: 42,
  },

  // ── Low Tier (Prizes 13-15): Frequent small tokens ──
  {
    id: 13,
    name: '$0.50 Small Token',
    value: 0.50,
    tier: PrizeTier.LOW,
    imageSlug: 'token-050',
    weight: 50,
  },
  {
    id: 14,
    name: '$0.25 Micro Token',
    value: 0.25,
    tier: PrizeTier.LOW,
    imageSlug: 'token-025',
    weight: 55,
  },
  {
    id: 15,
    name: '$0.10 Consolation Token',
    value: 0.10,
    tier: PrizeTier.LOW,
    imageSlug: 'token-010',
    weight: -1, // Auto-calibrated by paytable engine
  },
];
