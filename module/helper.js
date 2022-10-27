const bcrypt = require('bcrypt');
const { Console } = require('console');
const fs = require('fs');
const moment = require('moment');

// const timeDate = moment(Date()).format('YYYYMMDDHHmmss');
const momentnow = moment().format('YYYY-MM-DD-HHmmss');

function GetTimestamp() {
  const now = new Date();
  return '[' + now.toLocaleString() + ']';
}

const myLogger = new Console({
  stdout: fs.createWriteStream('./logs/info.' + momentnow + '.log'),
  stderr: fs.createWriteStream('./logs/error.' + momentnow + '.log'),
});

async function formatTimeString(date) {
  return new Promise((resolve) => {
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hour = date.getHours();
    let minute = date.getMinutes();
    let second = date.getSeconds();

    if (month < 10) { month = '0' + month.toString(); }
    if (day < 10) { day = '0' + day.toString(); }
    if (hour < 10) { hour = '0' + hour.toString(); }
    if (minute < 10) { minute = '0' + minute.toString(); }
    if (second < 10) { second = '0' + second.toString(); }

    const results = year + '-' + month + '-' + day + ' @' + hour + ':' + minute + ':' + second;
    return resolve(results);
  });
}

async function encryptPassword(password) {
  const saltRounds = 10;
  const encPW = await bcrypt.hash(password, saltRounds);
  return encPW;
}

exports.encryptPassword = encryptPassword;
exports.GetTimestamp = GetTimestamp;
exports.formatTimeString = formatTimeString;
exports.myLogger = myLogger;
