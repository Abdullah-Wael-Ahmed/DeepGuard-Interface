const { DataTypes } = require("sequelize");
const db = require("../util/db");

const ZeekConnection = db.define("zeek_connection", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  uid: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  id_orig_h: {
    type: DataTypes.STRING, // Source IP
    allowNull: false,
  },
  id_orig_p: {
    type: DataTypes.INTEGER, // Source Port
    allowNull: false,
  },
  id_resp_h: {
    type: DataTypes.STRING, // Destination IP
    allowNull: false,
  },
  id_resp_p: {
    type: DataTypes.INTEGER, // Destination Port
    allowNull: false,
  },
  proto: {
    type: DataTypes.STRING, // tcp, udp, etc.
    allowNull: true,
  },
  service: {
    type: DataTypes.STRING, // http, dns, etc.
    allowNull: true,
  },
  duration: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  orig_bytes: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  resp_bytes: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  conn_state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = ZeekConnection;
