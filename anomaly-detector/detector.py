"""
DeepGuard — Window-Based Behavioral Anomaly Detector

Receives individual flows at /analyze, buffers them per source IP,
and flushes 30-second windows through an autoencoder to detect
behavioral anomalies (DDoS, port scans, brute-force, etc.).
"""

import os
import json
import sqlite3
import threading
import logging
import numpy as np
import joblib
from datetime import datetime, timezone
from collections import defaultdict

from flask import Flask, request, jsonify
from apscheduler.schedulers.background import BackgroundScheduler

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
from tensorflow import keras

# ─── Configuration ────────────────────────────────────────
MODEL_PATH    = 'model/window_autoencoder.keras'
SCALER_PATH   = 'model/window_scaler.pkl'
METADATA_PATH = 'model/window_metadata.json'
DB_PATH       = 'data/anomaly_results.db'
WINDOW_SECONDS = 30

# ─── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s — %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger('detector')

# ─── Flask app ────────────────────────────────────────────
app = Flask(__name__)

# ─── Load model artifacts ────────────────────────────────
if not os.path.exists(MODEL_PATH):
    log.error("No trained model found at %s.", MODEL_PATH)
    log.error("Please run 'train_window_autoencoder.py' locally OR")
    log.error("train in Google Colab and place the .keras, .pkl, and .json files in the 'model/' directory.")
    exit(1)

model  = keras.models.load_model(MODEL_PATH, compile=False)
scaler = joblib.load(SCALER_PATH)

with open(METADATA_PATH, 'r') as f:
    metadata = json.load(f)

THRESHOLD     = metadata['reconstruction_threshold']
FEATURE_NAMES = metadata['feature_names']

log.info("Model loaded  — threshold=%.6f, features=%d", THRESHOLD, len(FEATURE_NAMES))

# ─── In-memory flow buffers (thread-safe) ─────────────────
_lock   = threading.Lock()
_buffers = defaultdict(list)   # src_ip → [flow_dict, ...]

