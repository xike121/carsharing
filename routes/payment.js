var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var moment = require('moment');
var con = require('../lib/connection.js');
var authentication = require('../lib/authentication');
var crypto = require('crypto');



router.get('/:ad_id', authentication, function(req, res, next) {

    var query = `SELECT @bid_ad_id := ad_id, bid_id, ad_id FROM bid WHERE 
                 ad_id = ${req.params.ad_id} 
                 AND 
                 bid_author_id = ${req.user.user_id} 
                 AND 
                 bid_confirmed = "1";
                 SELECT @author_id := ad_author_id, ad_price FROM ad WHERE ad_id = @bid_ad_id;
                 SELECT user_cardnum AS receiver_cardnum FROM user WHERE user_id = @author_id;
                 SELECT user_telnum AS sender_telnum FROM user WHERE user_id = ${req.user.user_id}`;

    con.query(query, function (err, result) {
        if (err) throw err;

        // если результат пустой, значит зашли на страницу не с акка, у которого подтверждена заявка
        // в таком случае отправляем статус 404
        if (result[0].length === 0){
            res.sendStatus(404);
        }
        else {

            // формируем json для html формы с кнопкой оплаты
            var json = {
                public_key: "sandbox_i91851286730",
                private_key: "sandbox_xRwQvnkqHqN8lwvQA77VVbRd4nfoKJnUcMKHcUcM",
                server_url: `http://${req.get('host')}`,
                action: "p2p",
                version: "3",
                phone: `${result[3][0].sender_telnum}`,
                amount: `${result[1][0].ad_price}`,
                currency: "UAH",
                description: `Оплата по объявлению №${result[0][0].ad_id}, заявка №${result[0][0].bid_id}`,
                order_id: `${result[0][0].bid_id}`,
                receiver_card: `${result[2][0].receiver_cardnum}`
            };

            // получение signature и data
            var private_key = "sandbox_xRwQvnkqHqN8lwvQA77VVbRd4nfoKJnUcMKHcUcM";
            var jsonString = JSON.stringify(json);
            var data = Buffer.from(jsonString).toString('base64');
            var signString = private_key + data + private_key;
            var sha1 = crypto.createHash('sha1');
            sha1.update(signString);
            var signature = sha1.digest('base64');

            var unreadMessagesQuery = `SELECT COUNT(message_unread) AS amount_unread FROM message WHERE
                                       message_unread = 1
                                       AND
                                       message_recipient_id = ${req.user.user_id};`;
            con.query(unreadMessagesQuery, function (err, amountUnread) {
                res.render('payment', {
                    result: result,
                    data: data,
                    signature: signature,
                    currentUser: req.user.user_id,
                    currentRole: req.user.user_role_id,
                    amountUnread: amountUnread[0].amount_unread
                });
            });
        }
    });
});

module.exports = router;