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

exports.hook_queue = async function (next, connection) {
    const parser = new MailParser();
    const transaction = connection.transaction;
    transaction.message_stream.pipe(parser)
    let attachments = [];
    let content = ''
    parser.on('data', function (data) {
        if (data.type === 'text') {
            content = data.textAsHtml
        }
        if (data.type === 'attachment') {
            connection.loginfo("Got attachment:" + count)
            attachments.push(data);
            data.chunks = [];
            data.chunklen = 0;
            data.content.on('readable', () => {
                let chunk;
                while ((chunk = data.content.read()) !== null) {
                    data.chunks.push(chunk);
                    data.chunklen += chunk.length;
                }
            });
            data.content.on('end', () => {
                data.buf = Buffer.concat(data.chunks, data.chunklen);
                attachments.push({
                    filename: data.filename,
                    contentType: data.contentType,
                    size: data.size,
                    content: data.buf.toString('base64'),
                })
                data.release();
            });

        }
        connection.loginfo("Data event");
    })
    parser.on("end", function () {
        connection.loginfo("\t\tEnd event!!\n\n")
        let emailData = {
            from: transaction.mail_from.address(),
            to: transaction.rcpt_to.map(rcpt => rcpt.address()),
            subject: transaction.header.get('subject'),
            body: content,
            attachments: attachments.map(att => ({
                filename: att.filename,
                contentType: att.contentType,
                size: att.size,
                content: `data:${att.contentType};base64,${att.content}`
            }))
        };
        try {
            connection.loginfo(emailData);
            const response = axios.post('http://localhost:3000/email', emailData, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Node.js'
                }
            })
            connection.loginfo("\t--Sent!--");
            connection.loginfo("Response:" + response.body)
        }
        catch (e) {
            connection.loginfo("\tError: " + e.message)
        }
        next(OK, `Message accepted with ID <${connection.uuid}>`)
    })
    parser.on('error', (err) => {
        connection.logerror('Error parsing email');
        connection.logerror(err.message);
        next();
    });

}


