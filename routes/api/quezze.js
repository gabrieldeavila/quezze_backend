var router = require("express").Router();
var mongoose = require("mongoose");
var Quezze = mongoose.model("Quezze");
var Comment = mongoose.model("Comment");
var User = mongoose.model("User");
var auth = require("../auth");

// Preload quezze objects on routes with ':quezze'
router.param("quezze", function (req, res, next, slug) {
  Quezze.findOne({ slug: slug })
    .populate("author")
    .then(function (quezze) {
      if (!quezze) {
        return res.sendStatus(404);
      }

      req.quezze = quezze;

      return next();
    })
    .catch(next);
});

router.param("comment", function (req, res, next, id) {
  Comment.findById(id)
    .then(function (comment) {
      if (!comment) {
        return res.sendStatus(404);
      }

      req.comment = comment;

      return next();
    })
    .catch(next);
});

router.get("/", auth.optional, function (req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  if (typeof req.query.tag !== "undefined") {
    query.tagList = { $in: [req.query.tag] };
  }

  Promise.all([
    req.query.author ? User.findOne({ username: req.query.author }) : null,
    req.query.favorited
      ? User.findOne({ username: req.query.favorited })
      : null,
  ])
    .then(function (results) {
      var author = results[0];
      var favoriter = results[1];

      if (author) {
        query.author = author._id;
      }

      if (favoriter) {
        query._id = { $in: favoriter.favorites };
      } else if (req.query.favorited) {
        query._id = { $in: [] };
      }

      return Promise.all([
        Quezze.find(query)
          .limit(Number(limit))
          .skip(Number(offset))
          .sort({ createdAt: "desc" })
          .populate("author")
          .exec(),
        Quezze.count(query).exec(),
        req.payload ? User.findById(req.payload.id) : null,
      ]).then(function (results) {
        var quezzes = results[0];
        var quezzesCount = results[1];
        var user = results[2];

        return res.json({
          quezzes: quezzes.map(function (quezze) {
            return quezze.toJSONFor(user);
          }),
          quezzesCount: quezzesCount,
        });
      });
    })
    .catch(next);
});

router.get("/feed", auth.required, function (req, res, next) {
  var limit = 20;
  var offset = 0;

  if (typeof req.query.limit !== "undefined") {
    limit = req.query.limit;
  }

  if (typeof req.query.offset !== "undefined") {
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function (user) {
    if (!user) {
      return res.sendStatus(401);
    }

    Promise.all([
      Quezze.find({ author: { $in: user.following } })
        .limit(Number(limit))
        .skip(Number(offset))
        .populate("author")
        .exec(),
      Quezze.count({ author: { $in: user.following } }),
    ])
      .then(function (results) {
        var quezzes = results[0];
        var quezzesCount = results[1];

        return res.json({
          quezzes: quezzes.map(function (quezze) {
            return quezze.toJSONFor(user);
          }),
          quezzesCount: quezzesCount,
        });
      })
      .catch(next);
  });
});

router.post("/", auth.required, function (req, res, next) {
  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      var quezze = new Quezze(req.body.quezze);

      quezze.author = user;

      return quezze.save().then(function () {
        console.log(quezze.author);
        return res.json({ quezze: quezze.toJSONFor(user) });
      });
    })
    .catch(next);
});

// return a quezze
router.get("/:quezze", auth.optional, function (req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.quezze.populate("author").execPopulate(),
  ])
    .then(function (results) {
      var user = results[0];

      return res.json({ quezze: req.quezze.toJSONFor(user) });
    })
    .catch(next);
});

// update quezze
router.put("/:quezze", auth.required, function (req, res, next) {
  User.findById(req.payload.id).then(function (user) {
    if (req.quezze.author._id.toString() === req.payload.id.toString()) {
      if (typeof req.body.quezze.title !== "undefined") {
        req.quezze.title = req.body.quezze.title;
      }

      if (typeof req.body.quezze.description !== "undefined") {
        req.quezze.description = req.body.quezze.description;
      }

      if (typeof req.body.quezze.body !== "undefined") {
        req.quezze.body = req.body.quezze.body;
      }

      if (typeof req.body.quezze.tagList !== "undefined") {
        req.quezze.tagList = req.body.quezze.tagList;
      }

      req.quezze
        .save()
        .then(function (quezze) {
          return res.json({ quezze: quezze.toJSONFor(user) });
        })
        .catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete quezze
router.delete("/:quezze", auth.required, function (req, res, next) {
  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      if (req.quezze.author._id.toString() === req.payload.id.toString()) {
        return req.quezze.remove().then(function () {
          return res.sendStatus(204);
        });
      } else {
        return res.sendStatus(403);
      }
    })
    .catch(next);
});

// Favorite an quezze
router.post("/:quezze/favorite", auth.required, function (req, res, next) {
  var quezzeId = req.quezze._id;

  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.favorite(quezzeId).then(function () {
        return req.quezze.updateFavoriteCount().then(function (quezze) {
          return res.json({ quezze: quezze.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

// Unfavorite an quezze
router.delete("/:quezze/favorite", auth.required, function (req, res, next) {
  var quezzeId = req.quezze._id;

  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      return user.unfavorite(quezzeId).then(function () {
        return req.quezze.updateFavoriteCount().then(function (quezze) {
          return res.json({ quezze: quezze.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

// return an quezze's comments
router.get("/:quezze/comments", auth.optional, function (req, res, next) {
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null)
    .then(function (user) {
      return req.quezze
        .populate({
          path: "comments",
          populate: {
            path: "author",
          },
          options: {
            sort: {
              createdAt: "desc",
            },
          },
        })
        .execPopulate()
        .then(function (quezze) {
          return res.json({
            comments: req.quezze.comments.map(function (comment) {
              return comment.toJSONFor(user);
            }),
          });
        });
    })
    .catch(next);
});

// create a new comment
router.post("/:quezze/comments", auth.required, function (req, res, next) {
  User.findById(req.payload.id)
    .then(function (user) {
      if (!user) {
        return res.sendStatus(401);
      }

      var comment = new Comment(req.body.comment);
      comment.quezze = req.quezze;
      comment.author = user;

      return comment.save().then(function () {
        req.quezze.comments.push(comment);

        return req.quezze.save().then(function (quezze) {
          res.json({ comment: comment.toJSONFor(user) });
        });
      });
    })
    .catch(next);
});

router.delete(
  "/:quezze/comments/:comment",
  auth.required,
  function (req, res, next) {
    if (req.comment.author.toString() === req.payload.id.toString()) {
      req.quezze.comments.remove(req.comment._id);
      req.quezze
        .save()
        .then(Comment.find({ _id: req.comment._id }).remove().exec())
        .then(function () {
          res.sendStatus(204);
        });
    } else {
      res.sendStatus(403);
    }
  }
);

module.exports = router;
