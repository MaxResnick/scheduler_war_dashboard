export const PROP_AMM_GROUPS = ["Humi", "Tess", "Sv2"] as const;
export type PropAmmGroup = (typeof PROP_AMM_GROUPS)[number];

export const PROP_AMM_GROUP_COLORS: Record<PropAmmGroup, string> = {
  Humi: "#38bdf8",
  Tess: "#f472b6",
  Sv2: "#facc15"
};

export type PropAmmAccount = {
  account: string;
  label: string;
  group: PropAmmGroup;
};

export const PROP_AMM_ACCOUNTS: PropAmmAccount[] = [
  {
    account: "9YW7Rc8ongNLedz9YBp5hVYwdEJHuHbQkUf3fZocNkHN",
    label: "Humi SolUSDC #1",
    group: "Humi"
  },
  {
    account: "4KSLE7EU1P7PQ8Rc4hdb2ZKq2JmWHD8UXJp7guEdyT9j",
    label: "Humi SolUSDC #2",
    group: "Humi"
  },
  {
    account: "4dxRtLucVXZ4o9drN5jtCs5X9TJdv79KwPDp4fsVqtqh",
    label: "Humi SolUSDC #3",
    group: "Humi"
  },
  {
    account: "CmmZXMztbTuAyWXJecn96Q5WvcyMYcMK7JcMukJdku8U",
    label: "Humi SolUSDC #4",
    group: "Humi"
  },
  {
    account: "FVnv5qH7dsrBzEDwJ8dN2m9PFtKTBAQFtqWF3M9LpwMg",
    label: "Tess SolUSDC",
    group: "Tess"
  },
  {
    account: "px1rbjiEWwwcq1epXSsTMJERyQy7h4vg4VopqFz2HwH",
    label: "Sv2 SolUSDC",
    group: "Sv2"
  }
];

export const PROP_AMM_ACCOUNT_MAP = new Map(
  PROP_AMM_ACCOUNTS.map((entry) => [entry.account, entry])
);
