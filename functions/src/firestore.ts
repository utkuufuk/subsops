import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
const settings = { timestampsInSnapshots: true };
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
db.settings(settings);

const insertSubscriber = async (subscriber) => {
  return await db.collection('subscribers').add(subscriber);
};

const updateSubscriber = async (id: string, subscriber: any) => {
  await db.doc('subscribers/' + id).set(subscriber);
};

const findSubscriberById = async (id: string) => {
  return await db.doc('subscribers/' + id).get();
};

const findSubscriberByEmail = async (email: string) => {
  const matches = await db
    .collection('subscribers')
    .where('email', '==', email)
    .get();
  return matches.empty ? null : matches.docs[0].data();
};

const fetchSubscribersByState = async (state: string) => {
  return await db
    .collection('subscribers')
    .where('state', '==', state)
    .get();
};

export default {
  insertSubscriber,
  updateSubscriber,
  findSubscriberById,
  findSubscriberByEmail,
  fetchSubscribersByState,
};
