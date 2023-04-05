let mongoose = require("mongoose");
let Schema = mongoose.Schema; 

let bcrypt = require("bcryptjs");

let userSchema = new Schema({
    "userName": {

        "type": String,
        "unique": true
    },
    "password": String,
    "email": String,
    "loginHistory": [{
        "dateTime": Date,
        "userAgent": String
    }]
});

let User;
module.exports.initialize = function () {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection("mongodb+srv://gsingh1070:gagan123@cluster0.bfnrgwq.mongodb.net/test");
        db.on('error', (err) => {
            reject(err);
        });
        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
};
module.exports.registerUser = function (userData) {
    return new Promise(function (resolve, reject) {
        if (userData.password != userData.password2) {
            reject("Passwords do not match");
        }
        else {
            bcrypt.hash(userData.password, 10)
                .then((hash) => {
                    userData.password = hash;
                    let newUser = new User(userData);
                    newUser.save()
                        .then(() => {
                            resolve();
                        }).catch((err) => {
                            if (err.code == 11000) {
                                reject("User name already taken");
                            }
                            else {
                                reject("There was an error creating the user:" + err);
                            }
                        });
                }).catch((err) => {
                    reject(err);
                })
        }
    });
};

module.exports.checkUser = function (userData) {
    return new Promise(function (resolve, reject) {
        User.find({ userName: userData.userName })
            .exec()
            .then((users) => {
                if (users.length == 0) {
                    reject("Unable to find user: " + userData.userName);
                } else {
                    bcrypt.compare(userData.password, users[0].password)
                        .then((result) => {
                            if (result == false) {
                                reject("Incorrect Password for user: " + userData.userName);
                            } else {
                                users[0].loginHistory.push({
                                    "dateTime": (new Date()).toString(),
                                    "userAgent": userData.userAgent
                                });

                                User.updateOne(
                                    { userName: users[0].userName },
                                    { $set: { loginHistory: users[0].loginHistory } }
                                )
                                    .exec()
                                    .then(() => {
                                        resolve(users[0]);
                                    })
                                    .catch((err) => {
                                        reject("There was an error while verifying user: " + err);
                                    })
                            }
                        })
                        .catch((err) => {
                            reject(err);
                        })

                }
            })
            .catch((err) => {
                reject("Unable to find user: " + userData.userName);
            })
    });
};

