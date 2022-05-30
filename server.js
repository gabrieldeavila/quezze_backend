const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
var jsonParser = bodyParser.json();

app.use(cors());

app.listen(5000, function () {
  console.log("listening on 5000");
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/quezze", jsonParser, (req, res) => {
  console.log(req.body);
  res.send(req.body);
});
