export type CardType = 'standard' | 'expedite' | 'blocker' | 'epic';

export interface CardStageEffort {
  analysis: number;
  development: number;
  testing: number;
  [key: string]: number; // Allow extensibility
}

export interface Card {
  id: string;
  title: string;
  description: string;
  type: CardType;
  columnId: string;
  effort: CardStageEffort;
  remainingEffort: CardStageEffort;
  assignedAvatars: string[]; // Avatar IDs
  isBlocked: boolean;
  blockerReason?: string;
  createdAt: number; // Day index (e.g. 1)
  completedAt: number | null; // Day index completed
  startedAt: number | null; // Day index pulled into active columns (Analysis/Dev/Test)
  failedQACount: number;
  history: {
    day: number;
    columnId: string;
  }[];
  isEpic?: boolean;
  parentEpicId?: string;
  childCardIds?: string[];
  epicProgress?: number;
}

export interface Column {
  id: string;
  name: string;
  wipLimit: number | null;
  allowedEffortTypes: (keyof CardStageEffort)[];
}

export interface Avatar {
  id: string;
  name: string;
  color: string; // Hex or HSL color code
  currentRoll: number | null;
  assignedCardId: string | null;
  previousCardId: string | null; // Tracked to calculate context-switching penalty
  spentCapacity: number;
  remainingCapacity: number;
  workedOnCardIdsToday: string[];
}

export interface DailyLog {
  day: number;
  columnWIP: { [columnId: string]: number }; // columnId -> count of cards
  throughput: number; // Cards completed on this day
  cumulativeThroughput: number; // Total cards completed up to this day
  averageCycleTime: number | null; // Average cycle time of completed cards up to this day
  averageLeadTime: number | null; // Average lead time of completed cards up to this day
  wipLimitsActive?: boolean;
  shiftLeftActive?: boolean;
  swarmingActive?: boolean;
  smallerBatchesActive?: boolean;
}

export interface ScenarioDayEvent {
  title: string;
  description: string;
  newCards?: Omit<Card, 'id' | 'remainingEffort' | 'assignedAvatars' | 'isBlocked' | 'createdAt' | 'completedAt' | 'startedAt' | 'failedQACount' | 'history'>[];
  blockCardId?: string; // Auto-block a specific card (or type of card)
  blockedReason?: string;
  capacityChange?: {
    avatarId: string;
    description: string;
    inactive?: boolean; // If developer is out sick
    rollModifier?: number; // e.g. -1 capacity
  }[];
  wipLimits?: { [columnId: string]: number | null };
  pairingAllowed?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  totalDays: number;
  events: { [day: number]: ScenarioDayEvent };
}

export interface GameConfig {
  maxDays: number;
  blockerChance: number;             // e.g. 0.15
  qaFailChanceUnpaired: number;      // e.g. 0.20
  qaFailChancePaired: number;        // e.g. 0.02
  unblockCost: number;               // e.g. 2
  pairingHelpCost: number;           // e.g. 2
}

export interface GameState {
  day: number;
  maxDays: number;
  cards: Card[];
  columns: Column[];
  avatars: Avatar[];
  dailyLogs: DailyLog[];
  activeScenarioId: string;
  pairingAllowed: boolean;
  gamePhase: 'intro' | 'day_start' | 'dice_rolled' | 'work_allocated' | 'day_summary' | 'week_summary' | 'game_over';
  rolledToday: boolean;
  currentDayEvent: ScenarioDayEvent | null;
  eventLogs: string[];
  snapshotAtDayStart?: {
    cards: Card[];
    avatars: Avatar[];
  };
  nextEventId?: string | null;
  wipLimitsActive?: boolean;
  shiftLeftActive?: boolean;
  swarmingActive?: boolean;
  smallerBatchesActive?: boolean;
  config?: GameConfig;
  customEventTitle?: string;
  customEventCount?: number;
}
