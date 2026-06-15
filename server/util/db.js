const { Sequelize } = require("sequelize");

const db = new Sequelize({
    host: 'db',
    dialect: "mysql",
    logging: false,
    database: process.env.MYSQL_DATABASE,
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

module.exports = db ;
