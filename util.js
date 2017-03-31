var mailer = require('nodemailer');
var config = require('./util.json');

function mailto(message, cb) {
    var transporter = mailer.createTransport({
        host: 'smtp.qiye.163.com',
        port: 25,
        auth: {
            user: config.user,
            pass: config.pass
        },
        authMethod: 'PLAIN'
    });
    var mailOptions = {
        from: config.from,
        to: config.to,
        subject: message + ' ✔',
        text: message + ' ✔',
        html: '<b>' + message + ' ✔</b>'
    };
    transporter.sendMail(mailOptions, cb);
}

function getFullDate() {
    var now = new Date(),
        year = now.getFullYear(),
        month = now.getMonth()+1,
        date = now.getDate();
    return  year + '-' + (month < 10 ? '0'+month : month)
                 + '-' + (date < 10 ? '0'+date : date);
}

module.exports = {mailto, getFullDate};
