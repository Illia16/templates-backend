const { SESClient, SendEmailCommand, VerifyEmailIdentityCommand } = require("@aws-sdk/client-ses");
const clientEmail = new SESClient({});

module.exports =  {
    sendEmail: async (data) => {    
        const input = {
            Source: `${process.env.PROJECT_NAME}-${process.env.STAGE}@devemail.illusha.net`,
            Destination: {
                ToAddresses: ['illia2143@gmail.com'],
            },
            Message: {
                Subject: {
                    Data: `${data.subject} - from ${data.email}`,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: data.message,
                        Charset: "UTF-8",
                    },
                },
            },
        };

        const command = new SendEmailCommand(input);
        try {
            await clientEmail.send(command);
        } catch (error) {
            console.log('error sendEmail:', error);
            throw new Error("sendEmail:", error);
        }
    },
}