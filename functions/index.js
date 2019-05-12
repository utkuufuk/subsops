"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const validator = require("email-validator");
const cors = require("cors")({origin: true});
const settings = {timestampsInSnapshots: true};
admin.initializeApp(functions.config().firebase);
var db = admin.firestore();
db.settings(settings);

// sends an email using admin creds
function sendEmail(address, header, body, contentType) {
    const mailTransport = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        auth: {
            user: functions.config().admin.email,
            pass: functions.config().admin.password
        }
    });

    const options = {
        from: `"Utku Ufuk" <${functions.config().admin.email}>`,
        to: address,
        subject: header,
        [contentType]: body
    };

    return mailTransport.sendMail(options);
}

function insertSubscriber(response, sub) {
    sub.state = "unconfirmed";
    sub.createDate = new Date();
    sub.updateDate = new Date();
    return db
        .collection("subscribers")
        .add(sub)
        .then(result => {
            // send a confirmation email to the new subscriber
            sub.id = result.id;
            let body =
                `Hey ${sub.name},\n\nThank you for subscribing to my blog.\n\n` +
                `Please click the link below to confirm your subscription:\n\n` +
                `${functions.config().blog.website}/complete/?name=${sub.name}` +
                `&id=${sub.id}\n\nCheers,\n\nUtku`;
            const confirmPromise = sendEmail(sub.email, "Welcome to Utku's Blog!", body, "text");

            // send a new subscriber notificaiton email
            let subject = "You Have a New Unconfirmed Subsciber!";
            body = "ID: " + sub.id + "\nName: " + sub.name + "\nEmail: " + sub.email;
            const notifyPromise = sendEmail(functions.config().admin.email, subject, body, "text");
            return Promise.all([confirmPromise, notifyPromise]);
        })
        .then(results => {
            console.log(
                `Confirmation email sent: ${results[0]}` +
                    `\nNew subscriber notification sent: ${sub.id}, ${sub.name}, ${sub.email}`
            );
            return response.status(200).send(sub.name + ":" + sub.id);
        })
        .catch(err => {
            console.error(err);
            return response.status(500).send("An unexpected server error occurred.");
        });
}

function createSubscriber(request, response) {
    const sub = request.body;
    const valid =
        sub.name !== undefined &&
        sub.name.length > 0 &&
        sub.name.length < 20 &&
        validator.validate(sub.email) &&
        new RegExp(/^([a-zA-ZöçşığüÖÇŞİĞÜ]+)$/).test(sub.name);
    if (!valid) {
        const body =
            `Illegal subscriber creation attempt:\nEvent Date: ` +
            `${new Date().toISOString()} \nName: ${sub.name}\nEmail ${sub.email}`;
        return sendEmail(functions.config().admin.email, "Illegal Subscription", body, "text")
            .then(result => {
                console.warn("Warning mail sent:", result, "\n", body);
                return response.status(400).send(body);
            })
            .catch(err => {
                console.error(err);
            });
    }
    return insertSubscriber(response, sub);
}

function updateSubscriber(request, response, type, oldState, newState) {
    const id = request.body.id;
    let subject, message, valid;
    return db
        .doc("subscribers/" + id)
        .get()
        .then(result => {
            const sub = result.data();
            const promises = [];
            valid = sub.state === oldState;
            if (!valid) {
                subject = `Illegal ${type} Attempt`;
                message = `There was an illegal ${type} attempt.\n\nID: ${id}\nName: ${sub.name}`;
            } else {
                subject = `User ${type} Notification`;
                message = `${type} successful.\nID: ${id}\nName: ${sub.name}\nEmail: ${sub.email}`;
                sub["state"] = newState;
                sub["updateDate"] = new Date();
                promises.push(db.doc("subscribers/" + id).set(sub));
            }
            const mailPromise = sendEmail(functions.config().admin.email, subject, message, "text");
            promises.unshift(mailPromise);
            return Promise.all(promises);
        })
        .then(results => {
            console.log("Mail sent:\n", results[0], "\n" + message);
            return valid ? response.status(200).send(message) : response.status(400).send(message);
        })
        .catch(err => {
            console.error(err);
            return response.status(500).send("An unexpected server error occurred.");
        });
}

// notifies confirmed subscribers upon a blogpost creation event on firestore
exports.publish = functions.firestore.document("blogposts/{id}").onCreate((snap, _) => {
    const post = snap.data();
    return db
        .collection("subscribers")
        .where("state", "==", "confirmed")
        .get()
        .then(result => {
            const promises = [];
            result.forEach(result => {
                const sub = result.data();
                const body =
                    `Hey ${sub.name},<p>Check out my new blog post:<br>${post.url}` +
                    `<p>Have a nice day,<p>Utku<p><a style="font-size: 9px" href=${
                        functions.config().blog.website
                    }/unsubscribe/?name=${sub.name}&id=${result.id}>unsubscribe</a>`;
                const mailPromise = sendEmail(sub.email, post.header, body, "html");
                promises.push(mailPromise);
                console.log(
                    `Blog post notification email sent: `,
                    `${sub.name}, ${sub.email}, ${post.header}, ${post.url}`
                );
            });
            console.log("All blog post notification emails sent.");
            return Promise.all(promises);
        })
        .catch(err => {
            console.error(err);
        });
});

// creates a new subscriber
exports.subscribe = functions.https.onRequest((request, response) => {
    return cors(request, response, () => {
        return createSubscriber(request, response);
    });
});

// confirms a subscription
exports.confirm = functions.https.onRequest((request, response) => {
    return cors(request, response, () => {
        return updateSubscriber(request, response, "Confirmation", "unconfirmed", "confirmed");
    });
});

// cancels a subscription
exports.unsubscribe = functions.https.onRequest((request, response) => {
    return cors(request, response, () => {
        return updateSubscriber(request, response, "Unsubscription", "confirmed", "unsubscribed");
    });
});
