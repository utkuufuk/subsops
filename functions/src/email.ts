import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

const MAX_ATTEMPTS = 3;
const numAttempts = new Map();
const transport = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  auth: {
    user: functions.config().admin.email,
    pass: functions.config().admin.password
  }
});

// sends an email using admin creds
const send = async (address, header, body, contentType) => {
  try {
    await transport.sendMail({
      from: `"Utku Ufuk" <${functions.config().admin.email}>`,
      to: address,
      subject: header,
      [contentType]: body
    });
    console.log(`Email sent: ${address}, ${header}`);
  } catch (err) {
    console.warn(
      `Warning: Failed to send email: ${address}, ${header}, Cause: ${err}`
    );

    // try again if we receive a 421 error unless we've already tried 3 times
    const attempts = numAttempts.get(address);
    if (err.status === 421 && attempts < MAX_ATTEMPTS) {
      console.warn(
        `Attempting to send to ${address} for the ${attempts}. time...`
      );
      numAttempts.set(address, attempts + 1);
      return send(address, header, body, contentType);
    }

    // throw error otherwise
    throw new Error(`Could not send email to ${address}: ${err}`);
  }
};

export default {
  send
};
