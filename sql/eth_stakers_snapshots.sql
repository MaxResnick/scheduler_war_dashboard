CREATE TABLE IF NOT EXISTS default.eth_stakers_snapshots
(
  snapshot_ts DateTime,
  ranking Nullable(UInt32),
  entity String,
  entity_just_name String,
  entity_category String,
  amount_staked Float64,
  amount_staked_broken_down Float64,
  validators Float64,
  marketshare Float64,
  ow_change Float64,
  om_change Float64,
  sm_change Float64,
  earned_rewards Float64,
  last_deposit Nullable(Date),
  last_withdrawal Nullable(Date),
  updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(snapshot_ts)
ORDER BY (snapshot_ts, entity_just_name);
