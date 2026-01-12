const { DataTypes } = require("sequelize");
const db = require("../util/db");

const ZeekDNS = db.define("zeek_dns", {
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
        type: DataTypes.STRING,
        allowNull: false,
    },
    id_orig_p: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    query: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    qtype_name: {
        type: DataTypes.STRING, // A, AAAA, PTR
        allowNull: true,
    },
    rcode_name: {
        type: DataTypes.STRING, // NOERROR, NXDOMAIN
        allowNull: true,
    },
});

module.exports = ZeekDNS;
