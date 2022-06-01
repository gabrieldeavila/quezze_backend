const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
var jsonParser = bodyParser.json();

var password = process.env.MONGO_PASSWORD;

const uri = `mongodb+srv://quezze:${password}@cluster0.5wuhh.mongodb.net/?retryWrites=true&w=majority`;

MongoClient.connect(uri, { useUnifiedTopology: true })
  .then((client) => {
    const db = client.db("quezze");
    const quizzCollection = db.collection("quizz");

    app.use(cors());

    app.listen(5000, function () {
      console.log("listening on 5000");
    });

    app.post("/quezze", jsonParser, (req, res) => {
      quizzCollection
        .insertOne(req.body)
        .then((result) => {
          console.log(result);
        })
        .catch((error) => console.error(error));

      res.send(req.body);
    });

    app.post("/get-quezze", jsonParser, (req, res) => {
      db.collection("quizz")
        .find()
        .toArray()
        .then((results) => {
          let filteredValues = results.filter((result) => {
            return result.create.type === req.body.value;
          });

          res.send(filteredValues);
        });
    });
  })
  .catch((error) => console.error(error));
