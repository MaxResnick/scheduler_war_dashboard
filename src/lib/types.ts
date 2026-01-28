export type TimeRange = {
  from: string;
  to: string;
};

export type BundleLandingPoint = {
  windowStart: string;
  bundleCount: number;
  totalProfit: number | null;
};

export type TransactionThroughputPoint = {
  windowStart: string;
  transactionCount: number;
};

export type EntryVolumePoint = {
  windowStart: string;
  entryCount: number;
};

export type SlotStatusPoint = {
  windowStart: string;
  status: string;
  slotCount: number;
};

export type BlockMetadataPoint = {
  windowStart: string;
  avgTxPerBlock: number | null;
  avgSuccessTx: number | null;
  avgComputeUnits: number | null;
};

export type DashboardPayload = {
  range: TimeRange;
  bundles: BundleLandingPoint[];
  transactions: TransactionThroughputPoint[];
  entries: EntryVolumePoint[];
  slotStatus: SlotStatusPoint[];
  blockMetadata: BlockMetadataPoint[];
};

export type SlotEntry = {
  index: number;
  time: string;
  executedTransactionCount: number;
  // Number of PoH hashes in this entry (from geyser). Null if unavailable.
  numHashes?: number | null;
};

export type SlotTransaction = {
  index: number;
  time: string;
  isVote: boolean;
  computeUnitsConsumed: number | null;
  computeUnitsRequested?: number | null;
  signature: string;
  feeLamports?: number | null;
  isJitoBundle?: boolean;
  allocatedTipLamports?: number | null;
  rewardLamports?: number | null;
  // Derived locally: timestamp (ms) of the first entry that includes this tx
  firstEntryTimeMs?: number | null;
  // Derived locally: PoH tick association inferred from zero-tx entries
  pohTickNumber?: number | null; // typically 0..63
  pohTickEntryIndex?: number | null; // geyser entry index of the tick
  pohTickTimeMs?: number | null; // timestamp of the tick entry
  staticSignedWritableAccounts?: string[] | null;
  staticSignedReadonlyAccounts?: string[] | null;
  staticUnsignedWritableAccounts?: string[] | null;
  staticUnsignedReadonlyAccounts?: string[] | null;
  computeUnitPrice?: number | null;
  propAmmAccount?: string | null;
  propAmmLabel?: string | null;
  bundleTipPerTotalCu?: number | null;
};

export type SlotMetadata = {
  slot: number;
  leaderValidator: string;
  blockHeight: number;
  totalFee: number;
  firstShredTime: string | null;
  prevSlotFirstShredTime: string | null;
  lastShredTime?: string | null;
};

export type SlotDetail = {
  metadata: SlotMetadata;
  entries: SlotEntry[];
  transactions: SlotTransaction[];
};

export type SlotBundle = {
  bundleId: string;
  validator: string | null;
  landedTipLamports: number;
  landedCu: number | null;
  txSignatures: string[];
  txCount: number;
};

export type PropAmmFirstWin = {
  slot: number;
  validator: string;
  signature: string;
  transactionIndex: number;
  account: string;
  group: string | null;
};

// Axiom routing analysis types - Leader transition analysis
export type SlotData = {
  slot: number;
  validator: string;
  validatorName: string | null;
  validatorType: string;
  axiomTxCount: number;
  totalTxCount: number;
  totalComputeUnits: number;
};

export type LeaderTransition = {
  fromSlot: number;
  fromValidator: string;
  fromValidatorName: string | null;
  fromValidatorType: string;
  fromAxiomTxCount: number;
  fromTotalTxCount: number;
  toSlot: number;
  toValidator: string;
  toValidatorName: string | null;
  toValidatorType: string;
  toAxiomTxCount: number;
  toTotalTxCount: number;
  // 8-slot window around the transition (4 before, 4 after)
  slotSequence: SlotData[];
};

export type TransitionStats = {
  transitionType: string; // e.g., "BAM → Harmonic", "BAM → Jito"
  count: number;
  avgBamAxiomTx: number;
  avgFollowerAxiomTx: number;
  avgBamTotalTx: number;
  avgFollowerTotalTx: number;
  axiomTxRatio: number; // follower axiom / bam axiom (>1 means more axiom in follower)
};

export type AxiomRoutingPayload = {
  range: TimeRange;
  transitions: LeaderTransition[];
  transitionStats: TransitionStats[];
  totalBamSlots: number;
  totalAxiomTxOnBam: number;
  avgAxiomTxPerBamSlot: number;
  avgAxiomTxPerNonBamSlot: number;
};
