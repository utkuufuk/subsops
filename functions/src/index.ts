import * as functions from 'firebase-functions';
import * as validator from 'email-validator';
import * as cors from 'cors';
import firestore from './firestore';
import mailgun from './mailgun';

const insertSubscriber = async (response, sub) => {
  let record;
  sub.state = 'unconfirmed';
  sub.createDate = new Date();
  sub.updateDate = new Date();

  try {
    record = await firestore.insertSubscriber(sub);
  } catch (err) {
    await mailgun.error(
      'SubsOps: Unexpected Server Error',
      `Error occurred while saving new subscriber:\n${err}`
    );
    return response.status(500).end();
  }

  try {
    // send a confirmation email to the new subscriber
    const userConfirmPromise = mailgun.send(
      sub.email,
      "Welcome to Utku's Blog!",
      'new-subscriber',
      {
        user_name: sub.name,
        confirm_url: `https://utkuufuk.com/complete/?name=${sub.name}&id=${record.id}`,
      }
    );

    // send a new subscriber notificaiton email
    const body = 'ID: ' + record.id + '\nName: ' + sub.name + '\nEmail: ' + sub.email;
    const adminNotifyPromise = mailgun.info('You Have a New Unconfirmed Subsciber!', body);
    const results = Promise.all([userConfirmPromise, adminNotifyPromise]);

    console.log(
      `Confirmation email sent: ${results[0]}` +
        `\nNew subscriber notification sent: ${record.id}, ${sub.name}, ${sub.email}`
    );
    return response.status(201).send(sub.name + ':' + record.id);
  } catch (err) {
    await mailgun.error(
      'SubsOps: Unexpected Server Error',
      `Error occurred while sending new subscriber emails:\n${err}`
    );
    return response.status(500).end();
  }
};

const createSubscriber = async (request, response) => {
  const sub = request.body;
  const subscriber = await firestore.findSubscriberByEmail(sub.email);
  if (subscriber) {
    return response.status(200).send(`${sub.name}:${subscriber.state}`);
  }

  const valid =
    sub.name !== undefined &&
    sub.name.length > 0 &&
    sub.name.length < 20 &&
    validator.validate(sub.email) &&
    new RegExp(/^([a-zA-ZöçşığüÖÇŞİĞÜ]+)$/).test(sub.name);

  if (valid) {
    return insertSubscriber(response, sub);
  }

  try {
    const body =
      `Illegal subscriber creation attempt:\nEvent Date: ` +
      `${new Date().toISOString()} \nName: ${sub.name}\nEmail ${sub.email}`;
    await mailgun.warn('Illegal Subscription', body);
    return response.status(422).send(body);
  } catch (err) {
    console.error(err);
    return response.status(500).end();
  }
};

const updateSubscriber = async (request, response, type, oldState, newState) => {
  const id = request.body.id;
  let subject, message, valid;
  const result = await firestore.findSubscriberById(id);

  try {
    const sub = result.data();
    valid = sub.state === oldState;

    if (!valid) {
      subject = `Illegal ${type} Attempt`;
      message = `There was an illegal ${type} attempt.\n\nID: ${id}\nName: ${sub.name}`;
    } else {
      subject = `User ${type} Notification`;
      message = `${type} successful.\nID: ${id}\nName: ${sub.name}\nEmail: ${sub.email}`;
      sub['state'] = newState;
      sub['updateDate'] = new Date();
      await firestore.updateSubscriber(id, sub);
    }

    await mailgun[valid ? 'info' : 'warn'](subject, message);
    return response.status(valid ? 200 : 400).send(message);
  } catch (err) {
    await mailgun.error(
      'SubsOps: Unexpected Server Error',
      `Error occurred while handling subscriber update:\n${err}`
    );
    return response.status(500).end();
  }
};

// notifies confirmed subscribers upon a blogarticle creation event on firestore
export const publish = functions.firestore.document('blogposts/{id}').onCreate(async (snap, _) => {
  const article = snap.data();
  const results = await firestore.fetchSubscribersByState('confirmed');

  results.forEach(async (result) => {
    const sub = result.data();

    // test email should only be sent to testers (if any of header, date or url is empty)
    if ((!article.header || !article.url || !article.date) && !sub.tester) {
      console.log(`not sending test email to non-test user: ${sub.name}`);
      return;
    }

    // do not send to users with a "skip" attribute set to "true"
    if (sub.skip) {
      console.log(`skipping flagged user: ${sub.name}, ${sub.email}`);
      return;
    }

    try {
      await mailgun.send(sub.email, '[utkuufuk.com] New Blog Post', 'new-blog-post-notification', {
        user_id: result.id,
        user_name: sub.name,
        post_header: article.header,
        post_url: article.url,
      });
    } catch (err) {
      console.error(err);
    }
  });

  console.log('Queued all notification emails.');
});

// creates a new subscriber
export const subscribe = functions.https.onRequest((request, response) => {
  return cors({ origin: true })(request, response, () => {
    return createSubscriber(request, response);
  });
});

// confirms a subscription
export const confirm = functions.https.onRequest((request, response) => {
  return cors({ origin: true })(request, response, () => {
    return updateSubscriber(request, response, 'Confirmation', 'unconfirmed', 'confirmed');
  });
});

// cancels a subscription
export const unsubscribe = functions.https.onRequest((request, response) => {
  return cors({ origin: true })(request, response, () => {
    return updateSubscriber(request, response, 'Unsubscription', 'confirmed', 'unsubscribed');
  });
});