# ─── Database setup ───────────────────────────────────────
def _get_db():
    """Return a new SQLite connection (one per call for thread-safety)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL')
    return conn


def init_db():
    conn = _get_db()
    conn.execute('''
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
    log.info("Database ready at %s", DB_PATH)


init_db()


# ─── Helpers ──────────────────────────────────────────────
def _severity(error: float) -> str:
    """Graduated severity: LOW 1-2x, MEDIUM 2-10x, HIGH >10x threshold."""
    if error <= THRESHOLD:
        return 'LOW'
    ratio = error / THRESHOLD
    if ratio <= 2.0:
        return 'LOW'
    elif ratio <= 10.0:
        return 'MEDIUM'
    else:
        return 'HIGH'


def _save_result(src_ip: str, dest_port: int, score: float,
                 is_anomaly: bool, severity: str):
    """Insert one window result into the database."""
    try:
        conn = _get_db()
        conn.execute('''
            INSERT INTO anomaly_results
            (timestamp, src_ip, dest_port, anomaly_score, is_anomaly, severity)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.now(timezone.utc).isoformat(),
            src_ip,
            int(dest_port),
            round(float(score), 6),
            int(is_anomaly),
            severity,
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        log.error("DB write error: %s", e)


# ─── Feature aggregation ─────────────────────────────────
def _aggregate(flows: list) -> dict:
    """Compute aggregated features from a list of flow dicts."""
    n = len(flows)
    if n == 0:
        return None

    dst_ports   = [f.get('dst_port', 0)          for f in flows]
    dst_ips     = [f.get('dst_ip', '')            for f in flows]
    conn_states = [f.get('conn_state', 'unknown') for f in flows]
    durations   = [f.get('duration', 0.0)         for f in flows]
    bytes_sent_list = [f.get('bytes_sent', 0) for f in flows]
    bytes_recv_list = [f.get('bytes_received', 0) for f in flows]
    bytes_list  = [s + r for s, r in zip(bytes_sent_list, bytes_recv_list)]
    packets_list = [f.get('total_fwd_packets', 0) + f.get('total_backward_packets', 0) for f in flows]
    protos      = [f.get('protocol', 'unknown') for f in flows]

    bytes_total   = sum(bytes_list)
    packets_total = sum(packets_list)
    syn_count     = sum(1 for s in conn_states if s == 'S0')
    failed_count  = sum(1 for s in conn_states if s != 'SF')
    tcp_count     = sum(1 for p in protos if p == 'tcp')
    inbound_outbound = sum(bytes_recv_list) / max(sum(bytes_sent_list), 1)

    return {
        'conn_count':          float(n),
        'unique_dst_ports':    float(len(set(dst_ports))),
        'unique_dst_ips':      float(len(set(dst_ips))),
        'syn_ratio':           syn_count / n,
        'failed_ratio':        failed_count / n,
        'bytes_total':         float(bytes_total),
        'packets_total':       float(packets_total),
        'avg_duration':        float(np.mean(durations)) if durations else 0.0,
        'connections_per_sec': n / WINDOW_SECONDS,
        'avg_bytes_per_flow':  bytes_total / n if n > 0 else 0.0,
        'tcp_ratio':           float(tcp_count / n),
        'avg_pkt_size':        float(bytes_total / packets_total) if packets_total > 0 else 0.0,
        'inbound_outbound_ratio': float(inbound_outbound),
        'proto_diversity':     float(len(set(protos))),
        # extra (not model input)
        '_most_common_port':   max(set(dst_ports), key=dst_ports.count) if dst_ports else 0,
    }


# ─── Window flush (runs every WINDOW_SECONDS) ────────────
def flush_windows():
    """Score all buffered windows and save results."""
    with _lock:
        snapshot = dict(_buffers)
        _buffers.clear()

    if not snapshot:
        return

    log.info("Flushing %d IP windows...", len(snapshot))

    for src_ip, flows in snapshot.items():
        try:
            agg = _aggregate(flows)
            if agg is None:
                continue

            # Build feature vector in correct order
            feature_vec = np.array(
                [[agg[name] for name in FEATURE_NAMES]],
                dtype=np.float32,
            )

            # Apply log-scaling for heavy-tailed features (matching training)
            log_features = metadata.get('log_features', [])
            for feature in log_features:
                if feature in FEATURE_NAMES:
                    idx = FEATURE_NAMES.index(feature)
                    feature_vec[0, idx] = np.log1p(feature_vec[0, idx])

            # Scale and Predict
            feature_scaled = scaler.transform(feature_vec)
            reconstructed = model.predict(feature_scaled, verbose=0)

            # Reconstruction error (MSE)
            error = float(np.mean(np.square(feature_scaled - reconstructed)))

            is_anomaly = error > THRESHOLD
            severity   = _severity(error)

            log.info(
                "  %-18s  conns=%-4d  ports=%-3d  error=%.6f  %s%s",
                src_ip,
                int(agg['conn_count']),
                int(agg['unique_dst_ports']),
                error,
                severity,
                "  *** ANOMALY ***" if is_anomaly else "",
            )

            _save_result(
                src_ip=src_ip,
                dest_port=int(agg['_most_common_port']),
                score=error,
                is_anomaly=is_anomaly,
                severity=severity,
            )

        except Exception as e:
            log.error("Error scoring window for %s: %s", src_ip, e)


# ─── Background scheduler ────────────────────────────────
scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(flush_windows, 'interval', seconds=WINDOW_SECONDS)
scheduler.start()
log.info("Scheduler started — flushing every %ds", WINDOW_SECONDS)


# ═══════════════════════════════════════════════════════════
#  FLASK ENDPOINTS
# ═══════════════════════════════════════════════════════════

# ─── Health check ─────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model': 'window_autoencoder',
        'threshold': THRESHOLD,
        'window_seconds': WINDOW_SECONDS,
    })


# ─── Analyze (buffer flow) ───────────────────────────────
@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        event = request.json

        src_ip = event.get('src_ip', 'unknown')

        flow = {
            'dst_ip':                event.get('dst_ip', ''),
            'dst_port':              int(event.get('Destination Port', 0)),
            'conn_state':            event.get('conn_state', 'unknown'),
            'duration':              float(event.get('Flow Duration', 0)),
            'bytes_sent':            float(event.get('Total Length of Fwd Packets', 0)),
            'bytes_received':        float(event.get('Total Length of Bwd Packets', 0)),
            'total_fwd_packets':     int(event.get('Total Fwd Packets', 0)),
            'total_backward_packets': int(event.get('Total Backward Packets', 0)),
            'protocol':              str(event.get('protocol', 'unknown')).lower(),
            'timestamp':             datetime.now(timezone.utc).isoformat(),
        }

        with _lock:
            _buffers[src_ip].append(flow)

        return jsonify({'status': 'flow buffered'})

    except Exception as e:
        log.error("/analyze error: %s", e)
        return jsonify({'error': str(e)}), 400


# ─── Results (for dashboard) ─────────────────────────────
@app.route('/results', methods=['GET'])
def results():
    try:
        conn = _get_db()
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
            'severity':      r[5],
        } for r in rows]

        return jsonify({'count': len(data), 'results': data})

    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ─── Stats (for dashboard graphs) ────────────────────────
@app.route('/stats', methods=['GET'])
def stats():
    try:
        conn = _get_db()
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
            'total_events':    total,
            'total_anomalies': total_anomalies,
            'high_severity':   high,
            'medium_severity': medium,
            'normal_events':   total - total_anomalies,
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400


# ─── Run ──────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
