const { DataTypes } = require("sequelize");
const db = require("../util/db");

const CorrelationRule = db.define("CorrelationRule", {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    severity: {
        type: DataTypes.STRING,
        defaultValue: "medium",
        validate: {
            isIn: [["critical", "high", "medium", "low", "info"]]
        }
    },
    // Rule type determines evaluation logic
    ruleType: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [[
                "threshold",          // N events matching condition in X seconds
                "unique_threshold",   // N unique values of a field in X seconds (port scan)
                "sequence",           // Event A followed by Event B within X seconds
                "absence",            // Expected event NOT seen within X seconds
                "spike",              // Sudden rate increase above baseline
            ]]
        }
    },
    // JSON condition config — structure depends on ruleType
    conditions: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
            const v = this.getDataValue("conditions");
            return v ? JSON.parse(v) : {};
        },
        set(v) {
            this.setDataValue("conditions", JSON.stringify(v));
        }
    },
    // Sliding window in seconds
    windowSeconds: {
        type: DataTypes.INTEGER,
        defaultValue: 60
    },
    // What to do when rule matches
    actions: {
        type: DataTypes.TEXT,
        defaultValue: '["create_incident"]',
        get() {
            const v = this.getDataValue("actions");
            return v ? JSON.parse(v) : ["create_incident"];
        },
        set(v) {
            this.setDataValue("actions", JSON.stringify(v));
        }
    },
    // Track match count
    matchCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastMatchAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Category for organization
    category: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            isIn: [["brute_force", "port_scan", "ddos", "data_exfil", "lateral_movement", "c2", "malware", "policy", "custom"]]
        }
    },
    // Cooldown to prevent duplicate incidents (seconds)
    cooldownSeconds: {
        type: DataTypes.INTEGER,
        defaultValue: 300
    }
});

module.exports = CorrelationRule;
