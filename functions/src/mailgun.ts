import * as functions from 'firebase-functions';

const mailgun = require('mailgun-js')({
  apiKey: functions.config().mailgun.api_key,
  domain: functions.config().mailgun.domain,
});

const createEmailPromise = (email: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    mailgun.messages().send(email, (err, body) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(body);
    });
  });
};

const send = (to: string, subject: string, template: string, params: any): Promise<any> => {
  const email = {
    from: `Utku ${functions.config().mailgun.email}`,
    to,
    subject,
    template,
  };

  Object.keys(params).forEach((key) => (email[`v:${key}`] = params[key]));
  return createEmailPromise(email);
};

const log = (subject: string, text: string): Promise<any> => {
  const email = {
    from: `Utku ${functions.config().mailgun.email}`,
    to: 'utkuufuk@gmail.com',
    subject,
    text,
  };

  return createEmailPromise(email);
};

export default {
  log,
  send,
};
