const { DataTypes } = require("sequelize");
const db = require("../util/db");

const Incident = db.define("Incident", {
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "open",
        allowNull: false,
        validate: {
            isIn: [["open", "triaging", "investigating", "containing", "remediated", "closed"]]
        }
    },
    severity: {
        type: DataTypes.STRING,
        defaultValue: "medium",
        allowNull: false,
        validate: {
            isIn: [["critical", "high", "medium", "low", "info"]]
        }
    },
    priority: {
        type: DataTypes.STRING,
        defaultValue: "P3",
        allowNull: false,
        validate: {
            isIn: [["P1", "P2", "P3", "P4"]]
        }
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isIn: [["malware", "phishing", "brute_force", "ddos", "port_scan", "data_exfil", "lateral_movement", "c2", "insider_threat", "policy_violation", "other"]]
        }
    },
    assignee: {
        type: DataTypes.STRING,
        allowNull: true
    },
    assigneeId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    source: {
        type: DataTypes.STRING,
        defaultValue: "manual",
        validate: {
            isIn: [["manual", "suricata", "zeek", "anomaly_detector", "correlation", "playbook"]]
        }
    },
    sourceRef: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tags: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue("tags");
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue("tags", value ? JSON.stringify(value) : "[]");
        }
    },
    slaDeadline: {
        type: DataTypes.DATE,
        allowNull: true
    },
    resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    closedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    tlp: {
        type: DataTypes.STRING,
        defaultValue: "amber",
        validate: {
            isIn: [["white", "green", "amber", "red"]]
        }
    }
});

module.exports = Incident;
