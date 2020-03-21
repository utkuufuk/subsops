import * as functions from 'firebase-functions';
import * as validator from 'email-validator';
import * as cors from 'cors';
import email from './email';
import firestore from './firestore';

const insertSubscriber = async (response, sub) => {
  sub.state = 'unconfirmed';
  sub.createDate = new Date();
  sub.updateDate = new Date();

  try {
    const result = await firestore.insertSubscriber(sub);
    // send a confirmation email to the new subscriber
    sub.id = result.id;
    let body =
      `Hey ${sub.name},\n\nThank you for subscribing to my blog.\n\n` +
      `Please click the link below to confirm your subscription:\n\n` +
      `${functions.config().blog.website}/complete/?name=${sub.name}` +
      `&id=${sub.id}\n\nCheers,\n\nUtku`;

    const confirmPromise = email.send(sub.email, "Welcome to Utku's Blog!", body, 'text');

    // send a new subscriber notificaiton email
    let subject = 'You Have a New Unconfirmed Subsciber!';
    body = 'ID: ' + sub.id + '\nName: ' + sub.name + '\nEmail: ' + sub.email;

    const notifyPromise = email.send(functions.config().admin.email, subject, body, 'text');
    const results = Promise.all([confirmPromise, notifyPromise]);

    console.log(
      `Confirmation email sent: ${results[0]}` +
        `\nNew subscriber notification sent: ${sub.id}, ${sub.name}, ${sub.email}`
    );
    return response.status(201).send(sub.name + ':' + sub.id);
  } catch (err) {
    console.error(err);
    return response.status(500).send('An unexpected server error occurred.');
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

  const body =
    `Illegal subscriber creation attempt:\nEvent Date: ` +
    `${new Date().toISOString()} \nName: ${sub.name}\nEmail ${sub.email}`;

  try {
    const result = await email.send(
      functions.config().admin.email,
      'Illegal Subscription',
      body,
      'text'
    );
    console.warn('Warning mail sent:', result, '\n', body);
    return response.status(422).send(body);
  } catch (err) {
    console.error(err);
    return response.status(500).send('An unexpected server error occurred.');
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
      firestore.updateSubscriber(id, sub);
    }

    await email.send(functions.config().admin.email, subject, message, 'text');

    return valid ? response.status(200).send(message) : response.status(400).send(message);
  } catch (err) {
    console.error(err);
    return response.status(500).send('An unexpected server error occurred.');
  }
};

const notifySubscribers = async (snap, _) => {
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

    const body =
      `Hey ${sub.name},<p>Check out my new blog article:<br><a href=${article.url}>${article.url}</a>` +
      `<p>Have a nice day,<p>Utku<p><a style="font-size: 9px" href=${
        functions.config().blog.website
      }/unsubscribe/?name=${sub.name}&id=${result.id}>unsubscribe</a>`;

    try {
      await email.send(sub.email, article.header, body, 'html');
    } catch (err) {
      console.error(err);
    }
  });

  console.log('Finished sending notification emails.');
};

// notifies confirmed subscribers upon a blogarticle creation event on firestore
export const publish = functions.firestore.document('blogposts/{id}').onCreate(notifySubscribers);

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
