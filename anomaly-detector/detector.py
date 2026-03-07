import os
import sqlite3
import joblib
import pandas as pd
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)

MODEL_PATH = 'model/isolation_forest.pkl'
DB_PATH    = 'data/anomaly_results.db'

FEATURES = [
    'Flow Duration',
    'Total Fwd Packets',
    'Total Backward Packets',
    'Total Length of Fwd Packets',
    'Total Length of Bwd Packets',
    'Fwd Packet Length Max',
    'Bwd Packet Length Max',
    'Flow Bytes/s',
    'Flow Packets/s',
    'Flow IAT Mean',
    'Destination Port',
]

# ─── Load model ───────────────────────────────────────────
if not os.path.exists(MODEL_PATH):
    print("[!] No trained model found. Run train.py first.")
    exit(1)

model = joblib.load(MODEL_PATH)
print("[+] Model loaded successfully.")

# ─── Setup database ───────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS anomaly_results (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp     TEXT NOT NULL,
            src_ip        TEXT,
            dest_port     INTEGER,
            anomaly_score REAL,
            is_anomaly    INTEGER,
            severity      TEXT
        )
    ''')
    conn.commit()
    conn.close()
    print("[+] Database ready.")

init_db()

# ─── Save result ──────────────────────────────────────────
def save_result(src_ip, dest_port, score, is_anomaly, severity):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO anomaly_results
        (timestamp, src_ip, dest_port, anomaly_score, is_anomaly, severity)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        datetime.now().isoformat(),
        src_ip,
        int(dest_port),
        round(float(score), 4),
        int(is_anomaly),
        severity
    ))
    conn.commit()
    conn.close()

# ─── Severity helper ──────────────────────────────────────
def get_severity(score):
    if score < -0.5:   return 'HIGH'
    elif score < -0.43: return 'MEDIUM'
    else:              return 'LOW'

# ─── Health check ─────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'loaded'})

# ─── Analyze endpoint ─────────────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        event = request.json

        features = pd.DataFrame([{
            'Flow Duration':               float(event.get('Flow Duration', 0)),
            'Total Fwd Packets':           float(event.get('Total Fwd Packets', 0)),
            'Total Backward Packets':      float(event.get('Total Backward Packets', 0)),
            'Total Length of Fwd Packets': float(event.get('Total Length of Fwd Packets', 0)),
            'Total Length of Bwd Packets': float(event.get('Total Length of Bwd Packets', 0)),
            'Fwd Packet Length Max':       float(event.get('Fwd Packet Length Max', 0)),
            'Bwd Packet Length Max':       float(event.get('Bwd Packet Length Max', 0)),
            'Flow Bytes/s':                float(event.get('Flow Bytes/s', 0)),
            'Flow Packets/s':              float(event.get('Flow Packets/s', 0)),
            'Flow IAT Mean':               float(event.get('Flow IAT Mean', 0)),
            'Destination Port':            float(event.get('Destination Port', 0)),
        }])

        prediction = model.predict(features)
        score      = model.score_samples(features)
        is_anomaly = bool(score[0] < -0.5)
        severity   = get_severity(score[0])
        src_ip     = event.get('src_ip', 'unknown')
        dest_port  = event.get('Destination Port', 0)

        # Save every result to database
        save_result(src_ip, dest_port, score[0], is_anomaly, severity)

        return jsonify({
            'is_anomaly':    is_anomaly,
            'anomaly_score': round(float(score[0]), 4),
            'severity':      severity,
            'src_ip':        src_ip,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ─── Get all results from DB (for dashboard) ──────────────
@app.route('/results', methods=['GET'])
def results():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, src_ip, dest_port,
                   anomaly_score, is_anomaly, severity
            FROM anomaly_results
            ORDER BY timestamp DESC
            LIMIT 100
        ''')
        rows = cursor.fetchall()
        conn.close()

        data = [{
            'timestamp':     r[0],
            'src_ip':        r[1],
            'dest_port':     r[2],
            'anomaly_score': r[3],
            'is_anomaly':    bool(r[4]),
            'severity':      r[5]
        } for r in rows]

        return jsonify({'count': len(data), 'results': data})

    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ─── Stats endpoint (for dashboard graphs) ────────────────
@app.route('/stats', methods=['GET'])
def stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM anomaly_results')
        total = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM anomaly_results WHERE is_anomaly = 1')
        total_anomalies = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM anomaly_results WHERE severity = 'HIGH'")
        high = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM anomaly_results WHERE severity = 'MEDIUM'")
        medium = cursor.fetchone()[0]

        conn.close()

        return jsonify({
            'total_events':   total,
            'total_anomalies': total_anomalies,
            'high_severity':  high,
            'medium_severity': medium,
            'normal_events':  total - total_anomalies
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
