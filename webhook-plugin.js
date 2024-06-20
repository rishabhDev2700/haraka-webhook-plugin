const axios = require('axios');
const MailParser = require('mailparser').MailParser;
exports.hook_data = function (next, connection) {
    connection.transaction.parse_body = true
    next()
}

exports.hook_data_post = async function (next, connection) {
    const parser = new MailParser();
    const transaction = connection.transaction;
    transaction.message_stream.pipe(parser)
    // let attachments = [];
    let content = ''
    parser.on('data', function (data) {
        if (data.type === 'text') {
            content = data.textAsHtml
        }
        if (data.type === 'attachment') {
            connection.loginfo(data)
        }
        let emailData = {
            from: transaction.mail_from.address(),
            to: transaction.rcpt_to.map(rcpt => rcpt.address()),
            subject: transaction.header.get('subject'),
            body: content,
        };
        connection.loginfo(emailData);
        axios.post('http://localhost:3000/email', emailData, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Node.js'
            }
        }).then(response => {
            connection.loginfo(response)
            connection.loginfo('+++++++++OK+++++++++++++')
        }
        ).catch((err) => connection.loginfo("-------------------not OK--------------------"))
    })


    next()
}


