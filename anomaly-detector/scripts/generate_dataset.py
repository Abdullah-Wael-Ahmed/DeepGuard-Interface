import pandas as pd
import numpy as np

np.random.seed(42)

# ─── How many samples ─────────────────────────────────────
N_NORMAL = 8000
N_ATTACK  = 500   # ~6% anomalies, realistic ratio

print("[*] Generating normal traffic...")
normal = pd.DataFrame({
    'Flow Duration':                  np.random.normal(50000,  10000, N_NORMAL).clip(0),
    'Total Fwd Packets':              np.random.normal(10,     3,     N_NORMAL).clip(1),
    'Total Backward Packets':         np.random.normal(8,      2,     N_NORMAL).clip(0),
    'Total Length of Fwd Packets':    np.random.normal(5000,   1000,  N_NORMAL).clip(0),
    'Total Length of Bwd Packets':    np.random.normal(8000,   2000,  N_NORMAL).clip(0),
    'Fwd Packet Length Max':          np.random.normal(1400,   200,   N_NORMAL).clip(0),
    'Bwd Packet Length Max':          np.random.normal(1400,   200,   N_NORMAL).clip(0),
    'Flow Bytes/s':                   np.random.normal(2000,   500,   N_NORMAL).clip(0),
    'Flow Packets/s':                 np.random.normal(10,     3,     N_NORMAL).clip(0),
    'Flow IAT Mean':                  np.random.normal(5000,   1000,  N_NORMAL).clip(0),
    'Destination Port':               np.random.choice([80, 443, 22, 53, 8080], N_NORMAL),
    'Label':                          'NORMAL'
})

print("[*] Generating attack traffic...")

# DoS attack — huge flow bytes, very short duration
dos = pd.DataFrame({
    'Flow Duration':                  np.random.normal(500,    100,   150).clip(0),
    'Total Fwd Packets':              np.random.normal(1000,   200,   150).clip(1),
    'Total Backward Packets':         np.random.normal(0,      1,     150).clip(0),
    'Total Length of Fwd Packets':    np.random.normal(150000, 20000, 150).clip(0),
    'Total Length of Bwd Packets':    np.random.normal(0,      10,    150).clip(0),
    'Fwd Packet Length Max':          np.random.normal(1500,   10,    150).clip(0),
    'Bwd Packet Length Max':          np.random.normal(0,      5,     150).clip(0),
    'Flow Bytes/s':                   np.random.normal(500000, 50000, 150).clip(0),
    'Flow Packets/s':                 np.random.normal(2000,   300,   150).clip(0),
    'Flow IAT Mean':                  np.random.normal(50,     10,    150).clip(0),
    'Destination Port':               np.random.choice([80, 443], 150),
    'Label':                          'DoS'
})

# Port scan — many packets, tiny payloads, weird ports
portscan = pd.DataFrame({
    'Flow Duration':                  np.random.normal(100,    20,    150).clip(0),
    'Total Fwd Packets':              np.random.normal(1,      0.1,   150).clip(1),
    'Total Backward Packets':         np.random.normal(0,      0.1,   150).clip(0),
    'Total Length of Fwd Packets':    np.random.normal(40,     5,     150).clip(0),
    'Total Length of Bwd Packets':    np.random.normal(0,      1,     150).clip(0),
    'Fwd Packet Length Max':          np.random.normal(40,     5,     150).clip(0),
    'Bwd Packet Length Max':          np.random.normal(0,      1,     150).clip(0),
    'Flow Bytes/s':                   np.random.normal(400,    50,    150).clip(0),
    'Flow Packets/s':                 np.random.normal(10000,  1000,  150).clip(0),
    'Flow IAT Mean':                  np.random.normal(10,     2,     150).clip(0),
    'Destination Port':               np.random.randint(1, 65535, 150),
    'Label':                          'PortScan'
})

# Brute force — repeated connections, same port
bruteforce = pd.DataFrame({
    'Flow Duration':                  np.random.normal(2000,   500,   100).clip(0),
    'Total Fwd Packets':              np.random.normal(6,      1,     100).clip(1),
    'Total Backward Packets':         np.random.normal(5,      1,     100).clip(0),
    'Total Length of Fwd Packets':    np.random.normal(300,    50,    100).clip(0),
    'Total Length of Bwd Packets':    np.random.normal(200,    50,    100).clip(0),
    'Fwd Packet Length Max':          np.random.normal(100,    20,    100).clip(0),
    'Bwd Packet Length Max':          np.random.normal(80,     20,    100).clip(0),
    'Flow Bytes/s':                   np.random.normal(250,    50,    100).clip(0),
    'Flow Packets/s':                 np.random.normal(5,      1,     100).clip(0),
    'Flow IAT Mean':                  np.random.normal(400,    50,    100).clip(0),
    'Destination Port':               np.random.choice([22, 3389], 100),
    'Label':                          'BruteForce'
})

# ─── Combine and shuffle ──────────────────────────────────
df = pd.concat([normal, dos, portscan, bruteforce], ignore_index=True)
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

# ─── Save ─────────────────────────────────────────────────
df.to_csv('data/dataset.csv', index=False)

print(f"[+] Dataset saved to data/dataset.csv")
print(f"[+] Total rows  : {len(df)}")
print(f"[+] Normal      : {len(normal)}")
print(f"[+] DoS         : {len(dos)}")
print(f"[+] PortScan    : {len(portscan)}")
print(f"[+] BruteForce  : {len(bruteforce)}")
print(f"[+] Columns     : {list(df.columns)}")
