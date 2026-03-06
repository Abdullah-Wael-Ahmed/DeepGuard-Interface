import pandas as pd
import numpy as np

np.random.seed(42)

records = []

# ── Normal HTTPS (port 443) ─────────────────────────────────
n = 3000
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(1, 60, n),
    'Total Fwd Packets':           np.random.randint(5, 50, n).astype(float),
    'Total Backward Packets':      np.random.randint(5, 50, n).astype(float),
    'Total Length of Fwd Packets': np.random.randint(1000, 15000, n).astype(float),
    'Total Length of Bwd Packets': np.random.randint(1000, 20000, n).astype(float),
    'Fwd Packet Length Max':       np.random.randint(100, 1400, n).astype(float),
    'Bwd Packet Length Max':       np.random.randint(100, 1400, n).astype(float),
    'Flow Bytes/s':                np.random.uniform(100, 2000, n),
    'Flow Packets/s':              np.random.uniform(0.5, 10, n),
    'Flow IAT Mean':               np.random.uniform(100000, 2000000, n),
    'Destination Port':            443,
    'Label':                       'NORMAL'
}))

# ── Normal DNS (port 53) ────────────────────────────────────
n = 2000
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(0.01, 2, n),
    'Total Fwd Packets':           np.random.randint(1, 4, n).astype(float),
    'Total Backward Packets':      np.random.randint(1, 4, n).astype(float),
    'Total Length of Fwd Packets': np.random.randint(30, 200, n).astype(float),
    'Total Length of Bwd Packets': np.random.randint(50, 300, n).astype(float),
    'Fwd Packet Length Max':       np.random.randint(40, 120, n).astype(float),
    'Bwd Packet Length Max':       np.random.randint(60, 180, n).astype(float),
    'Flow Bytes/s':                np.random.uniform(50, 5000, n),
    'Flow Packets/s':              np.random.uniform(1, 20, n),
    'Flow IAT Mean':               np.random.uniform(10000, 500000, n),
    'Destination Port':            53,
    'Label':                       'NORMAL'
}))

# ── Normal HTTP (port 80) ───────────────────────────────────
n = 1000
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(0.5, 30, n),
    'Total Fwd Packets':           np.random.randint(3, 30, n).astype(float),
    'Total Backward Packets':      np.random.randint(3, 30, n).astype(float),
    'Total Length of Fwd Packets': np.random.randint(500, 10000, n).astype(float),
    'Total Length of Bwd Packets': np.random.randint(500, 50000, n).astype(float),
    'Fwd Packet Length Max':       np.random.randint(100, 1400, n).astype(float),
    'Bwd Packet Length Max':       np.random.randint(100, 1400, n).astype(float),
    'Flow Bytes/s':                np.random.uniform(200, 5000, n),
    'Flow Packets/s':              np.random.uniform(1, 15, n),
    'Flow IAT Mean':               np.random.uniform(50000, 1000000, n),
    'Destination Port':            80,
    'Label':                       'NORMAL'
}))

# ── DoS Attack ──────────────────────────────────────────────
n = 500
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(0.001, 2, n),
    'Total Fwd Packets':           np.random.randint(500, 5000, n).astype(float),
    'Total Backward Packets':      np.zeros(n),
    'Total Length of Fwd Packets': np.random.randint(20000, 200000, n).astype(float),
    'Total Length of Bwd Packets': np.zeros(n),
    'Fwd Packet Length Max':       np.random.randint(40, 60, n).astype(float),
    'Bwd Packet Length Max':       np.zeros(n),
    'Flow Bytes/s':                np.random.uniform(100000, 1000000, n),
    'Flow Packets/s':              np.random.uniform(1000, 10000, n),
    'Flow IAT Mean':               np.random.uniform(10, 500, n),
    'Destination Port':            np.random.choice([80, 443, 22], n).astype(float),
    'Label':                       'DoS'
}))

# ── Port Scan ───────────────────────────────────────────────
n = 300
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(0.0001, 0.5, n),
    'Total Fwd Packets':           np.ones(n),
    'Total Backward Packets':      np.zeros(n),
    'Total Length of Fwd Packets': np.random.randint(40, 80, n).astype(float),
    'Total Length of Bwd Packets': np.zeros(n),
    'Fwd Packet Length Max':       np.random.randint(40, 80, n).astype(float),
    'Bwd Packet Length Max':       np.zeros(n),
    'Flow Bytes/s':                np.random.uniform(100, 5000, n),
    'Flow Packets/s':              np.random.uniform(2, 100, n),
    'Flow IAT Mean':               np.random.uniform(100, 10000, n),
    'Destination Port':            np.random.randint(1, 65535, n).astype(float),
    'Label':                       'PortScan'
}))

# ── Brute Force ─────────────────────────────────────────────
n = 200
records.append(pd.DataFrame({
    'Flow Duration':               np.random.uniform(0.5, 5, n),
    'Total Fwd Packets':           np.random.randint(4, 10, n).astype(float),
    'Total Backward Packets':      np.random.randint(3, 8, n).astype(float),
    'Total Length of Fwd Packets': np.random.randint(100, 500, n).astype(float),
    'Total Length of Bwd Packets': np.random.randint(100, 400, n).astype(float),
    'Fwd Packet Length Max':       np.random.randint(50, 150, n).astype(float),
    'Bwd Packet Length Max':       np.random.randint(50, 120, n).astype(float),
    'Flow Bytes/s':                np.random.uniform(50, 500, n),
    'Flow Packets/s':              np.random.uniform(2, 10, n),
    'Flow IAT Mean':               np.random.uniform(50000, 500000, n),
    'Destination Port':            np.random.choice([22, 3389, 21], n).astype(float),
    'Label':                       'BruteForce'
}))

df = pd.concat(records, ignore_index=True)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)
df.to_csv('data/dataset.csv', index=False)
print(f"[+] Dataset generated: {len(df)} rows")
print(df['Label'].value_counts())
