const { Sequelize } = require("sequelize");

console.log(process.env.MYSQL_DATABASE,process.env.MYSQL_USER,process.env.MYSQL_PASSWORD)

const db = new Sequelize({
    host: 'db',
    dialect: "mysql",
    logging: false,
    database: process.env.MYSQL_DATABASE,
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD
});

module.exports = db ;
