const axios = require('axios');
const MailParser = require('mailparser').MailParser;

exports.register = function () {
    var plugin = this;
    plugin.register_hook("Receive Web Hook", "web_post")
}

exports.web_post = function () {
}

exports.hook_data = function (next, connection) {
    connection.transaction.parse_body = true
    next()
}

exports.hook_data_post = async function (next, connection) {
    const parser = new MailParser();
    const transaction = connection.transaction;
    transaction.message_stream.pipe(parser)
    let attachments = [];
    let content = ''
    let count = 0
    parser.on('data', function (data) {
        if (data.type === 'text') {
            content = data.textAsHtml
        }
        if (data.type === 'attachment') {
            count++;
            connection.loginfo("Got attachment:" + count)
            attachments.push(data);
            data.chunks = [];
            data.chunklen = 0;
            let size = 0;
            data.content.on('readable', () => {
                let chunk;
                while ((chunk = data.content.read()) !== null) {
                    size += chunk.length;
                    data.chunks.push(chunk);
                    data.chunklen += chunk.length;
                }
            });
            data.content.on('end', () => {
                data.buf = Buffer.concat(data.chunks, data.chunklen);
                console.log('%s: %s B', 'size', size);
                // attachment needs to be released before next chunk of
                // message data can be processed
                data.release();
            });

        }
        connection.loginfo("Data event");
    })
    parser.on("end", function () {
        parser.updateImageLinks(
            (attachment, done) => done(false, 'data:' + attachment.contentType + ';base64,' + attachment.buf.toString('base64')),
            (err, html) => {
                if (err) {
                    connection.loginfo(err);
                }
                if (html) {
                    connection.loginfo(html);
                }
            }
        );
        connection.loginfo("\t\tEnd event!!\n\n")
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
            next(OK);
        }
        ).catch((err) => {
            connection.loginfo("-------------------not OK--------------------");
            next()
        })
    })
    next();

}


