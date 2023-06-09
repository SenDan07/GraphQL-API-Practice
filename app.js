const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const { DB_URL } = process.env;

const app = express();

const fileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'images');
  },
  filename: function (req, file, cb) {
    cb(null, uuidv4());
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// app.use(bodyParser.urlencoded({ extended: true })) //x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not authenticated.');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided' });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }
  return res.status(201).json({
    message: 'File stored successfully',
    filePath: req.file.path.replace('\\', '/'),
  });
});

//Unlike REST APIs which makes use of several routes, in GraphQL this is the only endpoint we'll provide
app.use(
  '/graphql',
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    // formatError(err) {
    //   if (!err.originalError) {
    //     return err;
    //   }
    //   const data = err.originalError.data;
    //   const message = err.message || 'An error ocurred.';
    //   const code = err.originalError.code || 500;
    //   return { message: message, status: code, data: data };
    // },
    // customFormatErrorFn: (error) => ({
    //   message: error.message || 'An error occurred.',
    //   code: error.originalError.code || 500,
    //   data: error.originalError.data,
    // }),
    customFormatErrorFn: (error) => ({
      message: error.message || 'An error occurred.',
      code:
        error.originalError && error.originalError.code
          ? error.originalError.code
          : 500,
      data:
        error.originalError && error.originalError.data
          ? error.originalError.data
          : null,
    }),
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

mongoose
  .connect(`${DB_URL}`)
  .then((result) => {
    console.log('Server listening at port 8080');
    app.listen(8080);
  })
  .catch((err) => {
    console.log(err);
  });
